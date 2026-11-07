import { slugifyCategoryName, type GalleryCategoryDTO } from "../../shared/gallery-categories";
import { errorResponse, json } from "../lib/http";
import { triggerSiteRebuilds } from "../lib/deploy-hook";
import type { Env } from "../types";

interface GalleryCategoryRow {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at: string;
}

function rowToDTO(row: GalleryCategoryRow): GalleryCategoryDTO {
  return { id: row.id, name: row.name, slug: row.slug, displayOrder: row.display_order };
}

function requireBindings(env: Env): Response | null {
  if (!env.DB) {
    return errorResponse("Gallery storage is not provisioned yet.", 503);
  }
  return null;
}

/** Used by worker/api/gallery.ts to validate a photo's category against
 * whatever categories actually exist right now, instead of a fixed
 * compile-time list. Case-sensitive exact match, same as how `category`
 * is stored verbatim as the category's display name on gallery_images. */
export async function categoryExists(env: Env, name: string): Promise<boolean> {
  const row = await env.DB!.prepare("SELECT 1 FROM gallery_categories WHERE name = ?").bind(name).first();
  return row !== null;
}

export async function listCategoryNames(env: Env): Promise<string[]> {
  const { results } = await env.DB!.prepare(
    "SELECT name FROM gallery_categories ORDER BY display_order ASC",
  ).all<{ name: string }>();
  return results.map((r) => r.name);
}

export async function handleGalleryCategoriesRequest(
  request: Request,
  env: Env,
  id: string | null,
  ctx: ExecutionContext,
): Promise<Response> {
  const bindingError = requireBindings(env);
  if (bindingError) return bindingError;

  switch (request.method) {
    case "GET":
      return listAll(env);
    case "POST":
      return create(request, env, ctx);
    case "PATCH":
      return id ? rename(request, env, id, ctx) : errorResponse("Missing category id", 400);
    case "DELETE":
      return id ? remove(env, id, ctx) : errorResponse("Missing category id", 400);
    default:
      return errorResponse("Method not allowed", 405);
  }
}

async function listAll(env: Env): Promise<Response> {
  const { results } = await env.DB!.prepare(
    "SELECT * FROM gallery_categories ORDER BY display_order ASC",
  ).all<GalleryCategoryRow>();
  return json(results.map(rowToDTO));
}

async function nextDisplayOrder(env: Env): Promise<number> {
  const row = await env.DB!.prepare("SELECT MAX(display_order) AS maxOrder FROM gallery_categories").first<{
    maxOrder: number | null;
  }>();
  return (row?.maxOrder ?? -1) + 1;
}

/** Appends -2, -3, ... until the slug is unique. Collisions are rare (two
 * category names that only differ by punctuation/case, e.g. "Guru Purnima
 * 2026" vs "Guru Purnima, 2026!") but silently overwriting another
 * category's slug would break the public site's filter tabs for both, so
 * this is worth the extra query. */
async function uniqueSlug(env: Env, base: string): Promise<string> {
  let candidate = base || "category";
  let suffix = 2;
  while (await env.DB!.prepare("SELECT 1 FROM gallery_categories WHERE slug = ?").bind(candidate).first()) {
    candidate = `${base || "category"}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function create(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json<{ name?: unknown }>().catch(() => ({ name: undefined }));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return errorResponse("Category name is required");
  if (name.length > 60) return errorResponse("Category name must be 60 characters or fewer");

  const existing = await env.DB!.prepare("SELECT 1 FROM gallery_categories WHERE name = ? COLLATE NOCASE")
    .bind(name)
    .first();
  if (existing) return errorResponse(`A category named "${name}" already exists`, 409);

  const id = crypto.randomUUID();
  const slug = await uniqueSlug(env, slugifyCategoryName(name));
  const displayOrder = await nextDisplayOrder(env);
  const now = new Date().toISOString();

  await env.DB!.prepare(
    "INSERT INTO gallery_categories (id, name, slug, display_order, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, name, slug, displayOrder, now)
    .run();

  // A new category can't have any photos yet, but the public site's
  // filter tabs still need to pick it up -- see
  // /api/public/gallery-categories, fetched at the public site's next
  // build. Same fire-and-forget rebuild trigger every gallery mutation
  // already uses.
  ctx.waitUntil(triggerSiteRebuilds(env));

  return json({ id, name, slug, displayOrder }, { status: 201 });
}

/** Renaming is the one tricky part: gallery_images.category stores the
 * category's display NAME as plain text (not a foreign key), matching
 * how every existing route (upload, edit, bulk edit, the public feed)
 * already reads/writes it. So a rename has to cascade-update every photo
 * row currently using the old name to the new one, in the same batch as
 * the rename itself, or photos would silently end up with a category
 * name that no longer exists anywhere. The slug is deliberately NOT
 * changed on rename -- it's the stable identifier the public site's
 * filter tabs key off, so renaming "Gurudev" to "Our Gurudev" shouldn't
 * reset which tab was previously bookmarked/linked. */
async function rename(request: Request, env: Env, id: string, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json<{ name?: unknown }>().catch(() => ({ name: undefined }));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return errorResponse("Category name is required");
  if (name.length > 60) return errorResponse("Category name must be 60 characters or fewer");

  const current = await env.DB!.prepare("SELECT name FROM gallery_categories WHERE id = ?")
    .bind(id)
    .first<{ name: string }>();
  if (!current) return errorResponse("Category not found", 404);

  if (current.name === name) {
    return json({ id, name, renamed: 0 });
  }

  const clash = await env.DB!.prepare(
    "SELECT 1 FROM gallery_categories WHERE name = ? COLLATE NOCASE AND id != ?",
  )
    .bind(name, id)
    .first();
  if (clash) return errorResponse(`A category named "${name}" already exists`, 409);

  await env.DB!.batch([
    env.DB!.prepare("UPDATE gallery_categories SET name = ? WHERE id = ?").bind(name, id),
    env.DB!.prepare("UPDATE gallery_images SET category = ? WHERE category = ?").bind(name, current.name),
  ]);

  ctx.waitUntil(triggerSiteRebuilds(env));

  return json({ id, name, renamedFrom: current.name });
}

/** Deliberately blocks deleting a category that still has photos in it,
 * rather than cascade-deleting those photos or silently re-bucketing
 * them into some fallback category -- both of those are surprising,
 * destructive-feeling outcomes for what looks like "just removing an
 * empty folder". An admin has to explicitly move or delete the photos
 * first; the error message says exactly how many so that's not a
 * guessing game. */
async function remove(env: Env, id: string, ctx: ExecutionContext): Promise<Response> {
  const category = await env.DB!.prepare("SELECT name FROM gallery_categories WHERE id = ?")
    .bind(id)
    .first<{ name: string }>();
  if (!category) return errorResponse("Category not found", 404);

  const inUse = await env.DB!.prepare("SELECT COUNT(*) AS count FROM gallery_images WHERE category = ?")
    .bind(category.name)
    .first<{ count: number }>();
  const count = inUse?.count ?? 0;
  if (count > 0) {
    return errorResponse(
      `Cannot delete "${category.name}" -- ${count} photo${count === 1 ? "" : "s"} still use this category. ` +
        `Move or delete ${count === 1 ? "it" : "them"} first.`,
      409,
    );
  }

  await env.DB!.prepare("DELETE FROM gallery_categories WHERE id = ?").bind(id).run();

  ctx.waitUntil(triggerSiteRebuilds(env));

  return new Response(null, { status: 204 });
}

import { categoryExists } from "./gallery-categories";
import { errorResponse, getAccessUserEmail, json } from "../lib/http";
import { triggerSiteRebuilds } from "../lib/deploy-hook";
import type { Env, GalleryImageRow } from "../types";
import { rowToDTO } from "../types";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function requireBindings(env: Env): Response | null {
  if (!env.DB || !env.GALLERY_BUCKET) {
    return errorResponse(
      "Gallery storage is not provisioned yet. An admin needs to create the " +
        "R2 bucket and D1 database for THIS project (see Phase 1 checklist in " +
        "docs/admin-panel-architecture.html), then uncomment the bindings in " +
        "wrangler.jsonc. This never touches the public site's resources.",
      503,
    );
  }
  return null;
}

export async function handleGalleryRequest(
  request: Request,
  env: Env,
  id: string | null,
  ctx: ExecutionContext,
): Promise<Response> {
  const bindingError = requireBindings(env);
  if (bindingError) return bindingError;

  switch (request.method) {
    case "GET":
      return id ? getOne(env, id) : listAll(env);
    case "POST":
      return create(request, env, ctx);
    case "PATCH":
      return id ? update(request, env, id, ctx) : errorResponse("Missing image id", 400);
    case "DELETE":
      return id ? remove(env, id, ctx) : errorResponse("Missing image id", 400);
    default:
      return errorResponse("Method not allowed", 405);
  }
}

// Admin panel supports selecting many photos at once and bulk-editing or
// bulk-deleting them. This is deliberately a separate endpoint rather than
// the frontend firing N individual PATCH/DELETE requests, for two reasons:
// (1) one DB statement instead of N round trips, and (2) each gallery
// mutation schedules a Cloudflare Deploy Hook call (see deploy-hook.ts),
// which is rate-limited to 10/minute per Worker -- firing N of those for
// one bulk action would risk silently dropping the dev rebuild trigger for
// a batch larger than that.
const MAX_BULK_IDS = 200; // generous for this gallery's realistic size; just a sanity cap

export async function handleBulkGalleryRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const bindingError = requireBindings(env);
  if (bindingError) return bindingError;

  switch (request.method) {
    case "PATCH":
      return bulkUpdate(request, env, ctx);
    case "DELETE":
      return bulkRemove(request, env, ctx);
    default:
      return errorResponse("Method not allowed", 405);
  }
}

function parseBulkIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > MAX_BULK_IDS) return null;
  if (!value.every((v) => typeof v === "string" && v.length > 0)) return null;
  return value;
}

async function bulkUpdate(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json<{
    ids?: unknown;
    patch?: Partial<{ category: string; published: boolean }>;
  }>();

  const ids = parseBulkIds(body.ids);
  if (!ids) return errorResponse(`ids must be a non-empty array of up to ${MAX_BULK_IDS} strings`);

  const patch = body.patch;
  if (!patch || Object.keys(patch).length === 0) return errorResponse("patch must include at least one field");

  // Bulk edit intentionally only supports fields that make sense applied
  // uniformly across many *different* photos -- category and published
  // status. Caption/alt text describe one specific image and should stay
  // per-photo; see EditImageModal for those.
  const updates: string[] = [];
  const values: unknown[] = [];
  if (patch.category !== undefined) {
    if (!(await categoryExists(env, patch.category))) {
      return errorResponse(`"${patch.category}" is not a category. Check spelling, or add it first.`);
    }
    updates.push("category = ?");
    values.push(patch.category);
  }
  if (patch.published !== undefined) {
    updates.push("published = ?");
    values.push(patch.published ? 1 : 0);
  }
  if (updates.length === 0) return errorResponse("Bulk edit only supports category and published");

  const placeholders = ids.map(() => "?").join(", ");
  const result = await env.DB!.prepare(
    `UPDATE gallery_images SET ${updates.join(", ")} WHERE id IN (${placeholders})`,
  )
    .bind(...values, ...ids)
    .run();

  ctx.waitUntil(triggerSiteRebuilds(env));
  return json({ updated: result.meta.changes });
}

async function bulkRemove(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json<{ ids?: unknown }>();
  const ids = parseBulkIds(body.ids);
  if (!ids) return errorResponse(`ids must be a non-empty array of up to ${MAX_BULK_IDS} strings`);

  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await env.DB!.prepare(
    `SELECT id, r2_key FROM gallery_images WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ id: string; r2_key: string }>();

  await Promise.all(results.map((row) => env.GALLERY_BUCKET!.delete(row.r2_key)));
  if (results.length > 0) {
    await env.DB!.prepare(`DELETE FROM gallery_images WHERE id IN (${placeholders})`)
      .bind(...ids)
      .run();
  }

  ctx.waitUntil(triggerSiteRebuilds(env));
  return json({ deleted: results.length });
}

async function listAll(env: Env): Promise<Response> {
  const { results } = await env.DB!.prepare(
    "SELECT * FROM gallery_images ORDER BY display_order ASC, created_at DESC",
  ).all<GalleryImageRow>();
  return json(results.map(rowToDTO));
}

async function getOne(env: Env, id: string): Promise<Response> {
  const row = await env.DB!.prepare("SELECT * FROM gallery_images WHERE id = ?")
    .bind(id)
    .first<GalleryImageRow>();
  if (!row) return errorResponse("Image not found", 404);
  return json(rowToDTO(row));
}

async function create(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "");
  const caption = String(form.get("caption") ?? "");
  const altText = String(form.get("altText") ?? "");

  if (!(file instanceof File)) return errorResponse("Missing file");
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return errorResponse(
      `Unsupported file type "${file.type}". Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(`File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
  }
  if (!(await categoryExists(env, category))) {
    return errorResponse(`"${category}" is not a category. Check spelling, or add it first.`);
  }
  if (!altText.trim()) return errorResponse("altText is required for accessibility");

  const id = crypto.randomUUID();
  const extension = file.name.split(".").pop() ?? "jpg";
  const r2Key = `gallery/${id}.${extension}`;

  await env.GALLERY_BUCKET!.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const uploadedBy = getAccessUserEmail(request) ?? "unknown";
  const now = new Date().toISOString();

  await env.DB!.prepare(
    `INSERT INTO gallery_images
      (id, r2_key, alt_text, caption, category, display_order, published, created_at, uploaded_by)
     VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
  )
    .bind(id, r2Key, altText, caption, category, now, uploadedBy)
    .run();

  ctx.waitUntil(triggerSiteRebuilds(env));

  return json({ id, r2Key }, { status: 201 });
}

async function update(request: Request, env: Env, id: string, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json<Partial<{
    caption: string;
    altText: string;
    category: string;
    displayOrder: number;
    published: boolean;
  }>>();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.caption !== undefined) {
    updates.push("caption = ?");
    values.push(body.caption);
  }
  if (body.altText !== undefined) {
    if (!body.altText.trim()) return errorResponse("altText cannot be empty");
    updates.push("alt_text = ?");
    values.push(body.altText);
  }
  if (body.category !== undefined) {
    if (!(await categoryExists(env, body.category))) {
      return errorResponse(`"${body.category}" is not a category. Check spelling, or add it first.`);
    }
    updates.push("category = ?");
    values.push(body.category);
  }
  if (body.displayOrder !== undefined) {
    updates.push("display_order = ?");
    values.push(body.displayOrder);
  }
  if (body.published !== undefined) {
    updates.push("published = ?");
    values.push(body.published ? 1 : 0);
  }

  if (updates.length === 0) return errorResponse("No fields to update");

  values.push(id);
  const result = await env.DB!.prepare(
    `UPDATE gallery_images SET ${updates.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  if (result.meta.changes === 0) return errorResponse("Image not found", 404);
  ctx.waitUntil(triggerSiteRebuilds(env));
  return getOne(env, id);
}

async function remove(env: Env, id: string, ctx: ExecutionContext): Promise<Response> {
  const row = await env.DB!.prepare("SELECT r2_key FROM gallery_images WHERE id = ?")
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return errorResponse("Image not found", 404);

  await env.GALLERY_BUCKET!.delete(row.r2_key);
  await env.DB!.prepare("DELETE FROM gallery_images WHERE id = ?").bind(id).run();

  ctx.waitUntil(triggerSiteRebuilds(env));

  return new Response(null, { status: 204 });
}

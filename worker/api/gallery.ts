import { GALLERY_CATEGORIES, isGalleryCategory } from "../../shared/gallery-categories";
import { errorResponse, getAccessUserEmail, json } from "../lib/http";
import { triggerDevRebuild } from "../lib/deploy-hook";
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
  if (!isGalleryCategory(category)) {
    return errorResponse(`Category must be one of: ${GALLERY_CATEGORIES.join(", ")}`);
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

  ctx.waitUntil(triggerDevRebuild(env));

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
    if (!isGalleryCategory(body.category)) {
      return errorResponse(`Category must be one of: ${GALLERY_CATEGORIES.join(", ")}`);
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
  ctx.waitUntil(triggerDevRebuild(env));
  return getOne(env, id);
}

async function remove(env: Env, id: string, ctx: ExecutionContext): Promise<Response> {
  const row = await env.DB!.prepare("SELECT r2_key FROM gallery_images WHERE id = ?")
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return errorResponse("Image not found", 404);

  await env.GALLERY_BUCKET!.delete(row.r2_key);
  await env.DB!.prepare("DELETE FROM gallery_images WHERE id = ?").bind(id).run();

  ctx.waitUntil(triggerDevRebuild(env));

  return new Response(null, { status: 204 });
}

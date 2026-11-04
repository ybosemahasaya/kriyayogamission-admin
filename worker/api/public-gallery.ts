import { errorResponse, json } from "../lib/http";
import type { Env, GalleryImageRow } from "../types";

/**
 * Public, read-only feed of published gallery images, meant to be fetched
 * at build time by the main site (Astro, static output). No auth -- it's
 * the public gallery, same content anyone can already see on the live
 * site. Unlike /api/gallery, this never exposes unpublished drafts.
 */
export async function handlePublicGalleryRequest(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    return errorResponse("Gallery storage is not provisioned yet.", 503);
  }

  const { results } = await env.DB.prepare(
    "SELECT * FROM gallery_images WHERE published = 1 ORDER BY display_order ASC, created_at DESC",
  ).all<GalleryImageRow>();

  const origin = new URL(request.url).origin;
  const images = results.map((row) => ({
    category: row.category,
    altText: row.alt_text,
    caption: row.caption,
    imageUrl: `${origin}/images/${row.r2_key}`,
  }));

  return json(images);
}

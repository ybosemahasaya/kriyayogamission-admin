import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";
import type { GalleryCategoryDTO } from "../../shared/gallery-categories";

interface GalleryCategoryRow {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

/**
 * Public, read-only feed of gallery categories, fetched at build time by
 * the main site (Astro, static output) so its filter tabs reflect
 * whatever categories currently exist instead of a hardcoded list.
 * Mirrors worker/api/public-gallery.ts's pattern exactly: no auth, same
 * content anyone browsing the live gallery already implicitly sees via
 * which tabs render.
 */
export async function handlePublicGalleryCategoriesRequest(env: Env): Promise<Response> {
  if (!env.DB) {
    return errorResponse("Gallery storage is not provisioned yet.", 503);
  }

  const { results } = await env.DB.prepare(
    "SELECT id, name, slug, display_order FROM gallery_categories ORDER BY display_order ASC",
  ).all<GalleryCategoryRow>();

  const categories: GalleryCategoryDTO[] = results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayOrder: row.display_order,
  }));

  return json(categories);
}

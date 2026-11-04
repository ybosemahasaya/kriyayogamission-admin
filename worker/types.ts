import type { GalleryCategory } from "../shared/gallery-categories";
import type { GalleryImageDTO } from "../shared/gallery-image";

export type { GalleryImageDTO };

/**
 * Cloudflare bindings for the admin Worker.
 *
 * GALLERY_BUCKET and DB are commented out in wrangler.jsonc until the
 * corresponding R2 bucket / D1 database are provisioned in the Cloudflare
 * dashboard for THIS project (see Phase 1 checklist: "provision-r2",
 * "provision-d1" in docs/admin-panel-architecture.html). They are typed as
 * optional here so the Worker still builds before that happens; the route
 * handlers check for their presence at request time and return a clear 503
 * instead of crashing.
 */
export interface Env {
  ASSETS: Fetcher;
  GALLERY_BUCKET?: R2Bucket;
  DB?: D1Database;
}

export interface GalleryImageRow {
  id: string;
  r2_key: string;
  alt_text: string;
  caption: string;
  category: GalleryCategory;
  display_order: number;
  published: number; // D1/SQLite has no boolean type -- 0 or 1
  created_at: string;
}

export function rowToDTO(row: GalleryImageRow): GalleryImageDTO {
  return {
    id: row.id,
    src: row.r2_key,
    altText: row.alt_text,
    caption: row.caption,
    category: row.category,
    displayOrder: row.display_order,
    published: row.published === 1,
    createdAt: row.created_at,
  };
}

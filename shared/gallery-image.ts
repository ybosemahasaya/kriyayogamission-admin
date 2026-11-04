import type { GalleryCategory } from "./gallery-categories";

/** Shape returned by the admin Worker's /api/gallery endpoints. Shared by
 * the worker (which produces it) and the React frontend (which consumes
 * it), so the two can never silently drift out of sync. */
export interface GalleryImageDTO {
  id: string;
  src: string;
  altText: string;
  caption: string;
  category: GalleryCategory;
  displayOrder: number;
  published: boolean;
  createdAt: string;
}

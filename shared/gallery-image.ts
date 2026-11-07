/** Shape returned by the admin Worker's /api/gallery endpoints. Shared by
 * the worker (which produces it) and the React frontend (which consumes
 * it), so the two can never silently drift out of sync.
 *
 * `category` is a plain string (the category's current display name, e.g.
 * "Gurudev"), not a fixed union -- categories are admin-editable, see
 * shared/gallery-categories.ts and worker/api/gallery-categories.ts. */
export interface GalleryImageDTO {
  id: string;
  src: string;
  altText: string;
  caption: string;
  category: string;
  displayOrder: number;
  published: boolean;
  createdAt: string;
  uploadedBy: string;
}

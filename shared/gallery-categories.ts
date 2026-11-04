// Fixed Phase-1 gallery categories (see "Needs your decision" section of
// docs/admin-panel-architecture.html -- categories-fixed-or-editable).
// Shared between the frontend category picker and the worker's validation
// logic so the two can never drift apart.
export const GALLERY_CATEGORIES = [
  "Gurudev",
  "Kriya Yoga Mission",
  "Guru Purnima 2026",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export function isGalleryCategory(value: string): value is GalleryCategory {
  return (GALLERY_CATEGORIES as readonly string[]).includes(value);
}

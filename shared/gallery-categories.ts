// Gallery categories are admin-editable (add/rename/delete from the admin
// panel, reflected on the public site) -- see
// worker/api/gallery-categories.ts for the CRUD API and
// migrations/0007_create_gallery_categories.sql for the backing table.
// This used to be a fixed, hardcoded array; that decision is reversed now,
// so this file only holds the shared shape, not a fixed list of values.

/** Shape returned by both the admin-facing (/api/gallery-categories) and
 * public, read-only (/api/public/gallery-categories) category endpoints.
 * `slug` is generated once at creation time and never changes even if
 * `name` is later renamed -- see worker/api/gallery-categories.ts -- so
 * anything keyed off the slug (e.g. the public site's CSS class / data
 * attribute for its category filter tabs) stays stable across a rename. */
export interface GalleryCategoryDTO {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
}

/** Turns a free-form category name into a URL/attribute-safe slug:
 * lowercase, non-alphanumeric runs collapsed to a single hyphen, no
 * leading/trailing hyphens. Shared so the admin Worker (assigning a slug
 * at category-creation time) and the public site (falling back to this
 * same logic for any category name it doesn't recognize from the fetched
 * list, e.g. a stale build) can never produce two different slugs for
 * the same name. */
export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

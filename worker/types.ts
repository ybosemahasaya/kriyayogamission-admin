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
  /** Cloudflare Workers Builds "Deploy Hook" URL for the kriyayogamission-dev
   * project's `dev` branch. Posting to this URL (no auth needed -- the URL
   * itself is the credential) starts a new build/deploy, same as a human
   * pushing a commit. Used to auto-trigger a dev rebuild after gallery
   * changes; see worker/lib/deploy-hook.ts. Dev-only by design: there is
   * deliberately no production equivalent configured. */
  DEPLOY_HOOK_URL?: string;
  /** GA4 Data API credentials for the Analytics dashboard. GA4_PROPERTY_ID
   * is not sensitive (just an identifier, visible in GA's own UI URLs)
   * and lives as a plain var in wrangler.jsonc; everything else below is
   * a real credential and must be set via `wrangler secret put`, never
   * committed. Two auth flavors (see worker/lib/google-auth.ts) -- set
   * EITHER the OAuth trio (preferred: no service-account key file ever
   * needed, works even when an org policy blocks key creation) OR the
   * service-account pair, not both. All optional so the Worker still
   * runs with a clear 503 (see worker/api/analytics.ts) before they're
   * configured, same pattern as GALLERY_BUCKET/DB above. */
  GA4_PROPERTY_ID?: string;
  GA4_OAUTH_CLIENT_ID?: string;
  GA4_OAUTH_CLIENT_SECRET?: string;
  GA4_OAUTH_REFRESH_TOKEN?: string;
  GA4_SERVICE_ACCOUNT_EMAIL?: string;
  GA4_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  /** Search Console property identifier, e.g. "sc-domain:kriyayogamission.org"
   * for a domain property (vs. a URL-prefix property's literal site URL).
   * Reuses the exact same GA4_* credentials above -- Search Console is just
   * a different scope/API on the same service account or OAuth grant, see
   * worker/lib/google-auth.ts resolveGoogleCredentials(). Not sensitive,
   * same reasoning as GA4_PROPERTY_ID. */
  GSC_SITE_URL?: string;
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
  uploaded_by: string;
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
    uploadedBy: row.uploaded_by,
  };
}

import type { GalleryImageDTO } from "../shared/gallery-image";
import type { ContactMessageDTO, ContactMessageStatus } from "../shared/contact-messages";

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
   * changes; see worker/lib/deploy-hook.ts. */
  DEPLOY_HOOK_URL?: string;
  /** Cloudflare Workers Builds "Deploy Hook" URL for the production
   * kriyayogamission project's `main` branch. Added 2026-11-06, per
   * explicit request, so admin uploads reach https://kriyayogamission.org/gallery
   * at the same time as https://dev.kriyayogamission.org/gallery, not just
   * dev. Requires ADMIN_GALLERY_API_URL to also be set as a Build variable
   * on the production Cloudflare project (Gallery.astro's fetch is already
   * environment-agnostic -- this is the other half, the thing that actually
   * triggers a production build). Silent no-op if unset. See
   * worker/lib/deploy-hook.ts. */
  PROD_DEPLOY_HOOK_URL?: string;
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
  /** Resend API key, for GET /emails (email-metrics.ts). Deliberately a
   * BRAND NEW, separate key from the public site's own RESEND_API_KEY --
   * named distinctly (_ADMINPANEL suffix) at the user's explicit request
   * so there's zero chance of this ever being confused with, or
   * accidentally overwriting, the production sending key. This key only
   * ever needs read access (GET /emails); it should never be used to
   * send mail. Set via `wrangler secret put RESEND_API_KEY_ADMINPANEL`
   * on THIS project. */
  RESEND_API_KEY_ADMINPANEL?: string;
  /** Shared secret the public site's worker.js sends as `Authorization:
   * Bearer <token>` when POSTing to /api/public/contact-messages. Without
   * this, anyone who finds that URL could write fake contact messages
   * straight into D1. Mirrors the "URL itself is the credential"
   * simplicity of worker/lib/deploy-hook.ts, just as a header instead of
   * a secret path, since this endpoint's path is otherwise guessable.
   * Must be set to the SAME value via `wrangler secret put
   * CONTACT_INGEST_TOKEN` on both this Worker and the public site's
   * Worker -- the latter requires explicit human sign-off per the
   * STRICT RESTRICTION banner, see docs/admin-panel-architecture.html. */
    CONTACT_INGEST_TOKEN?: string;
  /** Cloudflare GraphQL Analytics API credentials, for the "Edge
   * Analytics" dashboard card (see docs/admin-panel-architecture.html
   * Phase 3, "cloudflare-web-analytics"). This is READ-ONLY querying of
   * Cloudflare's own edge logs for the PUBLIC site's zone
   * (kriyayogamission.org) via their public GraphQL API -- it never
   * modifies the public site's repo, Worker, or config, so it does not
   * violate the "never touch the public site" restriction above.
   * CLOUDFLARE_ZONE_ID is not sensitive (visible in the Cloudflare
   * dashboard's zone Overview page to anyone with access) and lives as
   * a plain var in wrangler.jsonc, same reasoning as GA4_PROPERTY_ID.
   * CLOUDFLARE_API_TOKEN is a real credential -- set via
   * `wrangler secret put CLOUDFLARE_API_TOKEN`, never committed. */
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export interface GalleryImageRow {
  id: string;
  r2_key: string;
  alt_text: string;
  caption: string;
  category: string;
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

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  message: string;
  status: ContactMessageStatus;
  email_sent: number; // D1/SQLite has no boolean type -- 0 or 1
  resend_message_id: string | null;
  source_ip: string | null;
  created_at: string;
  backfilled: number; // 0 or 1 -- see migrations/0005_add_contact_messages_backfilled.sql
}

export function contactMessageRowToDTO(row: ContactMessageRow): ContactMessageDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    message: row.message,
    status: row.status,
    emailSent: row.email_sent === 1,
    resendMessageId: row.resend_message_id,
    createdAt: row.created_at,
    backfilled: row.backfilled === 1,
  };
}

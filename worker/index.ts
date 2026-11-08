import { handleAnalyticsRealtimeRequest, handleAnalyticsSummaryRequest } from "./api/analytics";
import { handleAccessLoginsRequest, handleCachePurgeRequest, handleDnsRecordsRequest, handleSslStatusRequest, handleZarazConfigRequest } from "./api/cf-ops";
import { handleApiObservabilityRequest } from "./api/api-observability";
import { handleWorkerLogsRequest } from "./api/worker-logs";
import { handleContactMessagesBackfillRequest, handleContactMessagesRequest } from "./api/contact-messages";
import { handleEdgeAnalyticsRequest } from "./api/edge-analytics";
import { handleContactsRequest } from "./api/contacts";
import { handleEmailMetricsRequest } from "./api/email-metrics";
import { handleBulkGalleryRequest, handleGalleryRequest } from "./api/gallery";
import { handleGalleryCategoriesRequest } from "./api/gallery-categories";
import { handleImageRequest } from "./api/images";
import { handlePublicContactRequest } from "./api/public-contact";
import { handlePublicGalleryRequest } from "./api/public-gallery";
import { handlePublicGalleryCategoriesRequest } from "./api/public-gallery-categories";
import { handleSearchConsoleRequest } from "./api/search-console";
import {
  handleSiteAuditLatestRequest,
  handleSiteAuditRunDetailRequest,
  handleSiteAuditRunRequest,
  handleSiteAuditRunsRequest,
} from "./api/site-audit";
import { errorResponse } from "./lib/http";
import { recordApiMetric } from "./lib/api-metrics";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const response = await routeRequest(request, env, ctx);
    // Fire-and-forget (see recordApiMetric -- it internally uses
    // ctx.waitUntil and never throws), timed around the ENTIRE routing
    // chain below rather than inside each individual handler, so adding
    // this didn't require touching a single one of the existing route
    // blocks.
    recordApiMetric(env, ctx, {
      method: request.method,
      pathname: new URL(request.url).pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  },
} satisfies ExportedHandler<Env>;

async function routeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Public, unauthenticated landing page. Cloudflare Access has no way
    // to isolate the bare "/" path from "the whole domain" -- an empty
    // Access application Path matches the apex AND everything beneath it,
    // and a literal "/" gets silently normalized to that same empty/
    // everything state (confirmed: it collided with the main admin app's
    // destination, which also has no path set). So this lives at
    // "/welcome" instead -- an ordinary non-root path, which Access can
    // bypass individually exactly like the existing /images/* bypass,
    // without touching protection on /app or /api/gallery*.
    if (url.pathname === "/welcome" && request.method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/landing", url), request));
    }

    // Identity for the Profile menu. Cloudflare Access injects this
    // header on every request it has already authenticated -- no JWT
    // verification, no secrets, no separate Access API call needed, we
    // just read what Cloudflare already put there. Returns null (not an
    // error) when the header is absent, which is always the case in
    // local dev where there's no Access layer at all.
    if (url.pathname === "/api/me" && request.method === "GET") {
      const email = request.headers.get("Cf-Access-Authenticated-User-Email");
      return Response.json({ email: email ?? null });
    }

    // Realtime checked before the generic /api/analytics matcher below
    // for the same reason /api/gallery/bulk is checked before /api/gallery
    // -- otherwise "realtime" risks being parsed as a route param.
    if (url.pathname === "/api/analytics/realtime" && request.method === "GET") {
      try {
        return await handleAnalyticsRealtimeRequest(request, env);
      } catch (err) {
        console.error("Analytics realtime API error:", err);
        // Surface the real reason (Google's own error text, e.g. "API not
        // enabled" or "permission denied") -- this route sits behind
        // Cloudflare Access, so an authenticated admin seeing the cause
        // is worth more here than hiding implementation details.
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/analytics" && request.method === "GET") {
      try {
        return await handleAnalyticsSummaryRequest(request, env);
      } catch (err) {
        console.error("Analytics API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    // Cloudflare GraphQL Analytics API -- see worker/api/edge-analytics.ts
    // and shared/edge-analytics.ts for why this is a separate data source
    // from both GA4 and Workers Analytics Engine.
    if (url.pathname === "/api/edge-analytics" && request.method === "GET") {
      try {
        return await handleEdgeAnalyticsRequest(request, env);
      } catch (err) {
        console.error("Edge analytics API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    // Cloudflare zone "operations" widgets on the Edge Analytics page --
    // see worker/api/cf-ops.ts. Read-only SSL status + the one narrow
    // write action (purge cache), nothing else.
    if (url.pathname === "/api/cf-ops/ssl-status" && request.method === "GET") {
      try {
        return await handleSslStatusRequest(env);
      } catch (err) {
        console.error("SSL status API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/cf-ops/cache-purge" && request.method === "POST") {
      try {
        return await handleCachePurgeRequest(request, env);
      } catch (err) {
        console.error("Cache purge API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/cf-ops/dns-records" && request.method === "GET") {
      try {
        return await handleDnsRecordsRequest(env);
      } catch (err) {
        console.error("DNS records API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/cf-ops/access-logs" && request.method === "GET") {
      try {
        return await handleAccessLoginsRequest(env);
      } catch (err) {
        console.error("Access login logs API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/cf-ops/zaraz-config" && request.method === "GET") {
      try {
        return await handleZarazConfigRequest(env);
      } catch (err) {
        console.error("Zaraz config API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/observability/api-metrics" && request.method === "GET") {
      try {
        return await handleApiObservabilityRequest(env);
      } catch (err) {
        console.error("API observability error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    const workerLogsMatch = url.pathname.match(/^\/api\/worker-logs\/([^/]+)$/);if (workerLogsMatch && request.method === "GET") {
      try {
        return await handleWorkerLogsRequest(env, workerLogsMatch[1]);
      } catch (err) {
        console.error("Worker logs API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/search-console" && request.method === "GET") {
      try {
        return await handleSearchConsoleRequest(request, env);
      } catch (err) {
        console.error("Search Console API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    // Mini Site Audit (see docs/admin-panel-architecture.html's
    // "mini-site-audit" roadmap item). /run triggers a fresh crawl of
    // this site's own public pages; /latest and /runs are read-only.
    if (url.pathname === "/api/site-audit/run") {
      try {
        return await handleSiteAuditRunRequest(request, env);
      } catch (err) {
        console.error("Site audit run API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    if (url.pathname === "/api/site-audit/latest" && request.method === "GET") {
      try {
        return await handleSiteAuditLatestRequest(env);
      } catch (err) {
        console.error("Site audit latest API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    if (url.pathname === "/api/site-audit/runs" && request.method === "GET") {
      try {
        return await handleSiteAuditRunsRequest(env);
      } catch (err) {
        console.error("Site audit runs API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    const siteAuditRunDetailMatch = url.pathname.match(/^\/api\/site-audit\/runs\/([^/]+)$/);
    if (siteAuditRunDetailMatch && request.method === "GET") {
      try {
        return await handleSiteAuditRunDetailRequest(env, siteAuditRunDetailMatch[1]);
      } catch (err) {
        console.error("Site audit run detail API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Everything this Worker owns lives under /api/* (plus /images/*, see
    // below). Anything else falls through to the static React build via
    // the ASSETS binding -- same pattern the public site's worker.js uses.

    // Unauthenticated, read-only: fetched at build time by the main site
    // to render the public gallery. Only ever returns published rows.
    if (url.pathname === "/api/public/gallery" && request.method === "GET") {
      try {
        return await handlePublicGalleryRequest(request, env);
      } catch (err) {
        console.error("Public gallery API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Unauthenticated, read-only: fetched at build time by the main site
    // to render its category filter tabs dynamically instead of a
    // hardcoded list. See worker/api/gallery-categories.ts for the
    // authenticated CRUD side of this.
    if (url.pathname === "/api/public/gallery-categories" && request.method === "GET") {
      try {
        return await handlePublicGalleryCategoriesRequest(env);
      } catch (err) {
        console.error("Public gallery categories API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Unauthenticated-by-Access write endpoint for the public site's own
    // worker.js to POST/PATCH into -- guarded by a shared-secret bearer
    // token instead (see worker/types.ts CONTACT_INGEST_TOKEN). Checked
    // before the generic /api/contact-messages matcher below since both
    // share a similar path shape.
    const publicContactMatch = url.pathname.match(/^\/api\/public\/contact-messages(?:\/([^/]+))?\/?$/);
    if (publicContactMatch) {
      try {
        return await handlePublicContactRequest(request, env, publicContactMatch[1] ?? null);
      } catch (err) {
        console.error("Public contact ingest API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Email-send metrics for the admin dashboard, sourced from Resend's
    // own API -- see shared/email-metrics.ts.
    if (url.pathname === "/api/email-metrics" && request.method === "GET") {
      try {
        return await handleEmailMetricsRequest(env);
      } catch (err) {
        console.error("Email metrics API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    // Deduplicated "who has contacted us" directory -- see shared/contacts.ts.
    if (url.pathname === "/api/contacts" && request.method === "GET") {
      try {
        return await handleContactsRequest(env);
      } catch (err) {
        console.error("Contacts directory API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    // Checked before the generic /api/contact-messages/:id matcher below
    // -- otherwise "backfill-from-resend" would be parsed as a message id.
    if (url.pathname === "/api/contact-messages/backfill-from-resend" && request.method === "POST") {
      try {
        return await handleContactMessagesBackfillRequest(env);
      } catch (err) {
        console.error("Contact messages backfill API error:", err);
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(message, 500);
      }
    }

    // Admin-facing contact-message triage (list/mark read-or-replied/
    // delete), behind Cloudflare Access same as /api/gallery.
    const contactMessagesMatch = url.pathname.match(/^\/api\/contact-messages(?:\/([^/]+))?\/?$/);
    if (contactMessagesMatch) {
      try {
        return await handleContactMessagesRequest(request, env, contactMessagesMatch[1] ?? null);
      } catch (err) {
        console.error("Contact messages API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Unauthenticated image bytes, served straight from R2 so the bucket
    // itself never needs to go public. Lives outside /api/ on purpose.
    const imageMatch = url.pathname.match(/^\/images\/(.+)$/);
    if (imageMatch) {
      try {
        return await handleImageRequest(env, imageMatch[1]);
      } catch (err) {
        console.error("Image serving error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Bulk select-and-act (edit many / delete many at once from the admin
    // UI). Checked before the generic :id matcher below -- otherwise
    // "bulk" would be parsed as an image id instead of routing here.
    if (url.pathname === "/api/gallery/bulk" && (request.method === "PATCH" || request.method === "DELETE")) {
      try {
        return await handleBulkGalleryRequest(request, env, ctx);
      } catch (err) {
        console.error("Bulk gallery API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    // Admin-facing category management (add/rename/delete) -- behind
    // Cloudflare Access same as /api/gallery. Checked before the generic
    // /api/gallery(?:/:id)? matcher purely for readability; the two
    // paths don't actually overlap ("gallery-categories" never matches
    // "gallery" followed by "/" or end-of-string).
    const galleryCategoriesMatch = url.pathname.match(/^\/api\/gallery-categories(?:\/([^/]+))?\/?$/);
    if (galleryCategoriesMatch) {
      try {
        return await handleGalleryCategoriesRequest(request, env, galleryCategoriesMatch[1] ?? null, ctx);
      } catch (err) {
        console.error("Gallery categories API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    const galleryMatch = url.pathname.match(/^\/api\/gallery(?:\/([^/]+))?\/?$/);
    if (galleryMatch) {
      try {
        return await handleGalleryRequest(request, env, galleryMatch[1] ?? null, ctx);
      } catch (err) {
        console.error("Gallery API error:", err);
        return errorResponse("Internal server error", 500);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return errorResponse("Not found", 404);
    }

    return env.ASSETS.fetch(request);
}

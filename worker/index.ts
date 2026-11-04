import { handleBulkGalleryRequest, handleGalleryRequest } from "./api/gallery";
import { handleImageRequest } from "./api/images";
import { handlePublicGalleryRequest } from "./api/public-gallery";
import { errorResponse } from "./lib/http";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Public, unauthenticated landing page -- this is the one path that
    // needs an explicit bypass in the Cloudflare Access policy (same
    // category as /api/public/gallery and /images/* below), since Access
    // otherwise gates this whole domain at the edge and a never-logged-in
    // visitor needs to see our branding before hitting Cloudflare's real
    // login screen. Everything else -- /app, /api/gallery*, etc. -- stays
    // fully protected; see public/landing.html for why this is a single
    // self-contained file with no further asset requests to bypass.
    //
    // Fetches the clean "/landing" path, not "/landing.html" -- Workers
    // Assets 307-redirects .html requests to their extension-less form,
    // and fetch() auto-follows redirects, which would otherwise bounce
    // this to a path that isn't a literal file and land on the SPA
    // fallback (index.html) instead of our landing page.
    if (url.pathname === "/" && request.method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/landing", url), request));
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
  },
} satisfies ExportedHandler<Env>;

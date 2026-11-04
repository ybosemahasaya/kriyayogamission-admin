import { handleGalleryRequest } from "./api/gallery";
import { handleImageRequest } from "./api/images";
import { handlePublicGalleryRequest } from "./api/public-gallery";
import { errorResponse } from "./lib/http";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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

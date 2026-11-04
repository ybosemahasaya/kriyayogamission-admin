import { handleGalleryRequest } from "./api/gallery";
import { errorResponse } from "./lib/http";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Everything this Worker owns lives under /api/*. Anything else falls
    // through to the static React build via the ASSETS binding -- same
    // pattern the public site's worker.js already uses.
    const galleryMatch = url.pathname.match(/^\/api\/gallery(?:\/([^/]+))?\/?$/);
    if (galleryMatch) {
      try {
        return await handleGalleryRequest(request, env, galleryMatch[1] ?? null);
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

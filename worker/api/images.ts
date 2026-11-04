import { errorResponse } from "../lib/http";
import type { Env } from "../types";

/**
 * Streams a single image straight out of R2 by its key. Keeps the bucket
 * itself private -- the public site (and anyone else) only ever reaches
 * images through this Worker, never a public R2 URL or dashboard toggle.
 */
export async function handleImageRequest(env: Env, key: string): Promise<Response> {
  if (!env.GALLERY_BUCKET) {
    return errorResponse("Gallery storage is not provisioned yet.", 503);
  }

  const object = await env.GALLERY_BUCKET.get(key);
  if (!object) return errorResponse("Image not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

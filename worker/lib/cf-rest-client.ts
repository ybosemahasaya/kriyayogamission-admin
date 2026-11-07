/**
 * Thin wrapper around Cloudflare's regular REST API v4
 * (https://api.cloudflare.com/client/v4/...) -- distinct from
 * worker/lib/cf-graphql-client.ts, which talks to the separate GraphQL
 * Analytics endpoint. Cache Purge and SSL certificate status are plain
 * REST resources, not analytics datasets, so they go through here.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

interface CfApiError {
  code: number;
  message: string;
}

interface CfApiEnvelope<T> {
  success: boolean;
  errors: CfApiError[];
  result: T;
}

export async function cfApiRequest<T>(apiToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as CfApiEnvelope<T> | null;

  // Cloudflare's REST API, like its GraphQL one, can return a non-2xx
  // OR a 200 with "success: false" -- check both and surface the real
  // message either way instead of a generic "request failed."
  if (!res.ok || !body || !body.success) {
    const message = body?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || `${res.status} ${res.statusText}`;
    throw new Error(`Cloudflare API request failed: ${message}`);
  }

  return body.result;
}

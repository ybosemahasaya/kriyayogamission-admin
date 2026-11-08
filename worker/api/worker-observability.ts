import { cfApiRequest } from "../lib/cf-rest-client";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

// --- Workers Observability (tail-based tracing): request traces,
// exceptions, slow spans -- a THIRD Cloudflare API surface in this
// project, newer and even less documented than the GraphQL Analytics
// API that turned out to be a dead end for per-script Worker Logs (see
// worker/api/worker-logs.ts for that saga). Both this admin panel's
// Worker and the public site's two Workers already have
// `observability.enabled: true` in their wrangler.jsonc -- Cloudflare
// is already collecting this data, the only open question is how to
// read it back out programmatically.
//
// HONEST CAVEAT, bigger than usual: the exact endpoint path and request
// body shape below are a BEST GUESS based on general knowledge of
// Cloudflare's REST API conventions, not a verified schema. Unlike the
// GraphQL dead end, there's no introspection available for a plain REST
// endpoint -- so this diagnostic handler accepts an optional raw JSON
// body via ?body=<url-encoded-json>, letting the request shape be
// iterated on by just changing the query string and refreshing, rather
// than needing a new code change + deploy for every attempt. Always
// returns both what was SENT and what came back (success or error), so
// each round is self-documenting.
const OBSERVABILITY_QUERY_PATH = (accountId: string) => `/accounts/${accountId}/workers/observability/telemetry/query`;

function defaultQueryBody() {
  const now = Date.now();
  return {
    timeframe: { from: now - 60 * 60 * 1000, to: now },
    limit: 5,
  };
}

export async function handleObservabilityDebugRequest(env: Env, rawBody: string | null): Promise<Response> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Worker Observability is not configured yet.", 503);
  }

  let requestBody: unknown;
  if (rawBody) {
    try {
      requestBody = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON in ?body= query param.", 400);
    }
  } else {
    requestBody = defaultQueryBody();
  }

  const path = OBSERVABILITY_QUERY_PATH(env.CLOUDFLARE_ACCOUNT_ID);

  try {
    const result = await cfApiRequest(env.CLOUDFLARE_API_TOKEN, path, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    return json({ path, requestBody, result });
  } catch (err) {
    // Cloudflare's own validation error message is the whole point of
    // this round-trip -- it usually names the field it expected, which
    // is how the request shape gets corrected without guessing blind.
    return json({ path, requestBody, error: err instanceof Error ? err.message : String(err) });
  }
}

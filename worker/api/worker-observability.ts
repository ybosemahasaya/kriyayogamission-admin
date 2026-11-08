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
// body via ?body=<url-encoded-json> AND an optional path suffix via
// ?path=<suffix>, letting both the request shape and the endpoint
// itself be iterated on by just changing the query string and
// refreshing, rather than needing a new code change + deploy for every
// attempt. Always returns both what was SENT and what came back
// (success or error), so each round is self-documenting.
//
// Round 3 context: "telemetry/query" DOES exist (confirmed -- it
// validates its body with Zod and returned a specific "queryId
// required" error, not a 404). But a random client-generated queryId
// gets "Query not found", suggesting this might be a two-step API:
// register/create a query somewhere else first (which hands back a
// server-generated queryId), then fetch results here using that ID --
// rather than one-shot ad-hoc querying. ?path= exists specifically to
// test that theory against candidate paths like
// "workers/observability/telemetry/queries" (plural, maybe the create
// endpoint) without a redeploy per guess.
const DEFAULT_OBSERVABILITY_PATH = "workers/observability/telemetry/query";

function buildPath(accountId: string, pathOverride: string | null): string {
  const suffix = (pathOverride || DEFAULT_OBSERVABILITY_PATH).replace(/^\/+/, "");
  return `/accounts/${accountId}/${suffix}`;
}

function defaultQueryBody() {
  const now = Date.now();
  return {
    // Round 2: the first attempt 400'd with a Zod validation error --
    // "queryId" (string) is required and wasn't in the first guess.
    // Cloudflare's dashboard likely generates a fresh ID per query it
    // runs; a random UUID should satisfy "some unique string" without
    // needing to know what it's actually used for internally.
    queryId: crypto.randomUUID(),
    timeframe: { from: now - 60 * 60 * 1000, to: now },
    limit: 5,
  };
}

export async function handleObservabilityDebugRequest(
  env: Env,
  rawBody: string | null,
  pathOverride: string | null,
): Promise<Response> {
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

  const path = buildPath(env.CLOUDFLARE_ACCOUNT_ID, pathOverride);

  // Deliberately NOT using worker/lib/cf-rest-client.ts's cfApiRequest
  // here -- its envelope parsing (expects Cloudflare's standard
  // {success, errors, result} shape) swallowed the real error on the
  // first attempt, surfacing only a useless generic "400 Bad Request"
  // with none of Cloudflare's actual explanation. This fetches raw and
  // always returns the full response text verbatim, parsed as JSON only
  // if that succeeds, so nothing Cloudflare actually says gets lost.
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const rawText = await res.text();
  let parsed: unknown = rawText;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Not JSON -- leave parsed as the raw string, still useful to see.
  }

  return json({
    path,
    requestBody,
    httpStatus: res.status,
    response: parsed,
  });
}

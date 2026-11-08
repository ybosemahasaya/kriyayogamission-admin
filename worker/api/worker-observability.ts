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
// CONFIRMED via official docs (fetched live by the web-retriever agent
// from https://developers.cloudflare.com/api/resources/workers/subresources/observability/subresources/telemetry/methods/query
// and the Query Builder page, since Cloudflare's dashboard-facing docs
// for this one aren't as easy to find/guess as the zone-level APIs):
//
// - Endpoint: POST /accounts/{account_id}/workers/observability/telemetry/query
// - Required permission: "Workers Observability Write" (not "Read" --
//   counter-intuitive for a read-only query, but that's what the
//   official API reference names. Add it to the Account-scoped policy
//   row if "Read" alone 403s.)
// - queryId behavior (this is what "Query not found" meant in round 3):
//   when `parameters` is OMITTED, queryId must reference a previously
//   SAVED query (e.g. one created in the dashboard). For ad-hoc
//   queries, `parameters` must be supplied -- then queryId can be any
//   string at all, just an identifier for this one-off run.
// - `view` controls what's returned: "events" (individual log lines),
//   "calculations" (aggregates), "invocations" (grouped by request ID),
//   "traces" (distributed trace summaries -- what we actually want),
//   "agents".
// - Each event/trace carries a `$workers.scriptName` field -- CONFIRMED
//   real, meaning per-script filtering genuinely works here, unlike the
//   GraphQL dataset that turned out to have no such field at all.
//
// Still unverified (no official example shown for a flat, non-nested
// filter): the exact shape of one entry in `parameters.filters`.
// Round 4's Zod error showed a filter entry validates against a UNION
// of two shapes -- a nested "group" filter (kind/filterCombination/
// filters) or a simple typed filter -- and ours matched neither
// because it was missing `type`. Crucially, `key`/`operation`/`value`
// were NOT flagged as invalid in that same error, meaning those three
// field names are right -- only the `type` discriminator
// ("string"|"number"|"boolean", describing the VALUE's type) was
// missing. Added below.
const DEFAULT_OBSERVABILITY_PATH = "workers/observability/telemetry/query";

function buildPath(accountId: string, pathOverride: string | null): string {
  const suffix = (pathOverride || DEFAULT_OBSERVABILITY_PATH).replace(/^\/+/, "");
  return `/accounts/${accountId}/${suffix}`;
}

function defaultQueryBody() {
  const now = Date.now();
  return {
    // Any string is fine here now that `parameters` is present -- this
    // is an ad-hoc query, not a reference to a saved one.
    queryId: "admin-panel-ad-hoc-test",
    timeframe: { from: now - 60 * 60 * 1000, to: now },
    view: "traces",
    limit: 10,
    parameters: {
      datasets: [],
      filterCombination: "and",
      filters: [{ type: "string", key: "$workers.scriptName", operation: "eq", value: "kriyayogamission" }],
      limit: 10,
    },
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

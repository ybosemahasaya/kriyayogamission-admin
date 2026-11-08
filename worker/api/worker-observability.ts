import { WORKER_TARGETS } from "../../shared/worker-logs";
import type {
  ObservabilityEvent,
  ObservabilitySeriesPoint,
  WorkerObservabilitySummaryDTO,
} from "../../shared/worker-observability";
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
    // Round 5: view=traces (distributed trace summaries) succeeded but
    // came back empty for a 1-hour window -- likely because a simple
    // static-asset Worker rarely produces multi-span traces. Switched
    // to view=events (individual request/log entries, what we actually
    // need for exceptions) and widened to 7 days to maximize the
    // chance of seeing real data on this round.
    timeframe: { from: now - 7 * 24 * 60 * 60 * 1000, to: now },
    view: "events",
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

// --- The REAL feature, now that the request shape is confirmed ---
//
// Deliberately loose/partial typing on the raw event shape below -- the
// full $workers.event.request.cf object alone has 50+ fields (TLS
// fingerprints, geolocation, etc.) that this feature has zero interest
// in. Only the handful of fields actually displayed are typed; anything
// else is implicitly `any` via optional chaining, which is the right
// trade-off for a third-party API response this large rather than
// hand-writing an exhaustive interface nobody will read.
interface RawObservabilityEvent {
  timestamp: number;
  source?: { level?: string; message?: string };
  $metadata?: { level?: string; message?: string; requestId?: string };
  $workers?: {
    outcome?: string;
    wallTimeMs?: number;
    cpuTimeMs?: number;
    event?: {
      path?: string;
      request?: { method?: string };
      response?: { status?: number };
    };
  };
}

interface RawSeriesPoint {
  time: string;
  data: Array<{ aggregates?: { _count?: number; _countErrors?: number } }>;
}

interface ObservabilityQueryResult {
  result?: { events?: { events?: RawObservabilityEvent[]; series?: RawSeriesPoint[] } };
}

function mapEvent(e: RawObservabilityEvent): ObservabilityEvent {
  return {
    timestamp: e.timestamp,
    level: e.source?.level ?? e.$metadata?.level ?? "info",
    message: e.source?.message ?? e.$metadata?.message ?? "",
    path: e.$workers?.event?.path ?? null,
    method: e.$workers?.event?.request?.method ?? null,
    status: e.$workers?.event?.response?.status ?? null,
    outcome: e.$workers?.outcome ?? null,
    wallTimeMs: e.$workers?.wallTimeMs ?? null,
    cpuTimeMs: e.$workers?.cpuTimeMs ?? null,
    requestId: e.$metadata?.requestId ?? null,
  };
}

// Each series bucket's `data` array holds zero or one entry in practice
// (one aggregate set per time bucket, for an unfiltered/ungrouped
// query like this one) -- summed defensively rather than assumed to be
// exactly one, in case Cloudflare ever returns multiple groups per
// bucket for a query shape this project hasn't tried yet.
function mapSeriesPoint(p: RawSeriesPoint): ObservabilitySeriesPoint {
  const count = p.data.reduce((sum, d) => sum + (d.aggregates?._count ?? 0), 0);
  const errors = p.data.reduce((sum, d) => sum + (d.aggregates?._countErrors ?? 0), 0);
  return { time: p.time, count, errors };
}

const DEFAULT_OBSERVABILITY_HOURS = 7 * 24;

export async function handleWorkerObservabilityRequest(
  env: Env,
  key: string,
  hoursParam: string | null,
): Promise<Response> {
  const target = WORKER_TARGETS.find((t) => t.key === key);
  if (!target) return errorResponse("Unknown Worker.", 404);

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Worker Observability is not configured yet.", 503);
  }

  // Clamped to a sane range (5 minutes to 30 days) so a malformed or
  // malicious ?hours= value can't turn into an absurd Cloudflare query.
  const parsedHours = hoursParam ? Number(hoursParam) : DEFAULT_OBSERVABILITY_HOURS;
  const hours = Number.isFinite(parsedHours) ? Math.min(Math.max(parsedHours, 1 / 12), 24 * 30) : DEFAULT_OBSERVABILITY_HOURS;

  const now = Date.now();
  // ONE query per Worker, not three -- both "exceptions" and "slowest
  // requests" below are derived from this SAME 100-event sample rather
  // than risking two more unverified filter/orderBy combinations (the
  // confirmed-working shape has no orderBy tested at all; events come
  // back newest-first by default, which is good enough to sample from).
  const requestBody = {
    queryId: `worker-observability-${key}`,
    timeframe: { from: now - hours * 60 * 60 * 1000, to: now },
    view: "events",
    limit: 100,
    parameters: {
      datasets: [],
      filterCombination: "and",
      filters: [{ type: "string", key: "$workers.scriptName", operation: "eq", value: target.scriptName }],
      limit: 100,
    },
  };

  const path = buildPath(env.CLOUDFLARE_ACCOUNT_ID, null);
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Workers Observability query failed: ${res.status} ${text}`);
  }

  const body = (await res.json()) as ObservabilityQueryResult;
  const rawEvents = body.result?.events?.events ?? [];
  const events = rawEvents.map(mapEvent);
  const series = (body.result?.events?.series ?? []).map(mapSeriesPoint);

  // "ok" is the normal/healthy outcome -- anything else (exception,
  // exceededCpu, canceled, etc.) is what "exceptions" means here.
  const recentExceptions = events.filter((e) => e.outcome && e.outcome !== "ok").slice(0, 20);
  const slowestRequests = [...events].sort((a, b) => (b.wallTimeMs ?? 0) - (a.wallTimeMs ?? 0)).slice(0, 10);
  const recentEvents = events.slice(0, 20);

  const payload: WorkerObservabilitySummaryDTO = {
    scriptName: target.scriptName,
    recentExceptions,
    slowestRequests,
    recentEvents,
    series,
    totalRequests: series.reduce((sum, p) => sum + p.count, 0),
    totalErrors: series.reduce((sum, p) => sum + p.errors, 0),
  };

  return json(payload);
}

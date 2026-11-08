import type { Env } from "../types";

/** Route path segments this app actually defines -- anything NOT in this
 * set gets replaced with ":id" when normalizing a path for metrics, so
 * "/api/gallery/abc123" and "/api/gallery/xyz789" group into one
 * "/api/gallery/:id" bucket instead of each dynamic ID becoming its own
 * never-repeated series. Deliberately a flat set (not per-route regexes)
 * so adding a new route here is a one-line addition; forgetting to add
 * one just means that route's own ID-like segments fall back to ":id"
 * too, which is a harmless under-grouping, not a bug. */
const KNOWN_PATH_SEGMENTS = new Set([
  "api", "public", "me", "welcome",
  "analytics", "realtime", "edge-analytics",
  "cf-ops", "ssl-status", "cache-purge", "dns-records", "access-logs", "zaraz-config",
  "search-console",
  "site-audit", "run", "latest", "runs",
  "gallery", "gallery-categories", "bulk",
  "email-metrics", "contacts",
  "contact-messages", "backfill-from-resend",
  "observability", "api-metrics",
  "worker-logs", "admin", "production", "dev",
  "worker-observability", "_debug",
]);

function normalizePath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  return "/" + segments.map((seg) => (KNOWN_PATH_SEGMENTS.has(seg) ? seg : ":id")).join("/");
}

interface ApiMetricInput {
  method: string;
  pathname: string;
  status: number;
  durationMs: number;
}

/** Records one API request as an Analytics Engine data point -- see
 * worker/api/api-observability.ts for how this gets queried back out.
 * Never throws: a metrics-recording bug should never be able to break
 * the actual response a user is waiting on, so every failure mode here
 * (missing binding, write error) just logs and moves on. */
export function recordApiMetric(env: Env, ctx: ExecutionContext, input: ApiMetricInput): void {
  if (!env.API_METRICS) return;

  const path = normalizePath(input.pathname);

  ctx.waitUntil(
    (async () => {
      try {
        // index1: the one dimension we'd filter by most (route), capped
        // at 1 entry by Analytics Engine's own API.
        // blob1/blob2: method, path -- queryable/groupable text fields.
        // double1/double2: duration, status -- queryable/aggregatable
        // numbers (status as a number, not a string blob, so SQL can
        // do "double2 >= 400" directly without casting).
        env.API_METRICS!.writeDataPoint({
          indexes: [path],
          blobs: [input.method, path],
          doubles: [input.durationMs, input.status],
        });
      } catch (err) {
        console.error("Analytics Engine write failed (non-fatal):", err);
      }
    })(),
  );
}

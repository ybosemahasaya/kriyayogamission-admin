import type { ApiDailyPoint, ApiMetricsSummaryDTO, ApiRouteMetric, ApiStatusBucket } from "../../shared/api-observability";
import { queryAnalyticsEngine } from "../lib/analytics-engine-client";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

// Same dataset name configured in wrangler.jsonc's analytics_engine_datasets
// -- the SQL API addresses datasets by name, not by Worker binding name.
const DATASET = "admin_panel_api_metrics";

interface RouteRow {
  method: string;
  path: string;
  requests: number;
  errors: number;
  avg_latency_ms: number;
  max_latency_ms: number;
}

interface TotalsRow {
  requests: number;
  errors: number;
  avg_latency_ms: number;
  max_latency_ms: number;
}

interface DailyRow {
  day: string;
  requests: number;
  errors: number;
}

interface StatusRow {
  status: number;
  count: number;
}

// SUM(_sample_interval) rather than COUNT(*) -- Analytics Engine applies
// adaptive sampling at high write volume, and _sample_interval is how
// many real events one stored row represents. At this project's actual
// traffic, sampling almost certainly never kicks in (COUNT(*) and this
// would be identical), but using the technically-correct form now means
// nothing silently becomes an undercount if traffic ever grows.
const BY_ROUTE_SQL = `
  SELECT
    blob1 AS method,
    blob2 AS path,
    SUM(_sample_interval) AS requests,
    SUM(IF(double2 >= 400, _sample_interval, 0)) AS errors,
    AVG(double1) AS avg_latency_ms,
    MAX(double1) AS max_latency_ms
  FROM ${DATASET}
  WHERE timestamp > NOW() - INTERVAL '7' DAY
  GROUP BY method, path
  ORDER BY requests DESC
  LIMIT 50
`;

const TOTALS_SQL = `
  SELECT
    SUM(_sample_interval) AS requests,
    SUM(IF(double2 >= 400, _sample_interval, 0)) AS errors,
    AVG(double1) AS avg_latency_ms,
    MAX(double1) AS max_latency_ms
  FROM ${DATASET}
  WHERE timestamp > NOW() - INTERVAL '7' DAY
`;

// toDate(timestamp) -- a standard ClickHouse-family function Cloudflare's
// own Analytics Engine examples use, so lower-risk than the more exotic
// string functions status-bucketing would otherwise need. Speaking of
// which: status-code bucketing ("2xx"/"4xx"/etc.) is deliberately done in
// TypeScript below instead of in SQL (e.g. via CONCAT/intDiv) -- fewer
// unverified dialect features in one query is safer than one clever but
// fragile query, same "simple over clever" reasoning as everywhere else
// in this project.
const DAILY_SQL = `
  SELECT
    toDate(timestamp) AS day,
    SUM(_sample_interval) AS requests,
    SUM(IF(double2 >= 400, _sample_interval, 0)) AS errors
  FROM ${DATASET}
  WHERE timestamp > NOW() - INTERVAL '14' DAY
  GROUP BY day
  ORDER BY day ASC
`;

const STATUS_SQL = `
  SELECT
    double2 AS status,
    SUM(_sample_interval) AS count
  FROM ${DATASET}
  WHERE timestamp > NOW() - INTERVAL '7' DAY
  GROUP BY status
  ORDER BY status ASC
`;

function bucketStatuses(rows: StatusRow[]): ApiStatusBucket[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const bucket = `${Math.floor(row.status / 100)}xx`;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + row.count);
  }
  return [...buckets.entries()].map(([bucket, count]) => ({ bucket, count })).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export async function handleApiObservabilityRequest(env: Env): Promise<Response> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("API observability is not configured yet.", 503);
  }

  const [byRouteRows, totalsRows, dailyRows, statusRows] = await Promise.all([
    queryAnalyticsEngine<RouteRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, BY_ROUTE_SQL),
    queryAnalyticsEngine<TotalsRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, TOTALS_SQL),
    queryAnalyticsEngine<DailyRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, DAILY_SQL),
    queryAnalyticsEngine<StatusRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, STATUS_SQL),
  ]);

  const byRoute: ApiRouteMetric[] = byRouteRows.map((r) => ({
    method: r.method,
    path: r.path,
    requests: r.requests,
    errors: r.errors,
    avgLatencyMs: Math.round(r.avg_latency_ms),
    maxLatencyMs: Math.round(r.max_latency_ms),
  }));

  const daily: ApiDailyPoint[] = dailyRows.map((r) => ({ date: r.day, requests: r.requests, errors: r.errors }));

  const totals = totalsRows[0];
  const payload: ApiMetricsSummaryDTO = {
    totalRequests: totals?.requests ?? 0,
    totalErrors: totals?.errors ?? 0,
    avgLatencyMs: totals ? Math.round(totals.avg_latency_ms) : 0,
    maxLatencyMs: totals ? Math.round(totals.max_latency_ms) : 0,
    byRoute,
    daily,
    statusBuckets: bucketStatuses(statusRows),
  };

  return json(payload);
}

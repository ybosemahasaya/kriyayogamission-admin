import type { ApiMetricsSummaryDTO } from "../../shared/api-observability";
import {
  type ContactFunnelOutcome,
  type PublicSiteDailyPoint,
  type PublicSitePathViews,
  type PublicSiteLogsSummaryDTO,
  type PublicSiteStatusBucket,
  type PublicSiteTargetKey,
} from "../../shared/worker-logs";
import { queryAnalyticsEngine } from "../lib/analytics-engine-client";
import { bucketStatuses } from "../lib/status-buckets";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

// --- The saga, for anyone landing on this file cold ---
//
// 1st attempt: Cloudflare's built-in Workers Logs/Observability via the
// account-level GraphQL field `workersInvocationsAdaptiveGroups` --
// guessed, turned out not to exist (confirmed live: "unknown field").
//
// 2nd attempt: schema introspection found the REAL field,
// `workersInvocationsByOwnerAndScriptGroups`. Drilled into its full
// shape (dimensions/sum/filter) via two more introspection rounds --
// confirmed it has ZERO scriptName filter or dimension anywhere. This
// account's only reachable Workers-invocations GraphQL dataset cannot
// distinguish one script's traffic from another's, full stop. Not
// fixable with a different field name -- this is a hard capability
// limit of the account-level GraphQL schema as introspected.
//
// 3rd attempt (this one, working): the public site's own Worker now
// writes its own Analytics Engine data points directly (added to that
// repo with explicit sign-off, since it's a different repo -- see
// worker.js there for the writeDataPoint() calls and exactly what each
// blob/double column means). Read here via the EXACT SAME Analytics
// Engine SQL API client already proven working for this admin panel's
// own metrics (worker/lib/api-metrics.ts + worker/api/api-observability.ts).
//
// Round 2: added error counts + status breakdown to page-view data
// (double2 was already being written, just unused in queries before),
// and a genuine "API health" section for the public site's own
// /api/contact route -- a NEW dataset (kym_public_api_metrics, PENDING
// public-site deploy at the time of this commit) mirroring
// admin_panel_api_metrics's exact shape (method/path/status/duration),
// just with hostname as an extra leading blob to split prod/dev. The
// apiHealth query is isolated in its own try/catch below: until that
// dataset exists on the public site's side, querying it would error,
// and that must NOT take down the traffic/contact-funnel data that
// already works -- same "a missing dataset is expected, not fatal"
// posture as the empty-table-at-first guidance everywhere else.
//
// HONEST CAVEAT, same as api-observability.ts: Cloudflare's Analytics
// Engine SQL dialect isn't formally documented. If a query here errors,
// the message surfaces verbatim in the UI -- same fix-in-one-pass
// pattern as everywhere else.

const TRAFFIC_DATASET = "kym_site_traffic";
const CONTACT_DATASET = "kym_contact_funnel";
const PUBLIC_API_METRICS_DATASET = "kym_public_api_metrics";

// Must match DEV_HOSTNAMES / PRODUCTION_HOSTNAMES in the public site's
// worker.js exactly -- these are how its single Worker-serving-both-
// domains setup gets split back into two separate tabs here.
const HOSTNAME_GROUPS: Record<PublicSiteTargetKey, string[]> = {
  production: ["kriyayogamission.org", "www.kriyayogamission.org"],
  dev: ["dev.kriyayogamission.org", "kriyayogamission-dev.ybosemahasaya.workers.dev"],
};

// Hostnames above are fixed internal constants, never request-supplied,
// so simple string interpolation into the SQL (rather than a
// parameterized query -- the Analytics Engine SQL API doesn't offer
// one) carries no injection risk.
function hostnameFilter(hostnames: string[]): string {
  return hostnames.map((h) => `'${h}'`).join(", ");
}

interface PathRow {
  path: string;
  views: number;
  avg_latency_ms: number;
}

interface TotalsRow {
  views: number;
  error_views: number;
  avg_latency_ms: number;
}

interface DailyRow {
  day: string;
  views: number;
  error_views: number;
}

interface TrafficStatusRow {
  status: number;
  count: number;
}

interface OutcomeRow {
  outcome: string;
  count: number;
}

interface ApiRouteRow {
  method: string;
  path: string;
  requests: number;
  errors: number;
  avg_latency_ms: number;
  max_latency_ms: number;
}

interface ApiTotalsRow {
  requests: number;
  errors: number;
  avg_latency_ms: number;
  max_latency_ms: number;
}

interface ApiDailyRow {
  day: string;
  requests: number;
  errors: number;
}

async function queryPublicApiHealth(
  env: Env,
  hostnames: string,
): Promise<ApiMetricsSummaryDTO | null> {
  // blob1=hostname, blob2=method, blob3=path, double1=duration,
  // double2=status -- same layout as admin_panel_api_metrics, shifted
  // one blob to the right to make room for hostname. See worker.js in
  // the public site repo for the writeDataPoint() call this mirrors.
  const byRouteSql = `
    SELECT
      blob2 AS method,
      blob3 AS path,
      SUM(_sample_interval) AS requests,
      SUM(IF(double2 >= 400, _sample_interval, 0)) AS errors,
      AVG(double1) AS avg_latency_ms,
      MAX(double1) AS max_latency_ms
    FROM ${PUBLIC_API_METRICS_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
    GROUP BY method, path
    ORDER BY requests DESC
    LIMIT 50
  `;

  const totalsSql = `
    SELECT
      SUM(_sample_interval) AS requests,
      SUM(IF(double2 >= 400, _sample_interval, 0)) AS errors,
      AVG(double1) AS avg_latency_ms,
      MAX(double1) AS max_latency_ms
    FROM ${PUBLIC_API_METRICS_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
  `;

  const dailySql = `
    SELECT
      toDate(timestamp) AS day,
      SUM(_sample_interval) AS requests,
      SUM(IF(double2 >= 400, _sample_interval, 0)) AS errors
    FROM ${PUBLIC_API_METRICS_DATASET}
    WHERE timestamp > NOW() - INTERVAL '14' DAY
      AND blob1 IN (${hostnames})
    GROUP BY day
    ORDER BY day ASC
  `;

  const statusSql = `
    SELECT
      double2 AS status,
      SUM(_sample_interval) AS count
    FROM ${PUBLIC_API_METRICS_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
    GROUP BY status
    ORDER BY status ASC
  `;

  try {
    const [routeRows, totalsRows, dailyRows, statusRows] = await Promise.all([
      queryAnalyticsEngine<ApiRouteRow>(env.CLOUDFLARE_API_TOKEN!, env.CLOUDFLARE_ACCOUNT_ID!, byRouteSql),
      queryAnalyticsEngine<ApiTotalsRow>(env.CLOUDFLARE_API_TOKEN!, env.CLOUDFLARE_ACCOUNT_ID!, totalsSql),
      queryAnalyticsEngine<ApiDailyRow>(env.CLOUDFLARE_API_TOKEN!, env.CLOUDFLARE_ACCOUNT_ID!, dailySql),
      queryAnalyticsEngine<TrafficStatusRow>(env.CLOUDFLARE_API_TOKEN!, env.CLOUDFLARE_ACCOUNT_ID!, statusSql),
    ]);

    const totals = totalsRows[0];
    return {
      totalRequests: totals?.requests ?? 0,
      totalErrors: totals?.errors ?? 0,
      avgLatencyMs: totals ? Math.round(totals.avg_latency_ms) : 0,
      maxLatencyMs: totals ? Math.round(totals.max_latency_ms) : 0,
      byRoute: routeRows.map((r) => ({
        method: r.method,
        path: r.path,
        requests: r.requests,
        errors: r.errors,
        avgLatencyMs: Math.round(r.avg_latency_ms),
        maxLatencyMs: Math.round(r.max_latency_ms),
      })),
      daily: dailyRows.map((r) => ({ date: r.day, requests: r.requests, errors: r.errors })),
      statusBuckets: bucketStatuses(statusRows),
    };
  } catch (err) {
    // Expected until the public site's worker.js has the
    // PUBLIC_API_METRICS binding deployed -- the dataset won't exist
    // yet, and querying a nonexistent dataset throws. Not fatal: the
    // rest of this tab's data (traffic, contact funnel) is independent
    // and should still render.
    console.error(`[worker-logs] public API health query failed (expected pre-deploy): ${err}`);
    return null;
  }
}

export async function handleWorkerLogsRequest(env: Env, key: string): Promise<Response> {
  if (key !== "production" && key !== "dev") {
    return errorResponse("Unknown Worker. Expected 'production' or 'dev'.", 404);
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Worker Logs is not configured yet.", 503);
  }

  const hostnames = hostnameFilter(HOSTNAME_GROUPS[key]);

  const byPathSql = `
    SELECT
      blob2 AS path,
      SUM(_sample_interval) AS views,
      AVG(double1) AS avg_latency_ms
    FROM ${TRAFFIC_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
    GROUP BY path
    ORDER BY views DESC
    LIMIT 50
  `;

  const totalsSql = `
    SELECT
      SUM(_sample_interval) AS views,
      SUM(IF(double2 >= 400, _sample_interval, 0)) AS error_views,
      AVG(double1) AS avg_latency_ms
    FROM ${TRAFFIC_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
  `;

  const dailySql = `
    SELECT
      toDate(timestamp) AS day,
      SUM(_sample_interval) AS views,
      SUM(IF(double2 >= 400, _sample_interval, 0)) AS error_views
    FROM ${TRAFFIC_DATASET}
    WHERE timestamp > NOW() - INTERVAL '14' DAY
      AND blob1 IN (${hostnames})
    GROUP BY day
    ORDER BY day ASC
  `;

  const statusSql = `
    SELECT
      double2 AS status,
      SUM(_sample_interval) AS count
    FROM ${TRAFFIC_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
    GROUP BY status
    ORDER BY status ASC
  `;

  // 30-day window, not 7 -- contact submissions are far rarer than page
  // views, a short window would often show nothing at all.
  const contactFunnelSql = `
    SELECT
      blob2 AS outcome,
      SUM(_sample_interval) AS count
    FROM ${CONTACT_DATASET}
    WHERE timestamp > NOW() - INTERVAL '30' DAY
      AND blob1 IN (${hostnames})
    GROUP BY outcome
    ORDER BY count DESC
  `;

  const [pathRows, totalsRows, dailyRows, statusRows, outcomeRows, apiHealth] = await Promise.all([
    queryAnalyticsEngine<PathRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, byPathSql),
    queryAnalyticsEngine<TotalsRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, totalsSql),
    queryAnalyticsEngine<DailyRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, dailySql),
    queryAnalyticsEngine<TrafficStatusRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, statusSql),
    queryAnalyticsEngine<OutcomeRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, contactFunnelSql),
    queryPublicApiHealth(env, hostnames),
  ]);

  const byPath: PublicSitePathViews[] = pathRows.map((r) => ({ path: r.path, views: r.views }));
  const daily: PublicSiteDailyPoint[] = dailyRows.map((r) => ({
    date: r.day,
    views: r.views,
    errorViews: r.error_views,
  }));
  const statusBuckets: PublicSiteStatusBucket[] = bucketStatuses(statusRows);
  const contactFunnel: ContactFunnelOutcome[] = outcomeRows.map((r) => ({ outcome: r.outcome, count: r.count }));

  const totals = totalsRows[0];
  const label = key === "production" ? "Public Site (Production)" : "Public Site (Dev)";

  const payload: PublicSiteLogsSummaryDTO = {
    label,
    totalPageViews: totals?.views ?? 0,
    totalErrorViews: totals?.error_views ?? 0,
    avgLatencyMs: totals ? Math.round(totals.avg_latency_ms) : 0,
    byPath,
    daily,
    statusBuckets,
    contactFunnel,
    totalContactSubmissions: contactFunnel.reduce((sum, o) => sum + o.count, 0),
    apiHealth,
  };

  return json(payload);
}

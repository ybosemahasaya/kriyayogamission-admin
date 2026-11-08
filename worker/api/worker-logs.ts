import {
  type ContactFunnelOutcome,
  type PublicSiteDailyPoint,
  type PublicSitePathViews,
  type PublicSiteLogsSummaryDTO,
  type PublicSiteTargetKey,
} from "../../shared/worker-logs";
import { queryAnalyticsEngine } from "../lib/analytics-engine-client";
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
// Querying across account boundaries isn't needed -- Analytics Engine
// datasets are addressed by name at the SQL layer, readable by any
// Worker/token with Account Analytics: Read on this account, regardless
// of which Worker originally wrote the data.
//
// HONEST CAVEAT, same as api-observability.ts: Cloudflare's Analytics
// Engine SQL dialect isn't formally documented. These queries follow
// the same conventions already confirmed working for admin_panel_api_metrics,
// but querying a DIFFERENT dataset for the first time always carries a
// little risk of a column-name or type mismatch. If this errors, the
// message surfaces verbatim in the UI -- same fix-in-one-pass pattern
// as everywhere else.

const TRAFFIC_DATASET = "kym_site_traffic";
const CONTACT_DATASET = "kym_contact_funnel";

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
  avg_latency_ms: number;
}

interface DailyRow {
  day: string;
  views: number;
}

interface OutcomeRow {
  outcome: string;
  count: number;
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
      AVG(double1) AS avg_latency_ms
    FROM ${TRAFFIC_DATASET}
    WHERE timestamp > NOW() - INTERVAL '7' DAY
      AND blob1 IN (${hostnames})
  `;

  const dailySql = `
    SELECT
      toDate(timestamp) AS day,
      SUM(_sample_interval) AS views
    FROM ${TRAFFIC_DATASET}
    WHERE timestamp > NOW() - INTERVAL '14' DAY
      AND blob1 IN (${hostnames})
    GROUP BY day
    ORDER BY day ASC
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

  const [pathRows, totalsRows, dailyRows, outcomeRows] = await Promise.all([
    queryAnalyticsEngine<PathRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, byPathSql),
    queryAnalyticsEngine<TotalsRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, totalsSql),
    queryAnalyticsEngine<DailyRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, dailySql),
    queryAnalyticsEngine<OutcomeRow>(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ACCOUNT_ID, contactFunnelSql),
  ]);

  const byPath: PublicSitePathViews[] = pathRows.map((r) => ({ path: r.path, views: r.views }));
  const daily: PublicSiteDailyPoint[] = dailyRows.map((r) => ({ date: r.day, views: r.views }));
  const contactFunnel: ContactFunnelOutcome[] = outcomeRows.map((r) => ({ outcome: r.outcome, count: r.count }));

  const totals = totalsRows[0];
  const label = key === "production" ? "Public Site (Production)" : "Public Site (Dev)";

  const payload: PublicSiteLogsSummaryDTO = {
    label,
    totalPageViews: totals?.views ?? 0,
    avgLatencyMs: totals ? Math.round(totals.avg_latency_ms) : 0,
    byPath,
    daily,
    contactFunnel,
    totalContactSubmissions: contactFunnel.reduce((sum, o) => sum + o.count, 0),
  };

  return json(payload);
}

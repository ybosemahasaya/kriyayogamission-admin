import type { EdgeAnalyticsDTO, EdgeAnalyticsRange } from "../../shared/edge-analytics";
import { runCloudflareGraphQL } from "../lib/cf-graphql-client";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

const RANGE_DAYS: Record<EdgeAnalyticsRange, number> = { "7d": 7, "30d": 30 };

function parseRange(value: string | null): EdgeAnalyticsRange {
  return value === "30d" ? "30d" : "7d";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Credentials {
  zoneTag: string;
  apiToken: string;
}

function requireCredentials(env: Env): Credentials | null {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) return null;
  return { zoneTag: env.CLOUDFLARE_ZONE_ID, apiToken: env.CLOUDFLARE_API_TOKEN };
}

// httpRequests1dGroups is the daily-aggregated, NON-sampled dataset --
// exact counts, not the adaptive-sampled near-real-time one. Plenty
// granular for a dashboard card that refreshes on page load, and it's
// the same dataset Cloudflare's own docs use as the GraphQL replacement
// for the classic (now deprecated) zone analytics REST endpoint.
const HTTP_SUMMARY_QUERY = `
  query EdgeHttpSummary($zoneTag: String!, $since: Date!, $until: Date!, $limit: Int!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(limit: $limit, filter: { date_geq: $since, date_leq: $until }, orderBy: [date_ASC]) {
          dimensions { date }
          sum { requests cachedRequests bytes threats }
          uniq { uniques }
        }
      }
    }
  }
`;

// Three aliased calls to the same dataset, each grouped by a different
// single dimension, so one round trip returns "top actions," "top
// blocked paths," and "top source countries" without needing a
// combined/joined dimension set. firewallEventsAdaptiveGroups is sampled
// at high volume like the rest of the "Adaptive" family of datasets --
// fine for a "what's trending" card, not for exact compliance-grade counts.
//
// CONFIRMED 2026-11-08 against kriyayogamission.org (Free plan): this
// dataset returns "zone 'X' does not have access to the path" on Free --
// Cloudflare gates Firewall Events analytics behind Pro plan or higher.
// httpRequests1dGroups above has no such restriction. That's exactly why
// this query is caught independently in the handler below instead of
// Promise.all'd with the http summary -- one plan-gated dataset
// shouldn't block the KPIs/chart that DO work on every plan.
const FIREWALL_BREAKDOWN_QUERY = `
  query EdgeFirewallBreakdown($zoneTag: String!, $since: Time!, $until: Time!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        byAction: firewallEventsAdaptiveGroups(
          limit: 10
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { action }
        }
        byPath: firewallEventsAdaptiveGroups(
          limit: 10
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientRequestPath }
        }
        byCountry: firewallEventsAdaptiveGroups(
          limit: 10
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientCountryName }
        }
      }
    }
  }
`;

interface HttpSummaryResponse {
  viewer: {
    zones: {
      httpRequests1dGroups: {
        dimensions: { date: string };
        sum: { requests: number; cachedRequests: number; bytes: number; threats: number };
        uniq: { uniques: number };
      }[];
    }[];
  };
}

interface FirewallBreakdownResponse {
  viewer: {
    zones: {
      byAction: { count: number; dimensions: { action: string } }[];
      byPath: { count: number; dimensions: { clientRequestPath: string } }[];
      byCountry: { count: number; dimensions: { clientCountryName: string } }[];
    }[];
  };
}

// TEMPORARY diagnostic for a Security Center/DDoS feasibility check
// (2026-11-08): Cloudflare's current docs say Security Events
// (firewallEventsAdaptive) should be available on Free plan, just
// sampled -- but this zone's firewallEventsAdaptiveGroups (the GROUPED
// variant, used above) returned "zone does not have access to the
// path" when tested live. Testing whether the RAW (non-grouped)
// firewallEventsAdaptive behaves differently before concluding this is
// a hard plan block vs. a quirk of the aggregated query specifically.
// Safe to delete once the feasibility question is answered either way.
const RAW_FIREWALL_EVENTS_QUERY = `
  query EdgeFirewallRaw($zoneTag: String!, $since: Time!, $until: Time!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        firewallEventsAdaptive(limit: 5, filter: { datetime_geq: $since, datetime_leq: $until }) {
          action
          clientRequestPath
          clientCountryName
          source
          datetime
        }
      }
    }
  }
`;

export async function handleFirewallDebugRequest(env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Edge analytics is not configured yet.", 503);

  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);

  try {
    const data = await runCloudflareGraphQL(creds.apiToken, RAW_FIREWALL_EVENTS_QUERY, {
      zoneTag: creds.zoneTag,
      since: since.toISOString(),
      until: until.toISOString(),
    });
    return json({ outcome: "success", data });
  } catch (err) {
    return json({ outcome: "error", message: err instanceof Error ? err.message : String(err) });
  }
}

export async function handleEdgeAnalyticsRequest(request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Edge analytics is not configured yet.", 503);

  const range = parseRange(new URL(request.url).searchParams.get("range"));
  const days = RANGE_DAYS[range];

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

  // httpRequests1dGroups is required -- without it there's nothing to
  // show at all, so let a failure here bubble up as a real error (same
  // as before). firewallEventsAdaptiveGroups is queried independently
  // and allowed to fail on its own: dataset/field availability can vary
  // by Cloudflare plan (see cf-graphql-client.ts), and one unavailable
  // dataset shouldn't blank out the KPIs/chart that DID load fine.
  const httpData = await runCloudflareGraphQL<HttpSummaryResponse>(creds.apiToken, HTTP_SUMMARY_QUERY, {
    zoneTag: creds.zoneTag,
    since: isoDate(since),
    until: isoDate(until),
    // +1 so an inclusive since..until date range (both endpoints
    // counted as whole days) never gets truncated by the limit.
    limit: days + 1,
  });

  let firewallData: FirewallBreakdownResponse | null = null;
  let firewallError: string | null = null;
  try {
    firewallData = await runCloudflareGraphQL<FirewallBreakdownResponse>(creds.apiToken, FIREWALL_BREAKDOWN_QUERY, {
      zoneTag: creds.zoneTag,
      since: since.toISOString(),
      until: until.toISOString(),
    });
  } catch (err) {
    firewallError = err instanceof Error ? err.message : String(err);
    console.error("Edge analytics firewall breakdown query failed (non-fatal):", firewallError);
  }

  const httpZone = httpData.viewer.zones[0];
  const daily = (httpZone?.httpRequests1dGroups ?? []).map((row) => ({
    date: row.dimensions.date,
    requests: row.sum.requests,
    cachedRequests: row.sum.cachedRequests,
    bytes: row.sum.bytes,
    threats: row.sum.threats,
    uniques: row.uniq.uniques,
  }));

  const totals = daily.reduce(
    (acc, d) => ({
      totalRequests: acc.totalRequests + d.requests,
      cachedRequests: acc.cachedRequests + d.cachedRequests,
      totalBytes: acc.totalBytes + d.bytes,
      totalThreats: acc.totalThreats + d.threats,
      totalUniques: acc.totalUniques + d.uniques,
    }),
    { totalRequests: 0, cachedRequests: 0, totalBytes: 0, totalThreats: 0, totalUniques: 0 },
  );

  const firewallZone = firewallData?.viewer.zones[0];

  const payload: EdgeAnalyticsDTO = {
    range,
    summary: {
      ...totals,
      cacheHitRatio: totals.totalRequests > 0 ? totals.cachedRequests / totals.totalRequests : 0,
    },
    daily,
    firewallActions: (firewallZone?.byAction ?? []).map((row) => ({ action: row.dimensions.action, count: row.count })),
    firewallTopPaths: (firewallZone?.byPath ?? []).map((row) => ({
      path: row.dimensions.clientRequestPath,
      count: row.count,
    })),
    firewallTopCountries: (firewallZone?.byCountry ?? []).map((row) => ({
      country: row.dimensions.clientCountryName,
      count: row.count,
    })),
    firewallError,
  };

  return json(payload);
}

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

export async function handleEdgeAnalyticsRequest(request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Edge analytics is not configured yet.", 503);

  const range = parseRange(new URL(request.url).searchParams.get("range"));
  const days = RANGE_DAYS[range];

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

  const [httpData, firewallData] = await Promise.all([
    runCloudflareGraphQL<HttpSummaryResponse>(creds.apiToken, HTTP_SUMMARY_QUERY, {
      zoneTag: creds.zoneTag,
      since: isoDate(since),
      until: isoDate(until),
      // +1 so an inclusive since..until date range (both endpoints
      // counted as whole days) never gets truncated by the limit.
      limit: days + 1,
    }),
    runCloudflareGraphQL<FirewallBreakdownResponse>(creds.apiToken, FIREWALL_BREAKDOWN_QUERY, {
      zoneTag: creds.zoneTag,
      since: since.toISOString(),
      until: until.toISOString(),
    }),
  ]);

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

  const firewallZone = firewallData.viewer.zones[0];

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
  };

  return json(payload);
}

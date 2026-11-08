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

// RESOLVED 2026-11-08: firewallEventsAdaptiveGroups (the GROUPED/
// server-side-aggregated variant) returns "zone does not have access to
// the path" on this Free-plan zone -- but the RAW (non-grouped)
// firewallEventsAdaptive field, confirmed live, works fine and returns
// real events (bot-fight-mode challenges, etc.). So this is NOT a hard
// plan block on firewall event data itself -- just the server-side
// GROUP BY/aggregation specifically. Fix: fetch raw events and do the
// action/path/country/source counting ourselves in the handler below,
// same end result, one extra step. "Adaptive" datasets are sampled at
// high volume -- fine for a "what's trending" card, not for exact
// compliance-grade counts, same caveat as before.
//
// `source` is the genuinely new, useful field here -- it's WHICH
// Cloudflare protection mechanism handled the request ("botFight" =
// free Bot Fight Mode, "waf" = managed WAF rules, "linkMaze" =
// anti-scraper honeypot links, etc.), which is actual zone-specific
// threat intel, not just a generic "threats" count.
const FIREWALL_EVENTS_QUERY = `
  query EdgeFirewallEvents($zoneTag: String!, $since: Time!, $until: Time!, $limit: Int!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        firewallEventsAdaptive(
          limit: $limit
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [datetime_DESC]
        ) {
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

// How many raw events to sample per request -- generous enough for a
// meaningful top-10 breakdown on a low/moderate-traffic site, without
// risking Cloudflare's own per-query result caps on Adaptive datasets.
const FIREWALL_EVENTS_SAMPLE_LIMIT = 500;

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

interface RawFirewallEvent {
  action: string;
  clientRequestPath: string;
  clientCountryName: string;
  source: string;
}

interface FirewallEventsResponse {
  viewer: {
    zones: { firewallEventsAdaptive: RawFirewallEvent[] }[];
  };
}

/** Counts occurrences of one field across raw events and returns the
 * top N, descending -- the client-side replacement for what
 * firewallEventsAdaptiveGroups used to do server-side before it turned
 * out to be blocked on this zone's plan while the raw dataset isn't. */
function topCounts<K extends string>(
  events: RawFirewallEvent[],
  key: (e: RawFirewallEvent) => K,
  limit: number,
): { key: K; count: number }[] {
  const counts = new Map<K, number>();
  for (const event of events) {
    const k = key(event);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, count]) => ({ key: k, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
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
  // as before). firewallEventsAdaptive is queried independently and
  // allowed to fail on its own: it's a different dataset from
  // httpRequests1dGroups and there's no guarantee both ever fail/succeed
  // together, so one unavailable dataset shouldn't blank out the
  // KPIs/chart that DID load fine.
  const httpData = await runCloudflareGraphQL<HttpSummaryResponse>(creds.apiToken, HTTP_SUMMARY_QUERY, {
    zoneTag: creds.zoneTag,
    since: isoDate(since),
    until: isoDate(until),
    // +1 so an inclusive since..until date range (both endpoints
    // counted as whole days) never gets truncated by the limit.
    limit: days + 1,
  });

  let firewallEvents: RawFirewallEvent[] = [];
  let firewallError: string | null = null;
  try {
    const firewallData = await runCloudflareGraphQL<FirewallEventsResponse>(creds.apiToken, FIREWALL_EVENTS_QUERY, {
      zoneTag: creds.zoneTag,
      since: since.toISOString(),
      until: until.toISOString(),
      limit: FIREWALL_EVENTS_SAMPLE_LIMIT,
    });
    firewallEvents = firewallData.viewer.zones[0]?.firewallEventsAdaptive ?? [];
  } catch (err) {
    firewallError = err instanceof Error ? err.message : String(err);
    console.error("Edge analytics firewall events query failed (non-fatal):", firewallError);
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

  const payload: EdgeAnalyticsDTO = {
    range,
    summary: {
      ...totals,
      cacheHitRatio: totals.totalRequests > 0 ? totals.cachedRequests / totals.totalRequests : 0,
    },
    daily,
    firewallActions: topCounts(firewallEvents, (e) => e.action, 10).map((r) => ({ action: r.key, count: r.count })),
    firewallTopPaths: topCounts(firewallEvents, (e) => e.clientRequestPath, 10).map((r) => ({
      path: r.key,
      count: r.count,
    })),
    firewallTopCountries: topCounts(firewallEvents, (e) => e.clientCountryName, 10).map((r) => ({
      country: r.key,
      count: r.count,
    })),
    firewallBySource: topCounts(firewallEvents, (e) => e.source, 10).map((r) => ({ source: r.key, count: r.count })),
    firewallSampleSize: firewallEvents.length,
    firewallError,
  };

  return json(payload);
}

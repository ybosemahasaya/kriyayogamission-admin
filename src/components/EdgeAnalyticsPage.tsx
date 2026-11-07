import { useState } from "react";
import type { EdgeAnalyticsRange } from "../../shared/edge-analytics";
import type { Theme } from "../hooks/useTheme";
import { useEdgeAnalytics } from "../hooks/useEdgeAnalytics";
import { useSslStatus } from "../hooks/useSslStatus";
import { formatNumber } from "../lib/format";
import { AnalyticsDonutChart } from "./analytics/AnalyticsDonutChart";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import { CachePurgeButton } from "./edge-analytics/CachePurgeButton";
import { EdgeKpiCards } from "./edge-analytics/EdgeKpiCards";
import { EdgeRequestsChart } from "./edge-analytics/EdgeRequestsChart";
import { SslStatusCard } from "./edge-analytics/SslStatusCard";

const RANGE_OPTIONS: { value: EdgeAnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/** Cloudflare's own GraphQL Analytics API, for the PUBLIC site's zone --
 * server-side truth GA4 structurally cannot see (bot/WAF-blocked
 * requests never run GA4's JS; cached edge responses often never reach
 * an origin at all). See docs/admin-panel-architecture.html Phase 3,
 * "cloudflare-web-analytics," and shared/edge-analytics.ts for why this
 * is intentionally a different data source from both GA4 and Workers
 * Analytics Engine. */
export function EdgeAnalyticsPage({ theme }: { theme: Theme }) {
  const [range, setRange] = useState<EdgeAnalyticsRange>("7d");
  const { data, loading, error, notConfigured } = useEdgeAnalytics(range);
  // Independent hook/endpoint from the range-based analytics above --
  // SSL status doesn't depend on a date range and shouldn't refetch
  // every time the 7d/30d tab changes.
  const sslStatus = useSslStatus();

  return (
    <div className="analytics-page">
      <div className="toolbar analytics-toolbar">
        <div className="tabs">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={range === opt.value ? "tab active" : "tab"}
              onClick={() => setRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {data && (
          <div
            className="analytics-alltime-badge"
            title="Zone-wide requests Cloudflare's edge logged for this range, including traffic GA4 never sees"
          >
            {formatNumber(data.summary.totalRequests)} edge requests this range
          </div>
        )}
      </div>

      {!notConfigured && (sslStatus.data || !sslStatus.loading) && (
        <div className="analytics-kpi-grid">
          {sslStatus.data && <SslStatusCard status={sslStatus.data} />}
          <div className="analytics-kpi-card">
            <span className="analytics-kpi-label">Cache</span>
            <CachePurgeButton />
          </div>
        </div>
      )}

      {notConfigured && (
        <p className="empty-state">
          Edge analytics isn't connected yet -- add CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN to this Worker's
          config/secrets to enable this dashboard. Ask Rio for the step-by-step Cloudflare setup if you haven't done
          it yet.
        </p>
      )}
      {loading && !notConfigured && <p className="empty-state">Loading edge analytics...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && !error && (
        <>
          <EdgeKpiCards summary={data.summary} />

          <EdgeRequestsChart points={data.daily} theme={theme} />

          {data.firewallError ? (
            <p className="form-error">
              WAF/firewall breakdown unavailable: {data.firewallError}
              <br />
              (Common cause: Cloudflare gates Firewall Events analytics behind Pro plan or higher -- a Free-plan
              zone only gets the request-level stats shown above, which don't require this.)
            </p>
          ) : (
            <div className="analytics-chart-row">
              <AnalyticsDonutChart
                title="WAF/firewall actions"
                theme={theme}
                labels={data.firewallActions.map((a) => a.action)}
                values={data.firewallActions.map((a) => a.count)}
              />
              <AnalyticsTable
                title="Top blocked/challenged paths"
                columns={["Path", "Events"]}
                rows={data.firewallTopPaths.map((p) => [p.path, formatNumber(p.count)])}
              />
              <AnalyticsTable
                title="Top source countries"
                columns={["Country", "Events"]}
                rows={data.firewallTopCountries.map((c) => [c.country, formatNumber(c.count)])}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

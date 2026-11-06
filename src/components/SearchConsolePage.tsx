import { useState } from "react";
import type { AnalyticsRange } from "../../shared/analytics";
import type { Theme } from "../hooks/useTheme";
import { useSearchConsole } from "../hooks/useSearchConsole";
import { formatDelta, formatNumber, formatPercent } from "../lib/format";
import { AnalyticsDonutChart } from "./analytics/AnalyticsDonutChart";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import { KeywordRankingsTabs } from "./search-console/KeywordRankingsTabs";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

/** Search Console's own sidebar page under Analytics -- separate from
 * GA4 (see Ga4Page) since they answer different questions: GA4 is "what
 * do visitors do once they're here", Search Console is "how do people
 * find this site in Google search, and for what". */
export function SearchConsolePage({ theme }: { theme: Theme }) {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const { data, loading, error, notConfigured } = useSearchConsole(range);

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
      </div>

      {notConfigured && (
        <p className="empty-state">
          Search Console isn't connected yet -- add GSC_SITE_URL to this Worker's vars and grant its service account
          Restricted access on the property to enable this dashboard.
        </p>
      )}
      {loading && !notConfigured && <p className="empty-state">Loading Search Console data...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && !error && (
        <>
          <div className="analytics-kpi-grid">
            {(
              [
                ["Clicks", data.summary.clicks, formatNumber],
                ["Impressions", data.summary.impressions, formatNumber],
                ["Avg. CTR", data.summary.ctr, formatPercent],
                ["Avg. Position", data.summary.position, (v: number) => v.toFixed(1)],
              ] as const
            ).map(([label, metric, format]) => {
              const delta = formatDelta(metric.current, metric.previous);
              return (
                <div className="analytics-kpi-card" key={label}>
                  <span className="analytics-kpi-label">{label}</span>
                  <span className="analytics-kpi-value">{format(metric.current)}</span>
                  <span className={`analytics-kpi-delta analytics-kpi-delta-${delta.direction}`}>{delta.label}</span>
                </div>
              );
            })}
          </div>

          <div className="analytics-chart-row">
            <KeywordRankingsTabs branded={data.brandedKeywords} nonBranded={data.nonBrandedKeywords} />
          </div>

          <div className="analytics-chart-row">
            <AnalyticsTable
              title="Top pages (search)"
              columns={["Page", "Clicks", "Impressions", "Position"]}
              rows={data.topPages.map((p) => [
                p.page,
                formatNumber(p.clicks),
                formatNumber(p.impressions),
                p.position.toFixed(1),
              ])}
            />
            <AnalyticsDonutChart
              title="Clicks by device"
              theme={theme}
              labels={data.devices.map((d) => d.device)}
              values={data.devices.map((d) => d.clicks)}
            />
          </div>
        </>
      )}
    </div>
  );
}

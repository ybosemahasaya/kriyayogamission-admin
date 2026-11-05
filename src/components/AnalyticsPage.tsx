import { useState } from "react";
import type { AnalyticsRange } from "../../shared/analytics";
import type { Theme } from "../hooks/useTheme";
import { useAnalytics } from "../hooks/useAnalytics";
import { AnalyticsDonutChart } from "./analytics/AnalyticsDonutChart";
import { AnalyticsKpiCards } from "./analytics/AnalyticsKpiCards";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import { AnalyticsTimeseriesChart } from "./analytics/AnalyticsTimeseriesChart";
import { formatDuration, formatNumber } from "../lib/format";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AnalyticsPage({ theme }: { theme: Theme }) {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const { data, loading, error, notConfigured, realtimeUsers } = useAnalytics(range);

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

        {realtimeUsers !== null && (
          <div className="analytics-realtime-badge">
            <span className="analytics-realtime-dot" />
            {formatNumber(realtimeUsers)} active right now
          </div>
        )}
      </div>

      {notConfigured && (
        <p className="empty-state">
          Analytics isn't connected yet -- add the GA4 service account credentials to this Worker's secrets to enable
          this dashboard.
        </p>
      )}
      {loading && !notConfigured && <p className="empty-state">Loading analytics...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && !error && (
        <>
          <AnalyticsKpiCards summary={data.summary} />

          <AnalyticsTimeseriesChart points={data.timeseries} theme={theme} />

          <div className="analytics-chart-row">
            <AnalyticsDonutChart
              title="Traffic channels"
              theme={theme}
              labels={data.channels.map((c) => c.channel)}
              values={data.channels.map((c) => c.sessions)}
            />
            <AnalyticsDonutChart
              title="Devices"
              theme={theme}
              labels={data.devices.map((d) => d.device)}
              values={data.devices.map((d) => d.sessions)}
            />
            <AnalyticsDonutChart
              title="New vs. returning"
              theme={theme}
              labels={data.newVsReturning.map((s) => s.segment)}
              values={data.newVsReturning.map((s) => s.users)}
            />
          </div>

          <div className="analytics-chart-row">
            <AnalyticsTable
              title="Top pages"
              columns={["Page", "Views", "Avg. time"]}
              rows={data.topPages.map((p) => [p.title || p.path, formatNumber(p.views), formatDuration(p.avgDuration)])}
            />
            <AnalyticsTable
              title="Top countries"
              columns={["Country", "Sessions", "Users"]}
              rows={data.geo.map((g) => [g.country, formatNumber(g.sessions), formatNumber(g.users)])}
            />
          </div>
        </>
      )}
    </div>
  );
}

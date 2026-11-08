import type { ApiMetricsSummaryDTO } from "../../../shared/api-observability";
import type { Theme } from "../../hooks/useTheme";
import { formatNumber } from "../../lib/format";
import { ApiRequestsChart } from "../edge-analytics/ApiRequestsChart";
import { AnalyticsDonutChart } from "./AnalyticsDonutChart";
import { AnalyticsTable } from "./AnalyticsTable";

interface Props {
  data: ApiMetricsSummaryDTO | null;
  label: string;
  theme: Theme;
  /** Shown instead of the panel when data is null -- distinct from
   * loading/error states, which the caller handles before this ever
   * renders. Null here specifically means "not instrumented yet", e.g.
   * the public site's API-metrics dataset not deployed yet. */
  notYetInstrumentedMessage?: string;
}

/** Pure presentational API-health widget -- requests/errors/latency KPI,
 * a 14-day trend chart, a status-code donut, and a by-route table.
 * Originally the body of ApiObservabilitySection (the admin panel's own
 * API health); extracted so the exact same rendering also works for the
 * public site's own /api/contact health in WorkerLogsPage, without
 * duplicating this markup for a second, differently-labeled data
 * source. */
export function ApiHealthPanel({ data, label, theme, notYetInstrumentedMessage }: Props) {
  if (!data) {
    return <p className="empty-state">{notYetInstrumentedMessage ?? "No API health data yet."}</p>;
  }

  return (
    <>
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">{label} (7d)</span>
          <span className="analytics-kpi-value">{formatNumber(data.totalRequests)}</span>
          <span className="analytics-kpi-delta">
            {formatNumber(data.totalErrors)} errors -- {data.avgLatencyMs}ms avg / {data.maxLatencyMs}ms max
          </span>
        </div>
      </div>

      <ApiRequestsChart
        points={data.daily}
        theme={theme}
        title={`${label} over time (14d)`}
        emptyMessage="No data yet."
      />

      <div className="analytics-chart-row">
        <AnalyticsDonutChart
          title={`${label}: response status codes (7d)`}
          theme={theme}
          labels={data.statusBuckets.map((b) => b.bucket)}
          values={data.statusBuckets.map((b) => b.count)}
        />
        <AnalyticsTable
          title={`${label} by route (7d)`}
          columns={["Method", "Path", "Requests", "Errors", "Avg ms", "Max ms"]}
          rows={data.byRoute.map((r) => [
            r.method,
            r.path,
            formatNumber(r.requests),
            formatNumber(r.errors),
            String(r.avgLatencyMs),
            String(r.maxLatencyMs),
          ])}
        />
      </div>
    </>
  );
}

import type { AnalyticsSummary } from "../../../shared/analytics";
import { formatDelta, formatDuration, formatNumber, formatPercent } from "../../lib/format";

interface KpiDef {
  key: keyof AnalyticsSummary;
  label: string;
  format: (value: number) => string;
}

const KPI_DEFS: KpiDef[] = [
  { key: "totalUsers", label: "Total Users", format: formatNumber },
  { key: "newUsers", label: "New Users", format: formatNumber },
  { key: "sessions", label: "Sessions", format: formatNumber },
  { key: "engagementRate", label: "Engagement Rate", format: formatPercent },
  { key: "averageSessionDuration", label: "Avg. Session Duration", format: formatDuration },
  { key: "conversions", label: "Conversions", format: formatNumber },
];

/** Every card compares the selected period against the immediately
 * preceding period of the same length (see buildDateRanges in
 * worker/api/analytics.ts) -- a standard "vs. previous period" pattern,
 * not a fixed vs.-last-year comparison. */
export function AnalyticsKpiCards({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="analytics-kpi-grid">
      {KPI_DEFS.map(({ key, label, format }) => {
        const metric = summary[key];
        const delta = formatDelta(metric.current, metric.previous);
        return (
          <div key={key} className="analytics-kpi-card">
            <span className="analytics-kpi-label">{label}</span>
            <span className="analytics-kpi-value">{format(metric.current)}</span>
            <span className={`analytics-kpi-delta analytics-kpi-delta-${delta.direction}`}>{delta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

import type { EdgeAnalyticsSummary } from "../../../shared/edge-analytics";
import { formatBytes, formatNumber, formatPercent } from "../../lib/format";

interface KpiDef {
  key: keyof EdgeAnalyticsSummary;
  label: string;
  format: (value: number) => string;
}

const KPI_DEFS: KpiDef[] = [
  { key: "totalRequests", label: "Total Edge Requests", format: formatNumber },
  { key: "cacheHitRatio", label: "Cache Hit Ratio", format: formatPercent },
  { key: "totalThreats", label: "Threats Mitigated", format: formatNumber },
  { key: "totalUniques", label: "Unique Visitors (edge)", format: formatNumber },
  { key: "totalBytes", label: "Bandwidth Served", format: formatBytes },
];

/** No current-vs-previous delta here (unlike AnalyticsKpiCards) --
 * httpRequests1dGroups is queried for a single range at a time, not two
 * paired windows, so there's nothing to diff against yet. Reuses the
 * same .analytics-kpi-* CSS classes GA4's cards and Site Audit's compare
 * view already use; those classes don't assume a delta is present. */
export function EdgeKpiCards({ summary }: { summary: EdgeAnalyticsSummary }) {
  return (
    <div className="analytics-kpi-grid">
      {KPI_DEFS.map(({ key, label, format }) => (
        <div key={key} className="analytics-kpi-card">
          <span className="analytics-kpi-label">{label}</span>
          <span className="analytics-kpi-value">{format(summary[key])}</span>
        </div>
      ))}
    </div>
  );
}

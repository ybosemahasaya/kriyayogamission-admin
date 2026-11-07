import { useApiObservability } from "../../hooks/useApiObservability";
import { formatNumber } from "../../lib/format";
import { AnalyticsTable } from "../analytics/AnalyticsTable";

/** Self-contained, same independence philosophy as the other cf-ops
 * sections. Deliberately labeled distinctly from everything else on
 * this page -- this is the ADMIN PANEL'S OWN API health (requests to
 * THIS Worker's /api/* routes), sourced from Workers Analytics Engine,
 * not Cloudflare's zone-wide logs for the public site like the rest of
 * Edge Analytics above it. If every route shows 0 requests right after
 * deploying this, that's expected -- it only has data going forward
 * from whenever the Analytics Engine binding first started receiving
 * writes, there's no historical backfill. */
export function ApiObservabilitySection() {
  const { data, loading, error, notConfigured } = useApiObservability();

  if (notConfigured) return null;
  if (loading) return <p className="empty-state">Loading admin API metrics...</p>;
  if (error) return <p className="form-error">Admin API metrics unavailable: {error}</p>;
  if (!data) return null;

  return (
    <div className="analytics-chart-row">
      <div className="analytics-kpi-card">
        <span className="analytics-kpi-label">Admin API requests (7d)</span>
        <span className="analytics-kpi-value">{formatNumber(data.totalRequests)}</span>
        <span className="analytics-kpi-delta">
          {formatNumber(data.totalErrors)} errors -- {data.avgLatencyMs}ms avg
        </span>
      </div>
      <AnalyticsTable
        title="Admin API by route (7d)"
        columns={["Method", "Path", "Requests", "Errors", "Avg ms"]}
        rows={data.byRoute.map((r) => [r.method, r.path, formatNumber(r.requests), formatNumber(r.errors), String(r.avgLatencyMs)])}
      />
    </div>
  );
}

import { useApiObservability } from "../../hooks/useApiObservability";
import type { Theme } from "../../hooks/useTheme";
import { formatNumber } from "../../lib/format";
import { AnalyticsDonutChart } from "../analytics/AnalyticsDonutChart";
import { AnalyticsTable } from "../analytics/AnalyticsTable";
import { ApiRequestsChart } from "./ApiRequestsChart";

/** Self-contained, same independence philosophy as the other cf-ops
 * sections. Deliberately labeled distinctly from everything else on
 * this page -- this is the ADMIN PANEL'S OWN API health (requests to
 * THIS Worker's /api/* routes), sourced from Workers Analytics Engine,
 * not Cloudflare's zone-wide logs for the public site like the rest of
 * Edge Analytics above it. If every route shows 0 requests right after
 * deploying this, that's expected -- it only has data going forward
 * from whenever the Analytics Engine binding first started receiving
 * writes, there's no historical backfill. */
export function ApiObservabilitySection({ theme }: { theme: Theme }) {
  const { data, loading, error, notConfigured } = useApiObservability();

  if (notConfigured) return null;
  if (loading) return <p className="empty-state">Loading admin API metrics...</p>;
  if (error) return <p className="form-error">Admin API metrics unavailable: {error}</p>;
  if (!data) return null;

  return (
    <>
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Admin API requests (7d)</span>
          <span className="analytics-kpi-value">{formatNumber(data.totalRequests)}</span>
          <span className="analytics-kpi-delta">
            {formatNumber(data.totalErrors)} errors -- {data.avgLatencyMs}ms avg / {data.maxLatencyMs}ms max
          </span>
        </div>
      </div>

      <ApiRequestsChart points={data.daily} theme={theme} />

      <div className="analytics-chart-row">
        <AnalyticsDonutChart
          title="Response status codes (7d)"
          theme={theme}
          labels={data.statusBuckets.map((b) => b.bucket)}
          values={data.statusBuckets.map((b) => b.count)}
        />
        <AnalyticsTable
          title="Admin API by route (7d)"
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

import { useState } from "react";
import { WORKER_TARGETS, type WorkerTargetKey, type PublicSiteTargetKey } from "../../shared/worker-logs";
import { ApiObservabilitySection } from "./edge-analytics/ApiObservabilitySection";
import { ApiRequestsChart } from "./edge-analytics/ApiRequestsChart";
import { ApiHealthPanel } from "./analytics/ApiHealthPanel";
import { AnalyticsDonutChart } from "./analytics/AnalyticsDonutChart";
import { useWorkerLogs } from "../hooks/useWorkerLogs";
import { formatNumber } from "../lib/format";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import type { Theme } from "../hooks/useTheme";

/** Three tabs, three different data sources -- see shared/worker-logs.ts
 * for the full saga of why. Admin Panel reuses the existing, already-
 * working ApiObservabilitySection as-is. Production/Dev hit this page's
 * own API, which reads the public site's own Analytics Engine data
 * (page views, contact-form funnel, and its own API health), since
 * Cloudflare's built-in Workers invocation stats turned out unable to
 * distinguish one script from another at the account level. */
export function WorkerLogsPage({ theme }: { theme: Theme }) {
  const [activeKey, setActiveKey] = useState<WorkerTargetKey>(WORKER_TARGETS[0].key);

  return (
    <div className="analytics-page">
      <div className="tabs">
        {WORKER_TARGETS.map((target) => (
          <button
            key={target.key}
            type="button"
            className={activeKey === target.key ? "tab active" : "tab"}
            onClick={() => setActiveKey(target.key)}
          >
            {target.label}
          </button>
        ))}
      </div>

      {activeKey === "admin" ? (
        <ApiObservabilitySection theme={theme} />
      ) : (
        <PublicSiteTab key={activeKey} targetKey={activeKey} theme={theme} />
      )}
    </div>
  );
}

function PublicSiteTab({ targetKey, theme }: { targetKey: PublicSiteTargetKey; theme: Theme }) {
  const { data, loading, error, notConfigured } = useWorkerLogs(targetKey);

  return (
    <>
      {notConfigured && (
        <p className="empty-state">
          Worker Logs isn't connected yet -- add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to this Worker's
          config/secrets to enable this page.
        </p>
      )}
      {loading && !notConfigured && <p className="empty-state">Loading Worker logs...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && !error && (
        <>
          <h3 className="analytics-section-title">Site traffic</h3>

          <div className="analytics-kpi-grid">
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Page views (7d)</span>
              <span className="analytics-kpi-value">{formatNumber(data.totalPageViews)}</span>
              <span className="analytics-kpi-delta">{formatNumber(data.totalErrorViews)} error responses</span>
            </div>
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Avg response time</span>
              <span className="analytics-kpi-value">{data.avgLatencyMs}ms</span>
            </div>
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Contact submissions (30d)</span>
              <span className="analytics-kpi-value">{formatNumber(data.totalContactSubmissions)}</span>
            </div>
          </div>

          <ApiRequestsChart
            points={data.daily.map((d) => ({ date: d.date, requests: d.views, errors: d.errorViews }))}
            theme={theme}
            title="Page views over time (14d)"
            emptyMessage="No traffic data yet."
          />

          <div className="analytics-chart-row">
            <AnalyticsDonutChart
              title="Page response status codes (7d)"
              theme={theme}
              labels={data.statusBuckets.map((b) => b.bucket)}
              values={data.statusBuckets.map((b) => b.count)}
            />
            <AnalyticsTable
              title="Top pages (7d)"
              columns={["Path", "Views"]}
              rows={data.byPath.map((p) => [p.path, formatNumber(p.views)])}
            />
          </div>

          <h3 className="analytics-section-title">Contact form funnel (30d)</h3>
          <AnalyticsTable
            title="Outcomes"
            columns={["Outcome", "Count"]}
            rows={data.contactFunnel.map((o) => [o.outcome, formatNumber(o.count)])}
          />

          <h3 className="analytics-section-title">Public site API health</h3>
          <ApiHealthPanel
            data={data.apiHealth}
            label="/api/contact requests"
            theme={theme}
            notYetInstrumentedMessage="No API health data yet -- this fills in once the public site's own API-metrics instrumentation is deployed."
          />
        </>
      )}
    </>
  );
}

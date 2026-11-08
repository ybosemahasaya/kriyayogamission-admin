import { useState } from "react";
import { WORKER_TARGETS, type WorkerTargetKey, type PublicSiteTargetKey } from "../../shared/worker-logs";
import { ApiObservabilitySection } from "./edge-analytics/ApiObservabilitySection";
import { useWorkerLogs } from "../hooks/useWorkerLogs";
import { formatNumber } from "../lib/format";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import type { Theme } from "../hooks/useTheme";

/** Three tabs, three different data sources -- see shared/worker-logs.ts
 * for the full saga of why. Admin Panel reuses the existing, already-
 * working ApiObservabilitySection as-is. Production/Dev hit this page's
 * own API, which reads the public site's own Analytics Engine data
 * (page views + contact-form funnel), since Cloudflare's built-in
 * Workers invocation stats turned out unable to distinguish one script
 * from another at the account level. */
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
        <PublicSiteTab key={activeKey} targetKey={activeKey} />
      )}
    </div>
  );
}

function PublicSiteTab({ targetKey }: { targetKey: PublicSiteTargetKey }) {
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
          <div className="analytics-kpi-grid">
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Page views (7d)</span>
              <span className="analytics-kpi-value">{formatNumber(data.totalPageViews)}</span>
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

          <AnalyticsTable
            title="Top pages (7d)"
            columns={["Path", "Views"]}
            rows={data.byPath.map((p) => [p.path, formatNumber(p.views)])}
          />

          <AnalyticsTable
            title="Contact form funnel (30d)"
            columns={["Outcome", "Count"]}
            rows={data.contactFunnel.map((o) => [o.outcome, formatNumber(o.count)])}
          />
        </>
      )}
    </>
  );
}

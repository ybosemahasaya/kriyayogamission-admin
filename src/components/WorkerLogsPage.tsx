import { useState } from "react";
import { WORKER_TARGETS, type WorkerTargetKey } from "../../shared/worker-logs";
import { useWorkerLogs } from "../hooks/useWorkerLogs";
import { formatNumber } from "../lib/format";
import { AnalyticsTable } from "./analytics/AnalyticsTable";

/** Cloudflare Workers Logs/Observability (built-in, every plan
 * including Free) -- NOT Logpush (external export, needs Business/
 * Enterprise + a destination, not built here, see
 * docs/admin-panel-architecture.html). One tab per actual deployed
 * Worker under this account -- see shared/worker-logs.ts for why
 * reading the public site's two Workers needs zero changes to that
 * repo. */
export function WorkerLogsPage() {
  const [activeKey, setActiveKey] = useState<WorkerTargetKey>(WORKER_TARGETS[0].key);
  const { data, loading, error, notConfigured } = useWorkerLogs(activeKey);

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

      {notConfigured && (
        <p className="empty-state">
          Worker Logs isn't connected yet -- add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to this Worker's
          config/secrets to enable this page. Ask Rio for the step-by-step Cloudflare setup if you haven't done it
          yet.
        </p>
      )}
      {loading && !notConfigured && <p className="empty-state">Loading Worker logs...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && !error && (
        <>
          <div className="analytics-kpi-grid">
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Requests (7d)</span>
              <span className="analytics-kpi-value">{formatNumber(data.totalRequests)}</span>
            </div>
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Errors (7d)</span>
              <span className="analytics-kpi-value">{formatNumber(data.totalErrors)}</span>
            </div>
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Avg CPU time</span>
              <span className="analytics-kpi-value">{data.avgCpuTimeMs}ms</span>
            </div>
          </div>

          <AnalyticsTable
            title={`${data.label} -- invocation outcomes (7d)`}
            columns={["Status", "Requests"]}
            rows={data.byStatus.map((s) => [s.status, formatNumber(s.requests)])}
          />
        </>
      )}
    </div>
  );
}

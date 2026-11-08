import { useEffect, useMemo, useRef, useState } from "react";
import { WORKER_TARGETS } from "../../shared/worker-logs";
import type { ObservabilityEvent } from "../../shared/worker-observability";
import { useApiObservability } from "../hooks/useApiObservability";
import { useDnsRecords } from "../hooks/useDnsRecords";
import { useEdgeAnalytics } from "../hooks/useEdgeAnalytics";
import { useSslStatus } from "../hooks/useSslStatus";
import { useWorkerLogs } from "../hooks/useWorkerLogs";
import { useWorkerObservability } from "../hooks/useWorkerObservability";
import type { Theme } from "../hooks/useTheme";
import { formatIstDateTime, formatNumber, formatPercent } from "../lib/format";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import { DashboardPanel } from "./dashboard/DashboardPanel";
import { ObservabilityTimeseriesChart } from "./dashboard/ObservabilityTimeseriesChart";
import { RefreshControl } from "./dashboard/RefreshControl";
import { SecurityOverviewPanel } from "./dashboard/SecurityOverviewPanel";
import { StatTile, toneForErrorRate } from "./dashboard/StatTile";
import { TimeRangeSelector } from "./dashboard/TimeRangeSelector";

function eventRow(workerLabel: string, e: ObservabilityEvent): string[] {
  return [
    formatIstDateTime(e.timestamp),
    workerLabel,
    e.outcome ?? e.level,
    e.path ?? e.message,
    e.status != null ? String(e.status) : "",
    e.wallTimeMs != null ? `${e.wallTimeMs}ms` : "",
  ];
}

const MERGED_EVENT_COLUMNS = ["Time", "Worker", "Outcome", "Path", "Status", "Duration"];

function PublicSiteTrafficPanel({
  title,
  logs,
}: {
  title: string;
  logs: ReturnType<typeof useWorkerLogs>;
}) {
  return (
    <DashboardPanel title={title} subtitle="fixed 7d window">
      {logs.notConfigured ? (
        <p className="empty-state">Not configured.</p>
      ) : logs.error ? (
        <p className="form-error">{logs.error}</p>
      ) : (
        <div className="dashboard-stat-row">
          <StatTile label="Page views" value={formatNumber(logs.data?.totalPageViews ?? 0)} />
          <StatTile label="Avg latency" value={`${logs.data?.avgLatencyMs ?? 0}ms`} />
          <StatTile
            label="Contact submissions"
            value={formatNumber(logs.data?.totalContactSubmissions ?? 0)}
            detail="30d"
          />
        </div>
      )}
    </DashboardPanel>
  );
}

/** A custom, Grafana-STYLED dashboard -- not an integration with actual
 * Grafana, just the same visual language (panel grid, stat tiles,
 * time-series charts, a shared time-range + auto-refresh control) built
 * directly into this admin panel on top of data sources that already
 * existed (useWorkerLogs, useApiObservability) or were just built
 * (useWorkerObservability). This page doesn't re-fetch anything new --
 * it's a different VIEW over the same three hooks already used on the
 * Worker Logs page.
 *
 * Honest scope note: the time-range selector only actually drives the
 * Workers Observability panels (useWorkerObservability accepts an hours
 * param end-to-end). The traffic/contact-funnel/API-health panels below
 * still use the fixed windows baked into their own SQL queries -- each
 * of those panels says so in its subtitle rather than silently ignoring
 * the selector. */
export function DashboardPage({ theme }: { theme: Theme }) {
  const [hours, setHours] = useState(24);
  const [refreshSeconds, setRefreshSeconds] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const admin = useWorkerObservability("admin", hours);
  const production = useWorkerObservability("production", hours);
  const dev = useWorkerObservability("dev", hours);
  const productionLogs = useWorkerLogs("production");
  const devLogs = useWorkerLogs("dev");
  const apiObservability = useApiObservability();
  const edgeAnalytics = useEdgeAnalytics("7d");
  const sslStatus = useSslStatus();
  const dnsRecords = useDnsRecords();

  // One ref per hook's reload fn, kept current every render without
  // re-subscribing the interval effect below on every data change --
  // otherwise each successful fetch would reset its own refresh timer.
  const reloaders = useRef({
    admin: admin.reload,
    production: production.reload,
    dev: dev.reload,
    productionLogs: productionLogs.reload,
    devLogs: devLogs.reload,
    apiObservability: apiObservability.reload,
    edgeAnalytics: edgeAnalytics.reload,
    sslStatus: sslStatus.reload,
    dnsRecords: dnsRecords.reload,
  });
  reloaders.current = {
    admin: admin.reload,
    production: production.reload,
    dev: dev.reload,
    productionLogs: productionLogs.reload,
    devLogs: devLogs.reload,
    apiObservability: apiObservability.reload,
    edgeAnalytics: edgeAnalytics.reload,
    sslStatus: sslStatus.reload,
    dnsRecords: dnsRecords.reload,
  };

  function refreshAll() {
    reloaders.current.admin();
    reloaders.current.production();
    reloaders.current.dev();
    reloaders.current.productionLogs();
    reloaders.current.devLogs();
    reloaders.current.apiObservability();
    reloaders.current.edgeAnalytics();
    reloaders.current.sslStatus();
    reloaders.current.dnsRecords();
    setLastRefreshedAt(new Date());
  }

  useEffect(() => {
    if (refreshSeconds <= 0) return;
    const id = setInterval(refreshAll, refreshSeconds * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSeconds]);

  // Stamp "last refreshed" the first time every panel has settled, so
  // the control isn't blank before any manual/auto refresh has fired.
  useEffect(() => {
    if (!admin.loading && !production.loading && !dev.loading && !lastRefreshedAt) {
      setLastRefreshedAt(new Date());
    }
  }, [admin.loading, production.loading, dev.loading, lastRefreshedAt]);

  const mergedExceptions = useMemo(() => {
    const rows = [
      ...(admin.data?.recentExceptions ?? []).map((e) => ({ worker: "Admin Panel", event: e })),
      ...(production.data?.recentExceptions ?? []).map((e) => ({ worker: "Public Site (Prod)", event: e })),
      ...(dev.data?.recentExceptions ?? []).map((e) => ({ worker: "Public Site (Dev)", event: e })),
    ];
    return rows.sort((a, b) => b.event.timestamp - a.event.timestamp).slice(0, 15);
  }, [admin.data, production.data, dev.data]);

  const mergedSlowest = useMemo(() => {
    const rows = [
      ...(admin.data?.slowestRequests ?? []).map((e) => ({ worker: "Admin Panel", event: e })),
      ...(production.data?.slowestRequests ?? []).map((e) => ({ worker: "Public Site (Prod)", event: e })),
      ...(dev.data?.slowestRequests ?? []).map((e) => ({ worker: "Public Site (Dev)", event: e })),
    ];
    return rows.sort((a, b) => (b.event.wallTimeMs ?? 0) - (a.event.wallTimeMs ?? 0)).slice(0, 15);
  }, [admin.data, production.data, dev.data]);

  return (
    <div className="analytics-page dashboard-page">
      <div className="dashboard-controls">
        <TimeRangeSelector hours={hours} onChange={setHours} />
        <RefreshControl
          seconds={refreshSeconds}
          onChange={setRefreshSeconds}
          onRefreshNow={refreshAll}
          lastRefreshedAt={lastRefreshedAt}
        />
      </div>

      <div className="dashboard-grid">
        {WORKER_TARGETS.map((target) => {
          const hook = target.key === "admin" ? admin : target.key === "production" ? production : dev;
          const total = hook.data?.totalRequests ?? 0;
          const errors = hook.data?.totalErrors ?? 0;
          return (
            <DashboardPanel key={target.key} title={target.label} subtitle={`last ${hours}h`}>
              {hook.notConfigured ? (
                <p className="empty-state">Not configured.</p>
              ) : hook.error ? (
                <p className="form-error">{hook.error}</p>
              ) : (
                <div className="dashboard-stat-row">
                  <StatTile label="Requests" value={formatNumber(total)} />
                  <StatTile label="Errors" value={formatNumber(errors)} tone={toneForErrorRate(errors, total)} />
                  <StatTile
                    label="Error rate"
                    value={total > 0 ? formatPercent(errors / total) : "--"}
                    tone={toneForErrorRate(errors, total)}
                  />
                </div>
              )}
            </DashboardPanel>
          );
        })}
      </div>

      <div className="dashboard-grid">
        {WORKER_TARGETS.map((target) => {
          const hook = target.key === "admin" ? admin : target.key === "production" ? production : dev;
          return (
            <DashboardPanel
              key={target.key}
              title={`${target.label} -- requests & errors`}
              subtitle="times in IST"
              span="wide"
            >
              {hook.notConfigured ? (
                <p className="empty-state">Not configured.</p>
              ) : hook.loading ? (
                <p className="empty-state">Loading...</p>
              ) : hook.error ? (
                <p className="form-error">{hook.error}</p>
              ) : (
                <ObservabilityTimeseriesChart points={hook.data?.series ?? []} theme={theme} hours={hours} />
              )}
            </DashboardPanel>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <DashboardPanel title="Recent exceptions (all Workers)" subtitle={`last ${hours}h, IST`} span="wide">
          <AnalyticsTable
            title=""
            columns={MERGED_EVENT_COLUMNS}
            rows={mergedExceptions.map((r) => eventRow(r.worker, r.event))}
          />
        </DashboardPanel>
        <DashboardPanel title="Slowest requests (all Workers)" subtitle={`last ${hours}h, IST`} span="wide">
          <AnalyticsTable
            title=""
            columns={MERGED_EVENT_COLUMNS}
            rows={mergedSlowest.map((r) => eventRow(r.worker, r.event))}
          />
        </DashboardPanel>
      </div>

      <div className="dashboard-grid">
        <SecurityOverviewPanel
          theme={theme}
          edgeAnalytics={edgeAnalytics.data}
          sslStatus={sslStatus.data}
          dnsRecords={dnsRecords.data}
        />
      </div>

      <div className="dashboard-grid">
        <PublicSiteTrafficPanel title="Public site traffic (Production)" logs={productionLogs} />
        <PublicSiteTrafficPanel title="Public site traffic (Dev)" logs={devLogs} />
        <DashboardPanel title="Admin API health" subtitle="fixed 7d window">
          {apiObservability.notConfigured ? (
            <p className="empty-state">Not configured.</p>
          ) : apiObservability.error ? (
            <p className="form-error">{apiObservability.error}</p>
          ) : (
            <div className="dashboard-stat-row">
              <StatTile label="Requests" value={formatNumber(apiObservability.data?.totalRequests ?? 0)} />
              <StatTile
                label="Errors"
                value={formatNumber(apiObservability.data?.totalErrors ?? 0)}
                tone={toneForErrorRate(
                  apiObservability.data?.totalErrors ?? 0,
                  apiObservability.data?.totalRequests ?? 0,
                )}
              />
              <StatTile label="Avg latency" value={`${apiObservability.data?.avgLatencyMs ?? 0}ms`} />
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}

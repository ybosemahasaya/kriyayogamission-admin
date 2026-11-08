import type { ObservabilityEvent } from "../../../shared/worker-observability";
import type { WorkerTargetKey } from "../../../shared/worker-logs";
import { useWorkerObservability } from "../../hooks/useWorkerObservability";
import { AnalyticsTable } from "../analytics/AnalyticsTable";

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function eventRow(e: ObservabilityEvent): string[] {
  return [
    formatTimestamp(e.timestamp),
    e.outcome ?? e.level,
    e.method ?? "",
    e.path ?? e.message,
    e.status != null ? String(e.status) : "",
    e.wallTimeMs != null ? `${e.wallTimeMs}ms` : "",
  ];
}

const EVENT_COLUMNS = ["Time", "Outcome", "Method", "Path", "Status", "Duration"];

/** Cloudflare Workers Observability (tail-based tracing) -- request
 * events, exceptions, and slow spans for ONE Worker script. See
 * shared/worker-observability.ts and worker/api/worker-observability.ts
 * for the full saga of finding this API's real shape (5 rounds of live
 * trial-and-error plus one round of actually reading Cloudflare's docs).
 *
 * Shown on all three Worker Logs tabs (admin/production/dev), unlike
 * ApiHealthPanel/traffic data which are public-site-only -- this
 * queries Cloudflare's own built-in per-script event stream, which
 * exists for every Worker regardless of whether it writes its own
 * custom Analytics Engine data. */
export function ObservabilityEventsSection({ targetKey }: { targetKey: WorkerTargetKey }) {
  const { data, loading, error, notConfigured } = useWorkerObservability(targetKey);

  if (notConfigured) return null;
  if (loading) return <p className="empty-state">Loading request traces...</p>;
  if (error) return <p className="form-error">Workers Observability unavailable: {error}</p>;
  if (!data) return null;

  return (
    <>
      <h3 className="analytics-section-title">Request traces (7d)</h3>

      {data.recentExceptions.length > 0 && (
        <AnalyticsTable
          title={`Exceptions (${data.recentExceptions.length})`}
          columns={EVENT_COLUMNS}
          rows={data.recentExceptions.map(eventRow)}
        />
      )}
      {data.recentExceptions.length === 0 && <p className="empty-state">No exceptions in the last 7 days. </p>}

      <AnalyticsTable
        title="Slowest requests"
        columns={EVENT_COLUMNS}
        rows={data.slowestRequests.map(eventRow)}
      />

      <AnalyticsTable title="Most recent requests" columns={EVENT_COLUMNS} rows={data.recentEvents.map(eventRow)} />
    </>
  );
}

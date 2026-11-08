import { useCallback, useEffect, useState } from "react";
import type { WorkerObservabilitySummaryDTO } from "../../shared/worker-observability";
import type { WorkerTargetKey } from "../../shared/worker-logs";

interface UseWorkerObservabilityResult {
  data: WorkerObservabilitySummaryDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  reload: () => void;
}

/** One call per Worker Logs tab (all three -- admin, production, dev),
 * unlike useWorkerLogs which only covers the two public-site tabs. See
 * shared/worker-observability.ts for what this actually returns.
 *
 * `hoursWindow` drives the dashboard's time-range selector -- the only
 * data source in this project where an arbitrary window is actually
 * wired up end-to-end (the SQL-backed sources in useWorkerLogs/
 * useApiObservability still use fixed windows baked into their SQL).
 * `reload` exists for the dashboard's auto-refresh control. */
export function useWorkerObservability(key: WorkerTargetKey, hoursWindow?: number): UseWorkerObservabilityResult {
  const [data, setData] = useState<WorkerObservabilitySummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    const query = hoursWindow ? `?hours=${hoursWindow}` : "";
    fetch(`/api/worker-observability/${key}${query}`)
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as WorkerObservabilitySummaryDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Worker observability."))
      .finally(() => setLoading(false));
  }, [key, hoursWindow]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured, reload: load };
}

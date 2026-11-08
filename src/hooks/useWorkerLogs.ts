import { useCallback, useEffect, useState } from "react";
import type { WorkerLogSummaryDTO, WorkerTargetKey } from "../../shared/worker-logs";

interface UseWorkerLogsResult {
  data: WorkerLogSummaryDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

/** One hook call per tab on WorkerLogsPage -- refetches whenever the
 * selected Worker changes, same as useEdgeAnalytics refetching on range
 * change. Fixed 7-day window (see worker/api/worker-logs.ts). */
export function useWorkerLogs(key: WorkerTargetKey): UseWorkerLogsResult {
  const [data, setData] = useState<WorkerLogSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch(`/api/worker-logs/${key}`)
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as WorkerLogSummaryDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Worker logs."))
      .finally(() => setLoading(false));
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured };
}

import { useCallback, useEffect, useState } from "react";
import type { PublicSiteLogsSummaryDTO, PublicSiteTargetKey } from "../../shared/worker-logs";

interface UseWorkerLogsResult {
  data: PublicSiteLogsSummaryDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  reload: () => void;
}

/** Only for the two Public Site tabs -- the Admin Panel tab renders
 * ApiObservabilitySection directly instead of using this hook, since
 * that data source already exists and works. See shared/worker-logs.ts
 * for why. */
export function useWorkerLogs(key: PublicSiteTargetKey): UseWorkerLogsResult {
  const [data, setData] = useState<PublicSiteLogsSummaryDTO | null>(null);
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
        return (await res.json()) as PublicSiteLogsSummaryDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Worker logs."))
      .finally(() => setLoading(false));
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured, reload: load };
}

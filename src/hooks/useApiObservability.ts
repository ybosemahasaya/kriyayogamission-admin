import { useCallback, useEffect, useState } from "react";
import type { ApiMetricsSummaryDTO } from "../../shared/api-observability";

interface UseApiObservabilityResult {
  data: ApiMetricsSummaryDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  reload: () => void;
}

/** Same pattern as the other Edge Analytics hooks. Fixed 7-day window
 * (matches worker/api/api-observability.ts's SQL) -- no range selector
 * yet since this widget is new; add one later if it turns out to
 * matter, same YAGNI reasoning as everywhere else in this project. */
export function useApiObservability(): UseApiObservabilityResult {
  const [data, setData] = useState<ApiMetricsSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch("/api/observability/api-metrics")
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as ApiMetricsSummaryDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load API observability."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured, reload: load };
}

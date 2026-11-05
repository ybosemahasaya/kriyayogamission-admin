import { useCallback, useEffect, useState } from "react";
import type { AnalyticsRange } from "../../shared/analytics";
import type { SearchConsoleDTO } from "../../shared/search-console";

interface UseSearchConsoleResult {
  data: SearchConsoleDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

/** Mirrors useAnalytics' summary half -- no realtime equivalent here,
 * Search Console data lags Google's own indexing by ~2-3 days (see
 * DATA_LAG_DAYS in worker/api/search-console.ts) so a "live" poll
 * would just be wasted requests. */
export function useSearchConsole(range: AnalyticsRange): UseSearchConsoleResult {
  const [data, setData] = useState<SearchConsoleDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch(`/api/search-console?range=${range}`)
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as SearchConsoleDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Search Console data."))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured };
}

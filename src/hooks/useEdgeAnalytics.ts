import { useCallback, useEffect, useState } from "react";
import type { EdgeAnalyticsDTO, EdgeAnalyticsRange } from "../../shared/edge-analytics";

interface UseEdgeAnalyticsResult {
  data: EdgeAnalyticsDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  reload: () => void;
}

/** Mirrors useAnalytics.ts's shape/conventions (503 -> "not configured"
 * banner instead of a scary error) -- no realtime polling here, unlike
 * GA4's hook, since Cloudflare's daily-aggregated dataset doesn't update
 * within a browsing session anyway. */
export function useEdgeAnalytics(range: EdgeAnalyticsRange): UseEdgeAnalyticsResult {
  const [data, setData] = useState<EdgeAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch(`/api/edge-analytics?range=${range}`)
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as EdgeAnalyticsDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load edge analytics."))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured, reload: load };
}

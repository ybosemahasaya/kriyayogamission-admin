import { useCallback, useEffect, useState } from "react";
import type { AnalyticsDTO, AnalyticsRange, AnalyticsRealtimeDTO } from "../../shared/analytics";

interface UseAnalyticsResult {
  data: AnalyticsDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  realtimeUsers: number | null;
}

/** Realtime is polled on its own short interval -- it's meant to feel
 * "live", while the rest of the dashboard only needs to reload when the
 * range changes. Keeping them as separate fetches avoids re-running the
 * (much heavier) batched GA4 report call every 30 seconds just to
 * refresh one number. */
const REALTIME_POLL_MS = 30_000;

export function useAnalytics(range: AnalyticsRange): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [realtimeUsers, setRealtimeUsers] = useState<number | null>(null);

  const loadSummary = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch(`/api/analytics?range=${range}`)
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as AnalyticsDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;

    function pollRealtime() {
      fetch("/api/analytics/realtime")
        .then(async (res) => {
          if (res.ok) return res.json() as Promise<AnalyticsRealtimeDTO>;
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        })
        .then((result) => {
          if (!cancelled) setRealtimeUsers(result?.activeUsers ?? null);
        })
        .catch((err) => {
          // Realtime is a small secondary widget -- a failure here
          // shouldn't block the rest of the dashboard, but it's still
          // worth seeing in devtools instead of vanishing silently.
          console.error("Realtime analytics fetch failed:", err instanceof Error ? err.message : err);
          if (!cancelled) setRealtimeUsers(null);
        });
    }

    pollRealtime();
    const interval = setInterval(pollRealtime, REALTIME_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error, notConfigured, realtimeUsers };
}

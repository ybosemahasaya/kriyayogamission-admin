import { useEffect, useState } from "react";
import type { AuditRunDetailDTO } from "../../shared/site-audit";

interface UseAuditRunDetailResult {
  detail: AuditRunDetailDTO | null;
  loading: boolean;
  error: string | null;
}

/** Fetches one specific past run's full pages/issues by id -- separate
 * from useSiteAudit (which only ever tracks the *latest* run) because
 * Compare Crawls needs two arbitrary, independently-selected runs at
 * once. Returns a clean idle state when id is null so a caller can use
 * this before the admin has picked anything yet. */
export function useAuditRunDetail(id: number | null): UseAuditRunDetailResult {
  const [detail, setDetail] = useState<AuditRunDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/site-audit/runs/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as AuditRunDetailDTO;
      })
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load that run.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { detail, loading, error };
}

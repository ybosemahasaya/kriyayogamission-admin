import { useCallback, useEffect, useState } from "react";
import type { AuditRunDetailDTO, AuditRunSummaryDTO } from "../../shared/site-audit";

interface UseSiteAuditResult {
  latest: AuditRunDetailDTO | null;
  history: AuditRunSummaryDTO[];
  loading: boolean;
  running: boolean;
  error: string | null;
  notConfigured: boolean;
  runAudit: () => Promise<void>;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/** Deliberately no auto-refresh/polling here -- a crawl is a manual,
 * on-demand action (see the ask_user_question answer: "Manual trigger
 * only" for the MVP), not something that should silently re-run itself
 * on a timer the way the realtime analytics widget does. */
export function useSiteAudit(): UseSiteAuditResult {
  const [latest, setLatest] = useState<AuditRunDetailDTO | null>(null);
  const [history, setHistory] = useState<AuditRunSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const [latestRes, runsRes] = await Promise.all([fetch("/api/site-audit/latest"), fetch("/api/site-audit/runs")]);
      if (latestRes.status === 503 || runsRes.status === 503) {
        setNotConfigured(true);
        return;
      }
      setLatest(await parseJsonOrThrow<AuditRunDetailDTO | null>(latestRes));
      setHistory(await parseJsonOrThrow<AuditRunSummaryDTO[]>(runsRes));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site audit data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/site-audit/run", { method: "POST" });
      const detail = await parseJsonOrThrow<AuditRunDetailDTO>(res);
      setLatest(detail);
      await load(); // also refreshes the history list with this new run
    } catch (err) {
      setError(err instanceof Error ? err.message : "Site audit crawl failed.");
    } finally {
      setRunning(false);
    }
  }, [load]);

  return { latest, history, loading, running, error, notConfigured, runAudit };
}

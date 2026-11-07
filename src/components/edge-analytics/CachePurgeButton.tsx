import { useState } from "react";
import type { CachePurgeResultDTO } from "../../../shared/cf-ops";
import { RefreshIcon } from "../icons";

/** The one write action anywhere in Edge Analytics -- everything else
 * on this page is read-only. Confirms first (same window.confirm
 * pattern as App.tsx's bulk-delete) since purging cache zone-wide
 * causes a temporary origin load spike as every cached response gets
 * re-fetched; not destructive, but not a click to make by accident
 * either. */
export function CachePurgeButton() {
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePurge() {
    if (!window.confirm("Purge Cloudflare's cache for kriyayogamission.org now? Visitors may see a brief slowdown as pages re-cache.")) {
      return;
    }
    setPurging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cf-ops/cache-purge", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const result = (await res.json()) as CachePurgeResultDTO;
      setMessage(`Cache purged at ${new Date(result.purgedAt).toLocaleTimeString()}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cache purge failed.");
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="toolbar">
      <button type="button" className="btn-secondary" onClick={handlePurge} disabled={purging}>
        <RefreshIcon /> {purging ? "Purging..." : "Purge Cache"}
      </button>
      {message && <span className="contact-backfill-result">{message}</span>}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { AccessLoginEventDTO } from "../../shared/cf-ops";

interface UseAccessLoginsResult {
  data: AccessLoginEventDTO[] | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

/** Distinct "not configured" condition from the other Edge Analytics
 * hooks -- this one needs CLOUDFLARE_ACCOUNT_ID specifically (see
 * worker/api/cf-ops.ts), which can be absent even when the zone-scoped
 * CLOUDFLARE_ZONE_ID/CLOUDFLARE_API_TOKEN pair is already working fine
 * for the rest of the page. */
export function useAccessLogins(): UseAccessLoginsResult {
  const [data, setData] = useState<AccessLoginEventDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch("/api/cf-ops/access-logs")
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as AccessLoginEventDTO[];
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Access login history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured };
}

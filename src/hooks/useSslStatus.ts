import { useCallback, useEffect, useState } from "react";
import type { SslCertificateStatusDTO } from "../../shared/cf-ops";

interface UseSslStatusResult {
  data: SslCertificateStatusDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  reload: () => void;
}

/** Same 503 -> "not configured" convention as useAnalytics.ts/
 * useEdgeAnalytics.ts -- loads once on mount, no polling needed since a
 * certificate's expiry date doesn't change within a browsing session. */
export function useSslStatus(): UseSslStatusResult {
  const [data, setData] = useState<SslCertificateStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch("/api/cf-ops/ssl-status")
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as SslCertificateStatusDTO;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load SSL status."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured, reload: load };
}

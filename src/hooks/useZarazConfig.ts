import { useCallback, useEffect, useState } from "react";
import type { ZarazToolDTO } from "../../shared/cf-ops";

interface UseZarazConfigResult {
  data: ZarazToolDTO[] | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

/** Same pattern as the other Edge Analytics hooks -- loads once on
 * mount, no polling (Zaraz config changes rarely enough that a live
 * refresh isn't worth the extra requests). */
export function useZarazConfig(): UseZarazConfigResult {
  const [data, setData] = useState<ZarazToolDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch("/api/cf-ops/zaraz-config")
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as ZarazToolDTO[];
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Zaraz config."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured };
}

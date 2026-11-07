import { useCallback, useEffect, useState } from "react";
import type { DnsRecordDTO } from "../../shared/cf-ops";

interface UseDnsRecordsResult {
  data: DnsRecordDTO[] | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

/** Same 503 convention as the other Edge Analytics hooks -- loads once
 * on mount, no polling (DNS records don't change often enough to
 * justify it, and this is a reference view, not a live monitor). */
export function useDnsRecords(): UseDnsRecordsResult {
  const [data, setData] = useState<DnsRecordDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch("/api/cf-ops/dns-records")
      .then(async (res) => {
        if (res.status === 503) {
          setNotConfigured(true);
          return null;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as DnsRecordDTO[];
      })
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load DNS records."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured };
}

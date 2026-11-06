import { useCallback, useEffect, useState } from "react";
import type { AnalyticsRange } from "../../shared/analytics";
import type { SearchConsoleDTO, SearchConsoleFilterOperator } from "../../shared/search-console";

export interface SearchConsoleFilters {
  query: string;
  queryOp: SearchConsoleFilterOperator;
  page: string;
  pageOp: SearchConsoleFilterOperator;
  country: string;
  device: string;
}

export const EMPTY_FILTERS: SearchConsoleFilters = {
  query: "",
  queryOp: "contains",
  page: "",
  pageOp: "contains",
  country: "",
  device: "",
};

interface UseSearchConsoleResult {
  data: SearchConsoleDTO | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
}

function buildQueryString(range: AnalyticsRange, filters: SearchConsoleFilters): string {
  const params = new URLSearchParams({ range });
  if (filters.query) {
    params.set("query", filters.query);
    params.set("queryOp", filters.queryOp);
  }
  if (filters.page) {
    params.set("page", filters.page);
    params.set("pageOp", filters.pageOp);
  }
  if (filters.country) params.set("country", filters.country);
  if (filters.device) params.set("device", filters.device);
  return params.toString();
}

/** Mirrors useAnalytics' summary half -- no realtime equivalent here,
 * Search Console data lags Google's own indexing by ~2-3 days (see
 * DATA_LAG_DAYS in worker/api/search-console.ts) so a "live" poll
 * would just be wasted requests. Re-fetches whenever the range OR any
 * of the Query/Page/Country/Device filters change, same as Search
 * Console's own Performance report. */
export function useSearchConsole(range: AnalyticsRange, filters: SearchConsoleFilters): UseSearchConsoleResult {
  const [data, setData] = useState<SearchConsoleDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    fetch(`/api/search-console?${buildQueryString(range, filters)}`)
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
    // filters is a plain object re-created by the caller on every render;
    // stringify it so the effect only re-fires when its actual contents
    // change, not on every render of the parent page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, JSON.stringify(filters)]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, notConfigured };
}

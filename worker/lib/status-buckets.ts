/** Shared by any Analytics Engine query that aggregates HTTP-style
 * status codes into "2xx"/"4xx"/etc. buckets -- originally lived only in
 * worker/api/api-observability.ts (the admin panel's own API metrics),
 * extracted here so worker/api/worker-logs.ts can reuse it for the
 * public site's page-view and API-health status breakdowns too, instead
 * of duplicating the same six lines in a second file.
 */

export interface StatusCountRow {
  status: number;
  count: number;
}

export interface StatusBucket {
  bucket: string;
  count: number;
}

export function bucketStatuses(rows: StatusCountRow[]): StatusBucket[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const bucket = `${Math.floor(row.status / 100)}xx`;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + row.count);
  }
  return [...buckets.entries()].map(([bucket, count]) => ({ bucket, count })).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

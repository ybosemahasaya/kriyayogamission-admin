/**
 * Thin wrapper around Cloudflare's Analytics Engine SQL API
 * (https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql)
 * -- a THIRD distinct Cloudflare API surface in this project, alongside
 * cf-graphql-client.ts (zone-wide edge logs) and cf-rest-client.ts
 * (regular REST resources like DNS/SSL/cache). This one takes a raw SQL
 * string in the request body (not JSON) and returns query results over
 * whatever's been written to an Analytics Engine dataset via
 * `env.SOME_BINDING.writeDataPoint(...)` -- see worker/lib/api-metrics.ts.
 *
 * HONEST CAVEAT: Cloudflare doesn't publish a formal grammar for this
 * SQL dialect (it's ClickHouse-like, not standard SQL). The queries in
 * worker/api/api-observability.ts are written against documented
 * examples/conventions but not verified against a live account before
 * shipping. If a query here errors, that error will surface verbatim
 * in the UI same as every other query in this project -- the fastest
 * way to fix the SQL, not a sign the whole feature is broken.
 */

const ANALYTICS_ENGINE_SQL_URL = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

export async function queryAnalyticsEngine<T>(apiToken: string, accountId: string, sql: string): Promise<T[]> {
  const res = await fetch(ANALYTICS_ENGINE_SQL_URL(accountId), {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "text/plain",
    },
    body: sql,
  });

  const body = (await res.json().catch(() => null)) as { data?: T[]; errors?: { message: string }[] } | null;

  if (!res.ok || !body) {
    const message = body?.errors?.map((e) => e.message).join("; ") || `${res.status} ${res.statusText}`;
    throw new Error(`Analytics Engine query failed: ${message}`);
  }

  return body.data ?? [];
}

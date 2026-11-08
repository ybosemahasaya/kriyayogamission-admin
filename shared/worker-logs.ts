/** DTOs for the "Worker Logs" page -- Cloudflare Workers Logs/
 * Observability (the built-in, every-plan-including-Free feature),
 * NOT Logpush (external export to R2/S3/Datadog/etc., which needs
 * Business/Enterprise and an external destination -- not worth building
 * for this project; see docs/admin-panel-architecture.html).
 *
 * Reads via the SAME Cloudflare GraphQL Analytics API already used by
 * shared/edge-analytics.ts (worker/lib/cf-graphql-client.ts), just
 * pointed at the account-level `workersInvocationsAdaptiveGroups`
 * dataset instead of a zone-level one -- this is account-scoped because
 * Worker invocation metrics aren't tied to a DNS zone the way HTTP/
 * firewall events are.
 *
 * Covers THREE separate Cloudflare Workers under one account -- this
 * admin panel's own Worker, plus the public site's production AND dev
 * deployments (confirmed against kriyayoga/DEPLOYMENT.md: two separate
 * Workers projects, "kriyayogamission" and "kriyayogamission-dev", both
 * built from the same repo/worker.js). Reading their invocation metrics
 * via this account-level API needs ZERO changes to that repo -- it's
 * read-only querying of data Cloudflare already collects, the same
 * "never touch the public site's repo" compliance as Edge Analytics.
 */

export const WORKER_TARGETS = [
  { key: "admin", label: "Admin Panel", scriptName: "kriyayogamission-admin" },
  { key: "production", label: "Public Site (Production)", scriptName: "kriyayogamission" },
  { key: "dev", label: "Public Site (Dev)", scriptName: "kriyayogamission-dev" },
] as const;

export type WorkerTargetKey = (typeof WORKER_TARGETS)[number]["key"];

export interface WorkerStatusCount {
  /** Cloudflare's own outcome strings, e.g. "success", "exception",
   * "exceededCpu", "canceled" -- passed through verbatim, same
   * reasoning as SslCertificateStatusDTO.status. */
  status: string;
  requests: number;
}

export interface WorkerLogSummaryDTO {
  scriptName: string;
  label: string;
  totalRequests: number;
  totalErrors: number;
  avgCpuTimeMs: number;
  byStatus: WorkerStatusCount[];
}

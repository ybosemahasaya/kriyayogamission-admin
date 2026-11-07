/** DTOs for the Cloudflare zone "operations" widgets on the Edge
 * Analytics page -- SSL certificate status (read-only) and Cache Purge
 * (the one write action in this feature, intentionally narrow: it can
 * only purge cache, nothing else). Both use Cloudflare's regular REST
 * API v4 (not the GraphQL Analytics API shared/edge-analytics.ts talks
 * to) -- see worker/lib/cf-rest-client.ts.
 */

export interface SslCertificateStatusDTO {
  /** e.g. "active", "pending_validation", "pending_issuance" -- passed
   * through verbatim from Cloudflare rather than re-encoded, since the
   * exact wording is useful context an admin may want to see as-is. */
  status: string;
  issuer: string | null;
  /** ISO datetime string, or null if no certificate was found at all. */
  expiresOn: string | null;
  /** Negative once the certificate has already expired. */
  daysUntilExpiry: number | null;
}

export interface CachePurgeResultDTO {
  purgedAt: string;
}

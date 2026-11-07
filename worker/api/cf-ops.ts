import type { AccessLoginEventDTO, CachePurgeResultDTO, DnsRecordDTO, SslCertificateStatusDTO } from "../../shared/cf-ops";
import { cfApiRequest } from "../lib/cf-rest-client";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

interface Credentials {
  zoneId: string;
  apiToken: string;
}

// Reuses the same CLOUDFLARE_ZONE_ID/CLOUDFLARE_API_TOKEN as Edge
// Analytics (worker/api/edge-analytics.ts) rather than introducing a
// second credential pair -- both features operate on the same single
// zone, and the token's permissions are additive (Zone > Analytics >
// Read, Zone > SSL and Certificates > Read, Zone > Cache Purge >
// Purge), not broadened in scope or resource. See README.md's Edge
// Analytics setup section for the exact permissions this token needs.
function requireCredentials(env: Env): Credentials | null {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) return null;
  return { zoneId: env.CLOUDFLARE_ZONE_ID, apiToken: env.CLOUDFLARE_API_TOKEN };
}

interface CertificatePack {
  type: string;
  status: string;
  certificates?: { issuer: string; expires_on: string }[];
}

export async function handleSslStatusRequest(env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Edge analytics is not configured yet.", 503);

  const packs = await cfApiRequest<CertificatePack[]>(
    creds.apiToken,
    `/zones/${creds.zoneId}/ssl/certificate_packs?status=all`,
  );

  // "universal" is Cloudflare's free, auto-renewed certificate -- every
  // zone has one by default. Fall back to whatever pack comes back
  // first if "universal" isn't present (e.g. a custom/advanced cert is
  // configured instead), rather than reporting "no certificate" when
  // one clearly exists.
  const pack = packs.find((p) => p.type === "universal") ?? packs[0];
  const cert = pack?.certificates?.[0];
  const expiresOn = cert?.expires_on ?? null;
  const daysUntilExpiry = expiresOn
    ? Math.round((new Date(expiresOn).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  const payload: SslCertificateStatusDTO = {
    status: pack?.status ?? "unknown",
    issuer: cert?.issuer ?? null,
    expiresOn,
    daysUntilExpiry,
  };

  return json(payload);
}

export async function handleCachePurgeRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return errorResponse("Method not allowed", 405);

  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Edge analytics is not configured yet.", 503);

  // Deliberately the simplest possible purge (everything, not
  // selective by URL/tag) -- this is a small single-zone site, not a
  // high-traffic property where a full purge would cause a meaningful
  // origin load spike. Selective purging would need the admin to know
  // which URLs changed, which defeats the point of a one-click button.
  await cfApiRequest(creds.apiToken, `/zones/${creds.zoneId}/purge_cache`, {
    method: "POST",
    body: JSON.stringify({ purge_everything: true }),
  });

  const payload: CachePurgeResultDTO = { purgedAt: new Date().toISOString() };
  return json(payload);
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
}

export async function handleDnsRecordsRequest(env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Edge analytics is not configured yet.", 503);

  // per_page=100 -- plenty for a small site's zone; this project has
  // nowhere near 100 DNS records, so pagination is YAGNI until proven
  // otherwise. DNS records are public information by definition (any
  // `dig` query reveals them), so read-only exposure here carries no
  // meaningful security risk -- this is purely an operational
  // convenience (check records without leaving the admin panel).
  const records = await cfApiRequest<DnsRecord[]>(creds.apiToken, `/zones/${creds.zoneId}/dns_records?per_page=100`);

  const payload: DnsRecordDTO[] = records
    .map((r) => ({ id: r.id, type: r.type, name: r.name, content: r.content, ttl: r.ttl, proxied: r.proxied ?? false }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

  return json(payload);
}

interface AccessLogEntry {
  email: string;
  allowed: boolean;
  ip_address?: string;
  created_at: string;
}

// Account-level resource (CLOUDFLARE_ACCOUNT_ID, not CLOUDFLARE_ZONE_ID)
// -- requires "Access: Audit Logs: Read" on an Account-scoped policy
// row, confirmed 2026-11-08 against the live Cloudflare permission
// catalog (distinct from "Access: Apps and Policies," which only covers
// app/policy config, not the login event stream itself).
export async function handleAccessLoginsRequest(env: Env): Promise<Response> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Access login visibility is not configured yet.", 503);
  }

  const entries = await cfApiRequest<AccessLogEntry[]>(
    env.CLOUDFLARE_API_TOKEN,
    `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/access/logs/access-requests?limit=25`,
  );

  const payload: AccessLoginEventDTO[] = entries.map((e) => ({
    email: e.email,
    allowed: e.allowed,
    ipAddress: e.ip_address ?? null,
    createdAt: e.created_at,
  }));

  return json(payload);
}

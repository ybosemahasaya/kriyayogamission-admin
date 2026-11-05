/**
 * Google auth for Workers -- we can't use Google's official Node.js
 * client libraries here (they assume Node APIs this runtime doesn't
 * have), so this hand-rolls token exchange with plain fetch + the Web
 * Crypto API, which Workers does support natively.
 *
 * Two credential flavors are supported:
 *
 * 1. OAuth refresh token (preferred): a one-time manual consent as a
 *    real Google user who already has GA4 Viewer access, exchanged for a
 *    long-lived refresh token (see docs/admin-panel-architecture.html
 *    "GA4 auth" section). No service-account key file ever exists, so
 *    this works even when an org policy blocks service account key
 *    creation (`iam.disableServiceAccountKeyCreation`).
 * 2. Service-account JWT Bearer flow: the "normal" Google-recommended
 *    server-to-server flow, used if/when key creation is allowed.
 *    https://developers.google.com/identity/protocols/oauth2/service-account#authorizingrequests
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Every Google API this Worker talks to needs its own scope on the JWT
// assertion (service-account flow only -- OAuth refresh tokens carry
// whatever scope was granted at consent time and can't be widened per
// call). Keep them together here so adding a new integration is a
// one-line addition, not a hunt through client files.
export const GA4_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const SEARCH_CONSOLE_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export interface ServiceAccountCredentials {
  kind: "service_account";
  email: string;
  privateKey: string;
}

export interface OAuthRefreshCredentials {
  kind: "oauth_refresh_token";
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export type GoogleCredentials = ServiceAccountCredentials | OAuthRefreshCredentials;

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Module-level cache, keyed by scope: persists across requests within
// the same Worker isolate. Google access tokens live for an hour;
// re-authenticating on every single dashboard request would be wasteful
// for what's a low-traffic, admin-only dashboard. Keyed by scope because
// GA4 and Search Console each need their own token (the OAuth branch
// also keys by scope even though it ignores the value, so the two
// integrations' refresh tokens -- if ever different -- never collide).
// Not shared across isolates/colos -- that's fine, worst case is an
// extra token fetch now and then, never a correctness problem.
const tokenCache = new Map<string, CachedToken>();

export async function getGoogleAccessToken(creds: GoogleCredentials, scope: string): Promise<string> {
  const now = Date.now();
  const cacheKey = creds.kind === "oauth_refresh_token" ? `oauth:${creds.refreshToken}` : `sa:${creds.email}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - 60_000 > now) {
    return cached.accessToken;
  }

  const body =
    creds.kind === "oauth_refresh_token"
      ? new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: creds.refreshToken,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        })
      : new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: await buildSignedJwt(creds, scope),
        });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 });
  return data.access_token;
}

async function buildSignedJwt(creds: ServiceAccountCredentials, scope: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.email,
    scope,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(creds.privateKey);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64urlFromBytes(new Uint8Array(signature))}`;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // `wrangler secret put` reads stdin literally, so a multi-line PEM
  // pasted as one secret value often arrives with literal backslash-n
  // sequences instead of real newlines -- normalize both forms before
  // stripping the PEM header/footer.
  const normalized = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  const base64Body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(base64Body), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

function base64url(input: string): string {
  return base64urlFromBytes(new TextEncoder().encode(input));
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The subset of Env every Google-backed integration needs -- GA4 and
 * Search Console share one credential pair (same service account, or
 * same OAuth trio), each requesting its own scope at token-fetch time.
 * Keeping this resolver here (not duplicated per API module) means a
 * credential rotation or auth-flavor switch is a one-file change. */
export interface GoogleAuthEnv {
  GA4_OAUTH_CLIENT_ID?: string;
  GA4_OAUTH_CLIENT_SECRET?: string;
  GA4_OAUTH_REFRESH_TOKEN?: string;
  GA4_SERVICE_ACCOUNT_EMAIL?: string;
  GA4_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
}

export function resolveGoogleCredentials(env: GoogleAuthEnv): GoogleCredentials | null {
  if (env.GA4_OAUTH_CLIENT_ID && env.GA4_OAUTH_CLIENT_SECRET && env.GA4_OAUTH_REFRESH_TOKEN) {
    return {
      kind: "oauth_refresh_token",
      clientId: env.GA4_OAUTH_CLIENT_ID,
      clientSecret: env.GA4_OAUTH_CLIENT_SECRET,
      refreshToken: env.GA4_OAUTH_REFRESH_TOKEN,
    };
  }

  if (env.GA4_SERVICE_ACCOUNT_EMAIL && env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return {
      kind: "service_account",
      email: env.GA4_SERVICE_ACCOUNT_EMAIL,
      privateKey: env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY,
    };
  }

  return null;
}

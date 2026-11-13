import { PRIMARY_ACCOUNT_EMAIL, type AccessPolicyEmailsDTO } from "../../shared/access-policy";
import { cfApiRequest } from "../lib/cf-rest-client";
import { errorResponse, getAccessUserEmail, json } from "../lib/http";
import type { Env } from "../types";

interface Credentials {
  accountId: string;
  apiToken: string;
  policyId: string;
}

// Reuses the exact same CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN pair
// as the Access login/audit widget (worker/api/cf-ops.ts) -- this just
// needs one more permission added to that same Account-scoped policy
// row ("Access: Apps and Policies: Edit"), not a new credential.
// CLOUDFLARE_ACCESS_POLICY_ID is the id of the reusable "AdminPanel
// allowlist" policy itself (visible in its Cloudflare dashboard URL) --
// not sensitive, same reasoning as the other IDs in wrangler.jsonc's
// vars. See README.md's "Adding admin-access self-service" section.
function requireCredentials(env: Env): Credentials | null {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCESS_POLICY_ID) return null;
  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    policyId: env.CLOUDFLARE_ACCESS_POLICY_ID,
  };
}

// Minimal shape of Cloudflare's reusable Access Policy object --
// deliberately typed as "the one field we touch (include) plus
// everything else passed through untouched" rather than modeling every
// possible rule type (email, group, everyone, ip_list, ...) or every
// optional policy field (session_duration, purpose_justification,
// approval_groups, ...). PUT replaces the ENTIRE policy, so
// round-tripping whatever GET returned -- minus the read-only metadata
// fields PUT rejects -- is both simpler and safer than reconstructing
// the object field-by-field and risking silently dropping a setting an
// admin configured by hand in the Cloudflare dashboard.
interface AccessRule {
  email?: { email: string };
  [key: string]: unknown;
}

interface AccessPolicy {
  id: string;
  include: AccessRule[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

function emailsFromRules(rules: AccessRule[]): string[] {
  return rules.map((rule) => rule.email?.email).filter((email): email is string => Boolean(email));
}

function fetchPolicy(creds: Credentials): Promise<AccessPolicy> {
  return cfApiRequest<AccessPolicy>(creds.apiToken, `/accounts/${creds.accountId}/access/policies/${creds.policyId}`);
}

function putPolicy(creds: Credentials, policy: AccessPolicy): Promise<AccessPolicy> {
  // Strip the read-only fields GET hands back -- Cloudflare's PUT
  // doesn't accept `id`/`created_at`/`updated_at` as input -- but
  // otherwise send back exactly what GET returned so every other
  // setting (decision, session duration, MFA override, etc.) survives
  // untouched.
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...writable } = policy;
  return cfApiRequest<AccessPolicy>(creds.apiToken, `/accounts/${creds.accountId}/access/policies/${creds.policyId}`, {
    method: "PUT",
    body: JSON.stringify(writable),
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readEmailFromBody(request: Request): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  return email || null;
}

/** GET lists the policy's current allowed emails; POST adds one; DELETE
 * removes one. All three operate on the exact same resource (the
 * reusable "AdminPanel allowlist" Access policy's Include rule), so
 * they share a single route in worker/index.ts rather than three. */
export async function handleAccessPolicyEmailsRequest(request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Admin access self-service is not configured yet.", 503);

  if (request.method === "GET") {
    const policy = await fetchPolicy(creds);
    const payload: AccessPolicyEmailsDTO = { emails: emailsFromRules(policy.include) };
    return json(payload);
  }

  if (request.method === "POST") {
    const email = await readEmailFromBody(request);
    if (!email || !EMAIL_RE.test(email)) return errorResponse("A valid email address is required.", 400);

    const policy = await fetchPolicy(creds);
    const existing = emailsFromRules(policy.include);
    if (existing.includes(email)) {
      // Already allowed -- a no-op, not an error. Mirrors how the
      // Cloudflare dashboard itself treats re-adding a duplicate chip.
      const noop: AccessPolicyEmailsDTO = { emails: existing };
      return json(noop);
    }

    const updated = await putPolicy(creds, { ...policy, include: [...policy.include, { email: { email } }] });
    const payload: AccessPolicyEmailsDTO = { emails: emailsFromRules(updated.include) };
    return json(payload);
  }

  if (request.method === "DELETE") {
    const email = await readEmailFromBody(request);
    if (!email) return errorResponse("An email address is required.", 400);

    // Refuse to remove the email the requester is CURRENTLY authenticated
    // as -- Cloudflare Access put it in this exact header (see
    // getAccessUserEmail), so this is a guaranteed-accurate check, not a
    // guess. Without it, one careless click locks the person doing the
    // clicking out of the admin panel they're sitting in right now.
    const requesterEmail = getAccessUserEmail(request)?.toLowerCase();
    if (requesterEmail && requesterEmail === email) {
      return errorResponse("You can't remove your own access. Ask another admin to remove it instead.", 400);
    }

    // The primary account is permanently protected -- hardcoded, not
    // "whichever email happens to be first," so it can never be removed
    // even by someone else who's otherwise allowed to manage this list.
    // See shared/access-policy.ts for why this lives there, not here.
    if (email === PRIMARY_ACCOUNT_EMAIL.toLowerCase()) {
      return errorResponse("This is the primary account and can't be removed from the allowlist.", 400);
    }

    const policy = await fetchPolicy(creds);
    const remaining = policy.include.filter((rule) => rule.email?.email.toLowerCase() !== email);

    // Refuse to ever leave an Include list with zero rules -- that's a
    // footgun this endpoint should never allow a single click to cause,
    // whether it ends up denying everyone or (depending on how
    // Cloudflare treats an empty Include) something worse.
    if (remaining.length === 0) {
      return errorResponse("Can't remove the last allowed email -- add a replacement first.", 400);
    }

    const updated = await putPolicy(creds, { ...policy, include: remaining });
    const payload: AccessPolicyEmailsDTO = { emails: emailsFromRules(updated.include) };
    return json(payload);
  }

  return errorResponse("Method not allowed", 405);
}

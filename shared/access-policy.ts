/** DTO for the "who can access this admin panel" self-service feature
 * under Profile -- lets an already-authenticated admin add or remove an
 * email from the Cloudflare Access policy that gates this entire
 * domain, without leaving the admin panel to use the Cloudflare
 * dashboard directly. See worker/api/access-policy.ts.
 *
 * Deliberately just the one field: the full list of emails currently
 * in the policy's Include rule, returned fresh after every GET/POST/
 * DELETE so the UI always reflects exactly what's live on Cloudflare's
 * side, not an optimistic local guess. */
export interface AccessPolicyEmailsDTO {
  emails: string[];
}

/** The primary account's email -- permanently protected from removal
 * through this feature, regardless of who's logged in or which email
 * the action targets. Hardcoded (not just "whichever email happens to
 * be first in the list") because the whole point is that THIS specific
 * account can never be locked out, even by someone else who's
 * otherwise allowed to manage the allowlist. Enforced server-side in
 * worker/api/access-policy.ts; exported here too so the UI can disable
 * the remove button for it instead of only failing after a click. */
export const PRIMARY_ACCOUNT_EMAIL = "ybosemahasaya@gmail.com";

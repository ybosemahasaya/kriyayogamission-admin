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

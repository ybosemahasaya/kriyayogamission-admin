import { useState } from "react";
import { PRIMARY_ACCOUNT_EMAIL } from "../../shared/access-policy";
import { addAccessPolicyEmail, removeAccessPolicyEmail } from "../api/access-policy";
import { useAccessPolicyEmails } from "../hooks/useAccessPolicyEmails";
import { PlusIcon, TrashIcon } from "./icons";

/** Lets an already-authenticated admin grant (or revoke) access to this
 * entire admin panel by editing the live Cloudflare Access "AdminPanel
 * allowlist" policy, without leaving the app -- see
 * worker/api/access-policy.ts. No extra auth check beyond "you already
 * got past Cloudflare Access to be looking at this modal," same as
 * every other write action in this app (e.g. Cache Purge); Access
 * itself is the authorization boundary.
 *
 * Deliberately skips a confirm() on removal, unlike CachePurgeButton --
 * the worker already refuses to remove your own email, the primary
 * account's email, or the last remaining one, which covers the
 * actually-dangerous outcomes; adding a second confirmation on top
 * would just be friction for the common, safe case (revoking someone
 * else's access). */
export function AdminAccessModal() {
  const { emails, loading, error, notConfigured, setEmails, reload } = useAccessPolicyEmails();
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setAdding(true);
    setActionError(null);
    try {
      const result = await addAccessPolicyEmail(email);
      setEmails(result.emails);
      setNewEmail("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add email.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(email: string) {
    setBusyEmail(email);
    setActionError(null);
    try {
      const result = await removeAccessPolicyEmail(email);
      setEmails(result.emails);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove email.");
    } finally {
      setBusyEmail(null);
    }
  }

  if (notConfigured) {
    return (
      <p className="empty-state">
        Admin access self-service isn't configured yet -- add CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (with
        Access: Apps and Policies: Edit) and CLOUDFLARE_ACCESS_POLICY_ID to this Worker's config. See README.md.
      </p>
    );
  }

  return (
    <div className="admin-access">
      <p className="admin-access-intro">
        Anyone on this list can sign in to <strong>admin.kriyayogamission.org</strong> with their Google/email
        account. Changes here apply immediately to the live Cloudflare Access policy -- the same one editable from
        the Cloudflare dashboard.
      </p>

      {loading && <p className="empty-state">Loading...</p>}
      {error && <p className="form-error">{error}</p>}

      {emails && (
        <ul className="admin-access-list">
          {emails.map((email) => {
            const isPrimary = email === PRIMARY_ACCOUNT_EMAIL.toLowerCase();
            return (
              <li key={email} className="admin-access-row">
                <span className="admin-access-email">
                  {email}
                  {isPrimary && <span className="admin-access-badge">Primary</span>}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title={isPrimary ? "The primary account can't be removed" : "Remove access"}
                  disabled={isPrimary || busyEmail === email}
                  onClick={() => handleRemove(email)}
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
          {emails.length === 0 && <p className="empty-state">No emails allowed yet -- add one below.</p>}
        </ul>
      )}

      {actionError && <p className="form-error">{actionError}</p>}

      <form className="admin-access-add" onSubmit={handleAdd}>
        <input
          type="email"
          placeholder="name@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={adding || !newEmail.trim()}>
          <PlusIcon /> {adding ? "Adding..." : "Grant access"}
        </button>
      </form>

      <button type="button" className="admin-access-refresh" onClick={reload}>
        Refresh list
      </button>
    </div>
  );
}

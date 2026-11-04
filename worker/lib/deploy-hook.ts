import type { Env } from "../types";

/**
 * Triggers a kriyayogamission-dev rebuild after gallery create/update/
 * delete, so the public gallery picks up admin panel changes
 * automatically instead of requiring someone to remember to manually
 * rebuild.
 *
 * History: this used to fake a `git push` by committing a marker file to
 * the public repo's `dev` branch via the GitHub Contents API, using a
 * GITHUB_PAT. That approach was abandoned after proving it structurally
 * broken in production -- *every* call to api.github.com from this
 * Worker, including a bare unauthenticated GET to api.github.com/zen,
 * came back as a Cloudflare-synthesized 525 ("SSL Handshake Failed").
 * Retries didn't help because the failure was 100% reproducible across
 * multiple Cloudflare colos and timestamps -- a domain-wide
 * Workers<->github.com connectivity problem, not anything fixable in our
 * request code.
 *
 * Current approach: Cloudflare Workers Builds has its own "Deploy Hooks"
 * feature (Settings -> Builds -> Deploy Hooks on the kriyayogamission-dev
 * project), scoped to the `dev` branch. Posting to that URL starts a
 * build directly -- a Cloudflare-to-Cloudflare call that never touches
 * GitHub's API at all, so the 525 problem is structurally impossible
 * here. No auth header needed; the URL itself is the credential (treated
 * like a secret, stored as DEPLOY_HOOK_URL).
 *
 * Deliberately dev-only: no production Deploy Hook is configured, and
 * this code has no path to one. See docs/admin-panel-architecture.html.
 * DEPLOY_HOOK_URL is a silent no-op if unset, so gallery CRUD keeps
 * working even without it configured.
 *
 * Call via ctx.waitUntil() so a slow/failed deploy hook request never
 * delays or breaks the actual API response to the admin UI.
 */
export async function triggerDevRebuild(env: Env): Promise<void> {
  if (!env.DEPLOY_HOOK_URL) return;

  try {
    const res = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[DEPLOY HOOK] Deploy hook request failed: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error("[DEPLOY HOOK] Deploy hook request threw:", err);
  }
}

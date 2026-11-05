import type { Env } from "../types";

/**
 * Triggers a rebuild of the public site after gallery create/update/
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
 * feature (Settings -> Builds -> Deploy Hooks on each project), scoped to
 * a specific branch. Posting to that URL starts a build directly -- a
 * Cloudflare-to-Cloudflare call that never touches GitHub's API at all,
 * so the 525 problem is structurally impossible here. No auth header
 * needed; the URL itself is the credential (treated like a secret).
 *
 * Originally dev-only (DEPLOY_HOOK_URL -> kriyayogamission-dev's `dev`
 * branch). Extended 2026-11-06, per explicit request, to also fire
 * PROD_DEPLOY_HOOK_URL -> the production kriyayogamission project's
 * `main` branch, once ADMIN_GALLERY_API_URL was added as a Build
 * variable on *both* Cloudflare projects (see Gallery.astro in the
 * public site repo -- that fetch is already environment-agnostic, it
 * just needed something to actually trigger a production build). Each
 * hook fires independently and is a silent no-op if its URL isn't set,
 * so gallery CRUD keeps working even with only one (or neither)
 * configured, and a failure on one hook never blocks the other.
 *
 * Call via ctx.waitUntil() so slow/failed deploy hook requests never
 * delay or break the actual API response to the admin UI.
 */
export async function triggerSiteRebuilds(env: Env): Promise<void> {
  await Promise.all([
    triggerHook(env.DEPLOY_HOOK_URL, "dev"),
    triggerHook(env.PROD_DEPLOY_HOOK_URL, "production"),
  ]);
}

async function triggerHook(url: string | undefined, label: string): Promise<void> {
  if (!url) return;

  try {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[DEPLOY HOOK] ${label} deploy hook request failed: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error(`[DEPLOY HOOK] ${label} deploy hook request threw:`, err);
  }
}

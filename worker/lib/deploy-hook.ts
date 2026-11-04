import type { Env } from "../types";

/**
 * Fires the Cloudflare deploy hook for kriyayogamission-dev so the public
 * gallery picks up create/update/delete changes automatically instead of
 * requiring someone to remember to manually trigger a rebuild.
 *
 * Deliberately dev-only for now (see docs/admin-panel-architecture.html --
 * the "reflect on dev only, not production" restriction is explicit and
 * temporary). DEPLOY_HOOK_URL is unset until that hook is created in the
 * Cloudflare dashboard; until then this is a silent no-op so gallery CRUD
 * keeps working even without it configured.
 *
 * Call via ctx.waitUntil() so a slow/failed deploy-hook request never
 * delays or breaks the actual API response to the admin UI.
 */
export async function triggerDevRebuild(env: Env): Promise<void> {
  if (!env.DEPLOY_HOOK_URL) return;

  try {
    const res = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    if (!res.ok) {
      console.error(`[DEPLOY HOOK] Trigger returned ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("[DEPLOY HOOK] Trigger request threw:", err);
  }
}

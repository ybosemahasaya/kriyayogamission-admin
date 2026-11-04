import type { Env } from "../types";

/**
 * Triggers a kriyayogamission-dev rebuild after gallery create/update/
 * delete, so the public gallery picks up admin panel changes
 * automatically instead of requiring someone to remember to manually
 * rebuild.
 *
 * Why a GitHub commit instead of a Cloudflare deploy hook: Cloudflare
 * Workers Builds (the Git integration for plain Workers projects, which
 * is what kriyayogamission-dev actually is) doesn't expose a public
 * webhook URL to externally trigger a rebuild the way Cloudflare Pages'
 * "Deploy Hooks" do -- that was tried and nothing showed up in the
 * deployment history. What *is* proven to reliably trigger a rebuild,
 * dozens of times over in this project's history, is a plain `git push`
 * to the dev branch. So instead of guessing at another uncertain
 * dashboard feature, this does the same thing a human push does: makes a
 * tiny automated commit via the GitHub API, touching one marker file.
 * Cloudflare's existing push-triggered build picks it up exactly like any
 * other commit.
 *
 * Deliberately dev-only for now (see docs/admin-panel-architecture.html --
 * the "reflect on dev only, not production" restriction is explicit and
 * temporary). GITHUB_PAT is unset until that token is created and added
 * as a secret; until then this is a silent no-op so gallery CRUD keeps
 * working even without it configured.
 *
 * Call via ctx.waitUntil() so a slow/failed GitHub request never delays
 * or breaks the actual API response to the admin UI.
 */
const REPO = "ybosemahasaya/kriyayogamission";
const BRANCH = "dev";
const MARKER_PATH = ".admin-sync-trigger";

export async function triggerDevRebuild(env: Env): Promise<void> {
  if (!env.GITHUB_PAT) return;

  const apiUrl = `https://api.github.com/repos/${REPO}/contents/${MARKER_PATH}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "kriyayogamission-admin-worker",
  };

  try {
    // Updating an existing file requires its current sha; creating a new
    // one doesn't. Look it up first and fall back to "create" if it
    // doesn't exist yet (first run).
    const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers });
    const sha = getRes.ok ? (await getRes.json<{ sha: string }>()).sha : undefined;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        message: "chore: trigger dev rebuild (admin panel gallery change)",
        content: btoa(new Date().toISOString()),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      console.error(`[DEPLOY HOOK] GitHub commit failed: ${putRes.status} ${text}`);
    }
  } catch (err) {
    console.error("[DEPLOY HOOK] GitHub commit request threw:", err);
  }
}

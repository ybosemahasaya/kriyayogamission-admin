import { json } from "../lib/http";

/**
 * TEMPORARY diagnostic (2026-11-08) for a Security/Dependabot dashboard
 * feasibility check. worker/lib/deploy-hook.ts documents that this exact
 * Worker previously got a 100%-reproducible Cloudflare-synthesized 525
 * ("SSL Handshake Failed") on EVERY call to api.github.com, including a
 * bare unauthenticated GET -- which is why the old GitHub-Contents-API
 * deploy trick was abandoned in favor of Cloudflare's own Deploy Hooks.
 *
 * Before spending effort generating a GITHUB_DEPENDABOT_TOKEN and wiring
 * up a Dependabot-alerts panel, this re-tests the exact same connectivity
 * path live: a no-auth GET to https://api.github.com/zen. If this still
 * 525s, the whole "Worker calls GitHub's API directly" approach is dead
 * regardless of token scope, and the feature needs a different shape
 * (e.g. something else pushing alert data in, rather than this Worker
 * pulling it). If it succeeds, proceed with the token as planned.
 *
 * Safe to delete once this question is answered either way -- it sends
 * no credentials and touches no other part of the app.
 */
export async function handleGithubConnectivityDebugRequest(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const res = await fetch("https://api.github.com/zen", {
      headers: { "User-Agent": "kriyayogamission-admin-connectivity-check" },
    });
    const bodyText = await res.text();
    return json({
      outcome: "fetch-completed",
      status: res.status,
      statusText: res.statusText,
      bodySample: bodyText.slice(0, 300),
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    return json({
      outcome: "fetch-threw",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
  }
}

import { useApiObservability } from "../../hooks/useApiObservability";
import type { Theme } from "../../hooks/useTheme";
import { ApiHealthPanel } from "../analytics/ApiHealthPanel";

/** Self-contained, same independence philosophy as the other cf-ops
 * sections. Deliberately labeled distinctly from everything else on
 * this page -- this is the ADMIN PANEL'S OWN API health (requests to
 * THIS Worker's /api/* routes), sourced from Workers Analytics Engine,
 * not Cloudflare's zone-wide logs for the public site like the rest of
 * Edge Analytics above it. If every route shows 0 requests right after
 * deploying this, that's expected -- it only has data going forward
 * from whenever the Analytics Engine binding first started receiving
 * writes, there's no historical backfill.
 *
 * Just a thin fetch-and-render wrapper now -- the actual markup lives
 * in ApiHealthPanel, shared with the public site's own API health view
 * on the Worker Logs page. */
export function ApiObservabilitySection({ theme }: { theme: Theme }) {
  const { data, loading, error, notConfigured } = useApiObservability();

  if (notConfigured) return null;
  if (loading) return <p className="empty-state">Loading admin API metrics...</p>;
  if (error) return <p className="form-error">Admin API metrics unavailable: {error}</p>;

  return <ApiHealthPanel data={data} label="Admin API requests" theme={theme} />;
}

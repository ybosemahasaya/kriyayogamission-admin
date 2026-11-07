import { useZarazConfig } from "../../hooks/useZarazConfig";
import { AnalyticsTable } from "../analytics/AnalyticsTable";

/** Self-contained, same independence philosophy as DnsRecordsSection --
 * low-stakes, low-priority widget (config that rarely changes, already
 * viewable in the Cloudflare dashboard's Zaraz tab). Included because
 * this project already documents its Zaraz/GA4 setup elsewhere
 * (zaraz-ga4-configuration.html), not because it's a frequently-needed
 * view. If the "type" column shows "unknown" for every row, the field
 * mapping in worker/api/cf-ops.ts's handleZarazConfigRequest needs a
 * look -- that mapping was a best-effort guess, not verified against a
 * real response (see the comment there). */
export function ZarazConfigSection() {
  const { data, loading, error, notConfigured } = useZarazConfig();

  if (notConfigured) return null;
  if (loading) return <p className="empty-state">Loading Zaraz config...</p>;
  if (error) return <p className="form-error">Zaraz config unavailable: {error}</p>;
  if (!data) return null;

  return (
    <AnalyticsTable
      title="Zaraz tools (read-only)"
      columns={["Tool", "Type", "Enabled"]}
      rows={data.map((t) => [t.name, t.type, t.enabled ? "Yes" : "No"])}
    />
  );
}

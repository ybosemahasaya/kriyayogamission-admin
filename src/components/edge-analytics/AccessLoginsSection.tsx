import { useAccessLogins } from "../../hooks/useAccessLogins";
import { AnalyticsTable } from "../analytics/AnalyticsTable";

/** Self-contained, same independence philosophy as DnsRecordsSection --
 * this one is MORE likely to need a config fix on first try than
 * anything else in Edge Analytics (see the caveat comment in
 * worker/api/cf-ops.ts: the exact Cloudflare permission name for
 * account-level Access audit logs wasn't verified against the live
 * dashboard before shipping this). Rendering nothing when not
 * configured keeps that iteration invisible to the rest of the page
 * instead of showing a permanent "not configured" banner for a widget
 * that's still being dialed in. */
export function AccessLoginsSection() {
  const { data, loading, error, notConfigured } = useAccessLogins();

  if (notConfigured) return null;
  if (loading) return <p className="empty-state">Loading Access login history...</p>;
  if (error) return <p className="form-error">Access login history unavailable: {error}</p>;
  if (!data) return null;

  return (
    <AnalyticsTable
      title="Recent admin panel logins (Cloudflare Access)"
      columns={["Email", "Allowed", "IP address", "When"]}
      rows={data.map((e) => [
        e.email,
        e.allowed ? "Yes" : "No",
        e.ipAddress ?? "--",
        new Date(e.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      ])}
    />
  );
}

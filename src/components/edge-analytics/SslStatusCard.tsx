import type { SslCertificateStatusDTO } from "../../../shared/cf-ops";

interface Props {
  status: SslCertificateStatusDTO;
}

/** Color-codes by urgency rather than raw status string -- an admin
 * cares about "is this about to become a problem," not the exact
 * Cloudflare status enum value. Cloudflare auto-renews the free
 * universal certificate well before expiry, so this is mostly a
 * reassurance widget, not an alarm an admin needs to act on often. */
function urgencyClass(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry === null) return "";
  if (daysUntilExpiry < 14) return "audit-severity-text-error";
  if (daysUntilExpiry < 30) return "audit-severity-text-warning";
  return "audit-severity-text-ok";
}

export function SslStatusCard({ status }: Props) {
  return (
    <div className="analytics-kpi-card">
      <span className="analytics-kpi-label">SSL Certificate</span>
      <span className={`analytics-kpi-value ${urgencyClass(status.daysUntilExpiry)}`}>
        {status.daysUntilExpiry !== null ? `${status.daysUntilExpiry}d left` : status.status}
      </span>
      <span className="analytics-kpi-delta">
        {status.issuer ?? "Unknown issuer"}
        {status.expiresOn && ` -- expires ${new Date(status.expiresOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
      </span>
    </div>
  );
}

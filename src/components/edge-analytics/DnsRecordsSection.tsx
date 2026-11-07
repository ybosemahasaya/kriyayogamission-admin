import { useDnsRecords } from "../../hooks/useDnsRecords";
import { AnalyticsTable } from "../analytics/AnalyticsTable";

/** Self-contained: owns its own fetch/loading/error state so a problem
 * here (or simply not being configured yet) never blocks the rest of
 * the Edge Analytics page from rendering -- same independence
 * philosophy as the firewall breakdown section in EdgeAnalyticsPage. */
export function DnsRecordsSection() {
  const { data, loading, error, notConfigured } = useDnsRecords();

  if (notConfigured) return null; // uses the same creds as the rest of the page -- no separate "not configured" banner needed
  if (loading) return <p className="empty-state">Loading DNS records...</p>;
  if (error) return <p className="form-error">DNS records unavailable: {error}</p>;
  if (!data) return null;

  return (
    <AnalyticsTable
      title="DNS records (read-only)"
      columns={["Type", "Name", "Content", "TTL", "Proxied"]}
      rows={data.map((r) => [r.type, r.name, r.content, r.ttl === 1 ? "Auto" : String(r.ttl), r.proxied ? "Yes" : "No"])}
    />
  );
}

import type { EdgeAnalyticsDTO } from "../../../shared/edge-analytics";
import type { SslCertificateStatusDTO, DnsRecordDTO } from "../../../shared/cf-ops";
import type { Theme } from "../../hooks/useTheme";
import { formatNumber } from "../../lib/format";
import { AnalyticsDonutChart } from "../analytics/AnalyticsDonutChart";
import { AnalyticsTable } from "../analytics/AnalyticsTable";
import { DashboardPanel } from "./DashboardPanel";
import { StatTile, toneForSslExpiry } from "./StatTile";

interface Props {
  theme: Theme;
  edgeAnalytics: EdgeAnalyticsDTO | null;
  sslStatus: SslCertificateStatusDTO | null;
  dnsRecords: DnsRecordDTO[] | null;
}

/** "Security posture, threat intel, DDoS stats" -- a Grafana-styled
 * Security Overview, NOT a Grafana or Cloudflare Radar integration.
 *
 * Feasibility/relevancy verdict this panel is built around (see also
 * README):
 * - Cloudflare Radar (global internet-wide trends) was explicitly
 *   SKIPPED -- it's not about this site at all, just general internet
 *   weather. Would be decorative, not actionable, for a small
 *   nonprofit's own admin panel.
 * - "Security Center"-equivalent insights ARE feasible for the parts
 *   this zone's Free plan actually exposes: SSL/TLS status and DNS
 *   records (both already built, reused here, not duplicated) plus a
 *   basic threats-mitigated counter (works on every Cloudflare plan).
 * - The deeper WAF/firewall action breakdown -- the closest thing to
 *   real "DDoS stats" for this specific zone -- depends on
 *   firewallEventsAdaptiveGroups, which this zone's Free plan may or
 *   may not expose (a prior live test got "zone does not have access to
 *   the path"; Cloudflare's own docs say Free should get a sampled
 *   version). This panel doesn't guess either way -- it reuses
 *   useEdgeAnalytics's EXISTING graceful degradation (data.firewallError)
 *   and shows whichever is actually true at render time, live. */
export function SecurityOverviewPanel({ theme, edgeAnalytics, sslStatus, dnsRecords }: Props) {
  const hasFirewallBreakdown = (edgeAnalytics?.firewallActions.length ?? 0) > 0;

  return (
    <>
      <DashboardPanel title="Security posture" subtitle="SSL, DNS, threats (7d)">
        <div className="dashboard-stat-row">
          <StatTile
            label="SSL certificate"
            value={sslStatus?.daysUntilExpiry != null ? `${sslStatus.daysUntilExpiry}d left` : (sslStatus?.status ?? "--")}
            tone={toneForSslExpiry(sslStatus?.daysUntilExpiry ?? null)}
            detail={sslStatus?.issuer ?? undefined}
          />
          <StatTile label="Threats mitigated" value={formatNumber(edgeAnalytics?.summary.totalThreats ?? 0)} />
          <StatTile label="DNS records" value={formatNumber(dnsRecords?.length ?? 0)} />
        </div>
      </DashboardPanel>

      <DashboardPanel title="WAF / firewall activity" subtitle="7d" span="wide">
        {hasFirewallBreakdown ? (
          <div className="analytics-chart-row">
            <AnalyticsDonutChart
              title="Actions taken"
              theme={theme}
              labels={edgeAnalytics!.firewallActions.map((a) => a.action)}
              values={edgeAnalytics!.firewallActions.map((a) => a.count)}
            />
            <AnalyticsTable
              title="Top blocked/challenged paths"
              columns={["Path", "Events"]}
              rows={edgeAnalytics!.firewallTopPaths.map((p) => [p.path, formatNumber(p.count)])}
            />
            <AnalyticsTable
              title="Top source countries"
              columns={["Country", "Events"]}
              rows={edgeAnalytics!.firewallTopCountries.map((c) => [c.country, formatNumber(c.count)])}
            />
          </div>
        ) : (
          <p className="empty-state">
            WAF/firewall event analytics aren't available on this zone's current Cloudflare plan.
            {edgeAnalytics?.firewallError && <> ({edgeAnalytics.firewallError})</>} The threats-mitigated count
            above still works on every plan -- this breakdown specifically needs Cloudflare's Security Events
            dataset, which this zone doesn't currently have access to.
          </p>
        )}
      </DashboardPanel>
    </>
  );
}

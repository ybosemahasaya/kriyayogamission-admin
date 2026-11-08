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
 * - "Security Center"-equivalent insights: SSL/TLS status and DNS
 *   records (both already built, reused here, not duplicated), a basic
 *   threats-mitigated counter (works on every Cloudflare plan), AND the
 *   WAF/firewall action+source breakdown below -- the closest thing to
 *   real zone-specific "DDoS stats."
 * - RESOLVED 2026-11-08: that breakdown briefly looked plan-gated
 *   (firewallEventsAdaptiveGroups, the server-side GROUP BY variant,
 *   returned "zone does not have access to the path" on this Free-plan
 *   zone) but the RAW firewallEventsAdaptive field works fine, confirmed
 *   live. worker/api/edge-analytics.ts now computes the breakdown
 *   itself from raw events instead of asking Cloudflare to group them
 *   -- same end result. `firewallError` is kept as a genuine fallback
 *   for real failures (token issues, transient API errors), not a
 *   permanent "your plan doesn't support this" message anymore. */
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

      <DashboardPanel
        title="WAF / firewall activity"
        subtitle={
          hasFirewallBreakdown ? `7d, sampled from ${formatNumber(edgeAnalytics?.firewallSampleSize ?? 0)} events` : "7d"
        }
        span="wide"
      >
        {hasFirewallBreakdown ? (
          <div className="analytics-chart-row">
            <AnalyticsDonutChart
              title="Actions taken"
              theme={theme}
              labels={edgeAnalytics!.firewallActions.map((a) => a.action)}
              values={edgeAnalytics!.firewallActions.map((a) => a.count)}
            />
            <AnalyticsDonutChart
              title="Blocked by"
              theme={theme}
              labels={edgeAnalytics!.firewallBySource.map((s) => s.source)}
              values={edgeAnalytics!.firewallBySource.map((s) => s.count)}
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
            WAF/firewall event data unavailable right now
            {edgeAnalytics?.firewallError ? <>: {edgeAnalytics.firewallError}</> : " (no events in this window)."}
          </p>
        )}
      </DashboardPanel>
    </>
  );
}

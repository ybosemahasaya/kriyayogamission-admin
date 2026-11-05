import type { AnalyticsRange } from "../../shared/analytics";
import { useSearchConsole } from "../hooks/useSearchConsole";
import { formatDelta, formatNumber, formatPercent } from "../lib/format";
import { AnalyticsDonutChart } from "./analytics/AnalyticsDonutChart";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import type { Theme } from "../hooks/useTheme";

/** Lives inside AnalyticsPage, reusing its range selector -- Search
 * Console is a second data source on the same dashboard, not a
 * separate page, so there's no reason to duplicate the 7d/30d/90d
 * tabs or give it its own sidebar entry. */
export function SearchConsolePanel({ range, theme }: { range: AnalyticsRange; theme: Theme }) {
  const { data, loading, error, notConfigured } = useSearchConsole(range);

  if (notConfigured) {
    return (
      <p className="empty-state">
        Search Console isn't connected yet -- add GSC_SITE_URL to this Worker's vars and grant its service account
        Restricted access on the property to enable this section.
      </p>
    );
  }
  if (loading) return <p className="empty-state">Loading Search Console data...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const { summary } = data;
  const clicksDelta = formatDelta(summary.clicks.current, summary.clicks.previous);
  const impressionsDelta = formatDelta(summary.impressions.current, summary.impressions.previous);
  const ctrDelta = formatDelta(summary.ctr.current, summary.ctr.previous);
  const positionDelta = formatDelta(summary.position.current, summary.position.previous);

  return (
    <>
      <h2 className="analytics-section-title">Search Console</h2>

      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Clicks</span>
          <span className="analytics-kpi-value">{formatNumber(summary.clicks.current)}</span>
          <span className={`analytics-kpi-delta analytics-kpi-delta-${clicksDelta.direction}`}>{clicksDelta.label}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Impressions</span>
          <span className="analytics-kpi-value">{formatNumber(summary.impressions.current)}</span>
          <span className={`analytics-kpi-delta analytics-kpi-delta-${impressionsDelta.direction}`}>
            {impressionsDelta.label}
          </span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Avg. CTR</span>
          <span className="analytics-kpi-value">{formatPercent(summary.ctr.current)}</span>
          <span className={`analytics-kpi-delta analytics-kpi-delta-${ctrDelta.direction}`}>{ctrDelta.label}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Avg. Position</span>
          <span className="analytics-kpi-value">{summary.position.current.toFixed(1)}</span>
          <span className={`analytics-kpi-delta analytics-kpi-delta-${positionDelta.direction}`}>
            {positionDelta.label}
          </span>
        </div>
      </div>

      <div className="analytics-chart-row">
        <AnalyticsTable
          title="Top search queries"
          columns={["Query", "Clicks", "Impressions", "Position"]}
          rows={data.topQueries.map((q) => [
            q.query,
            formatNumber(q.clicks),
            formatNumber(q.impressions),
            q.position.toFixed(1),
          ])}
        />
        <AnalyticsTable
          title="Top pages (search)"
          columns={["Page", "Clicks", "Impressions", "Position"]}
          rows={data.topPages.map((p) => [
            p.page,
            formatNumber(p.clicks),
            formatNumber(p.impressions),
            p.position.toFixed(1),
          ])}
        />
        <AnalyticsDonutChart
          title="Clicks by device"
          theme={theme}
          labels={data.devices.map((d) => d.device)}
          values={data.devices.map((d) => d.clicks)}
        />
      </div>
    </>
  );
}

import { useState } from "react";
import type { SearchConsoleKeywordGroup } from "../../../shared/search-console";
import { formatNumber, formatPercent } from "../../lib/format";

type KeywordTab = "branded" | "non-branded";

interface Props {
  branded: SearchConsoleKeywordGroup;
  nonBranded: SearchConsoleKeywordGroup;
}

/** The keyword-ranking report proper -- split into Branded (searcher
 * already knows this is Kriya Yoga Mission / its guru) vs. Non-Branded
 * (searcher found this site while looking for a topic). That split
 * matters because the two need different strategies: branded traffic
 * confirms people recognize the organization, non-branded traffic is
 * what SEO/content work is actually trying to grow. See
 * shared/brand-terms.ts for the exact classification rule. */
export function KeywordRankingsTabs({ branded, nonBranded }: Props) {
  const [tab, setTab] = useState<KeywordTab>("non-branded");
  const active = tab === "branded" ? branded : nonBranded;

  return (
    <div className="analytics-chart-card keyword-rankings-card">
      <h3>Keyword Rankings</h3>

      <div className="tabs keyword-rankings-tabs">
        <button type="button" className={tab === "non-branded" ? "tab active" : "tab"} onClick={() => setTab("non-branded")}>
          Non-Branded <span className="tab-count">{nonBranded.keywordCount}</span>
        </button>
        <button type="button" className={tab === "branded" ? "tab active" : "tab"} onClick={() => setTab("branded")}>
          Branded <span className="tab-count">{branded.keywordCount}</span>
        </button>
      </div>

      <div className="keyword-rankings-summary">
        <div>
          <span className="analytics-kpi-label">Keywords</span>
          <span className="analytics-kpi-value">{formatNumber(active.keywordCount)}</span>
        </div>
        <div>
          <span className="analytics-kpi-label">Clicks</span>
          <span className="analytics-kpi-value">{formatNumber(active.totalClicks)}</span>
        </div>
        <div>
          <span className="analytics-kpi-label">Impressions</span>
          <span className="analytics-kpi-value">{formatNumber(active.totalImpressions)}</span>
        </div>
        <div>
          <span className="analytics-kpi-label">Avg. Position</span>
          <span className="analytics-kpi-value">{active.avgPosition.toFixed(1)}</span>
        </div>
      </div>

      {active.queries.length === 0 ? (
        <p className="analytics-empty">
          No {tab === "branded" ? "branded" : "non-branded"} keywords found for this period.
        </p>
      ) : (
        <div className="keyword-rankings-table-scroll">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th>CTR</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {active.queries.map((q) => (
                <tr key={q.query}>
                  <td>{q.query}</td>
                  <td>{formatNumber(q.clicks)}</td>
                  <td>{formatNumber(q.impressions)}</td>
                  <td>{formatPercent(q.ctr)}</td>
                  <td>{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

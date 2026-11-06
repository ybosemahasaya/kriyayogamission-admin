import { useMemo, useState } from "react";
import { BRAND_TERMS } from "../../../shared/brand-terms";
import { aggregateQueryStats } from "../../../shared/search-console";
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
 * shared/brand-terms.ts for the exact classification rule.
 *
 * Each tab gets its own filter shape, deliberately different: Branded
 * has a small, known, finite set of terms (shared/brand-terms.ts), so a
 * select-from-list is the right control. Non-Branded is an open-ended,
 * potentially 200+ row list with no fixed vocabulary, so free-text
 * type-to-filter is the right control instead. Both filter client-side
 * over the already-fetched group -- no extra Google API call needed, the
 * backend already gave us every keyword in each bucket for this range. */
export function KeywordRankingsTabs({ branded, nonBranded }: Props) {
  const [tab, setTab] = useState<KeywordTab>("non-branded");
  const [brandTermFilter, setBrandTermFilter] = useState("");
  const [nonBrandedSearch, setNonBrandedSearch] = useState("");

  const filteredBranded = useMemo(
    () => (brandTermFilter ? branded.queries.filter((q) => q.query.toLowerCase().includes(brandTermFilter.toLowerCase())) : branded.queries),
    [branded.queries, brandTermFilter],
  );
  const filteredNonBranded = useMemo(() => {
    const needle = nonBrandedSearch.trim().toLowerCase();
    return needle ? nonBranded.queries.filter((q) => q.query.toLowerCase().includes(needle)) : nonBranded.queries;
  }, [nonBranded.queries, nonBrandedSearch]);

  const activeQueries = tab === "branded" ? filteredBranded : filteredNonBranded;
  // Recompute the summary over whatever's currently filtered -- matches
  // Search Console's own behavior where the KPI tiles update to reflect
  // an applied filter rather than always showing the unfiltered total.
  const activeStats = useMemo(() => aggregateQueryStats(activeQueries), [activeQueries]);

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

      {tab === "branded" ? (
        <div className="keyword-rankings-inline-filter">
          <label>Filter by brand term</label>
          <select value={brandTermFilter} onChange={(e) => setBrandTermFilter(e.target.value)}>
            <option value="">All branded terms</option>
            {BRAND_TERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="keyword-rankings-inline-filter">
          <label>Search non-branded keywords</label>
          <input
            type="text"
            placeholder="Type to filter, e.g. meditation"
            value={nonBrandedSearch}
            onChange={(e) => setNonBrandedSearch(e.target.value)}
          />
        </div>
      )}

      <div className="keyword-rankings-summary">
        <div>
          <span className="analytics-kpi-label">Keywords</span>
          <span className="analytics-kpi-value">{formatNumber(activeStats.keywordCount)}</span>
        </div>
        <div>
          <span className="analytics-kpi-label">Clicks</span>
          <span className="analytics-kpi-value">{formatNumber(activeStats.totalClicks)}</span>
        </div>
        <div>
          <span className="analytics-kpi-label">Impressions</span>
          <span className="analytics-kpi-value">{formatNumber(activeStats.totalImpressions)}</span>
        </div>
        <div>
          <span className="analytics-kpi-label">Avg. Position</span>
          <span className="analytics-kpi-value">{activeStats.avgPosition.toFixed(1)}</span>
        </div>
      </div>

      {activeQueries.length === 0 ? (
        <p className="analytics-empty">
          No {tab === "branded" ? "branded" : "non-branded"} keywords match the current filter.
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
              {activeQueries.map((q) => (
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

import { useState } from "react";
import type { AnalyticsRange } from "../../shared/analytics";
import { EMPTY_FILTERS, useSearchConsole, type SearchConsoleFilters } from "../hooks/useSearchConsole";
import { formatDelta, formatNumber, formatPercent } from "../lib/format";
import { countryName } from "../../shared/country-codes";
import { DimensionBreakdownTabs } from "./search-console/DimensionBreakdownTabs";
import { KeywordRankingsTabs } from "./search-console/KeywordRankingsTabs";
import { SearchConsoleFilterBar } from "./search-console/SearchConsoleFilterBar";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

/** Note on scope: Search Console's own Performance report also offers a
 * "24 hours" range and a Search type (web/image/video/news) filter.
 * Neither is wired up here -- 24 hours is meaningless against data that's
 * already ~3 days lagged (see DATA_LAG_DAYS in the Worker), and this is a
 * text-heavy site with no image/video/news search presence worth
 * filtering by. Both are easy to add later if that changes. */
export function SearchConsolePage() {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [filters, setFilters] = useState<SearchConsoleFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<SearchConsoleFilters>(EMPTY_FILTERS);
  const { data, loading, error, notConfigured } = useSearchConsole(range, filters);

  function applyFilters() {
    setFilters(draftFilters);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
  }

  function removeFilter(key: keyof SearchConsoleFilters) {
    const next = { ...filters, [key]: "" };
    if (key === "query") next.queryOp = "contains";
    if (key === "page") next.pageOp = "contains";
    setFilters(next);
    setDraftFilters(next);
  }

  return (
    <div className="analytics-page">
      <div className="toolbar analytics-toolbar">
        <div className="tabs">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={range === opt.value ? "tab active" : "tab"}
              onClick={() => setRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {notConfigured && (
        <p className="empty-state">
          Search Console isn't connected yet -- add GSC_SITE_URL to this Worker's vars and grant its service account
          Restricted access on the property to enable this dashboard.
        </p>
      )}
      {loading && !notConfigured && <p className="empty-state">Loading Search Console data...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && !error && (
        <>
          <SearchConsoleFilterBar
            filters={filters}
            draft={draftFilters}
            availableCountries={data.availableCountries}
            onDraftChange={setDraftFilters}
            onApply={applyFilters}
            onReset={resetFilters}
          />

          {(data.activeFilters.query || data.activeFilters.page || data.activeFilters.country || data.activeFilters.device) && (
            <div className="search-console-active-filters">
              {data.activeFilters.query && (
                <span className="search-console-filter-chip">
                  Query {data.activeFilters.query.operator}: "{data.activeFilters.query.value}"
                  <button type="button" onClick={() => removeFilter("query")}>
                    &times;
                  </button>
                </span>
              )}
              {data.activeFilters.page && (
                <span className="search-console-filter-chip">
                  Page {data.activeFilters.page.operator}: "{data.activeFilters.page.value}"
                  <button type="button" onClick={() => removeFilter("page")}>
                    &times;
                  </button>
                </span>
              )}
              {data.activeFilters.country && (
                <span className="search-console-filter-chip">
                  Country: {countryName(data.activeFilters.country)}
                  <button type="button" onClick={() => removeFilter("country")}>
                    &times;
                  </button>
                </span>
              )}
              {data.activeFilters.device && (
                <span className="search-console-filter-chip">
                  Device: {data.activeFilters.device}
                  <button type="button" onClick={() => removeFilter("device")}>
                    &times;
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="analytics-kpi-grid">
            {(
              [
                ["Clicks", data.summary.clicks, formatNumber],
                ["Impressions", data.summary.impressions, formatNumber],
                ["Avg. CTR", data.summary.ctr, formatPercent],
                ["Avg. Position", data.summary.position, (v: number) => v.toFixed(1)],
              ] as const
            ).map(([label, metric, format]) => {
              const delta = formatDelta(metric.current, metric.previous);
              return (
                <div className="analytics-kpi-card" key={label}>
                  <span className="analytics-kpi-label">{label}</span>
                  <span className="analytics-kpi-value">{format(metric.current)}</span>
                  <span className={`analytics-kpi-delta analytics-kpi-delta-${delta.direction}`}>{delta.label}</span>
                </div>
              );
            })}
          </div>

          <div className="analytics-chart-row">
            <KeywordRankingsTabs branded={data.brandedKeywords} nonBranded={data.nonBrandedKeywords} />
          </div>

          <div className="analytics-chart-row">
            <DimensionBreakdownTabs dimensions={data.dimensions} />
          </div>
        </>
      )}
    </div>
  );
}

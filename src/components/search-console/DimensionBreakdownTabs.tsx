import { useState } from "react";
import { countryName } from "../../../shared/country-codes";
import type { SearchConsoleDimensionBreakdown, SearchConsoleDimensionRow } from "../../../shared/search-console";
import { formatNumber, formatPercent } from "../../lib/format";

type DimensionTab = "queries" | "pages" | "countries" | "devices" | "searchAppearance";

const TABS: { id: DimensionTab; label: string }[] = [
  { id: "queries", label: "Queries" },
  { id: "pages", label: "Pages" },
  { id: "countries", label: "Countries" },
  { id: "devices", label: "Devices" },
  { id: "searchAppearance", label: "Search Appearance" },
];

/** The raw, unclassified GSC-style breakdown -- same five report tabs
 * Search Console's own Performance page offers (its sixth, "Days", is
 * just the timeseries chart already rendered above this card, so it's
 * skipped here rather than duplicated). Whatever Query/Page/Country/
 * Device filters are active up in SearchConsoleFilterBar already shaped
 * this data server-side -- this component just renders it. */
export function DimensionBreakdownTabs({ dimensions }: { dimensions: SearchConsoleDimensionBreakdown }) {
  const [tab, setTab] = useState<DimensionTab>("queries");
  const rows = dimensions[tab];
  const labelHeader = tab === "queries" ? "Query" : tab === "pages" ? "Page" : tab === "countries" ? "Country" : tab === "devices" ? "Device" : "Appearance";

  function displayLabel(row: SearchConsoleDimensionRow): string {
    return tab === "countries" ? countryName(row.label) : row.label;
  }

  return (
    <div className="analytics-chart-card">
      <h3>Search Console Performance</h3>
      <div className="tabs keyword-rankings-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="analytics-empty">No data for this period/filter combination.</p>
      ) : (
        <div className="keyword-rankings-table-scroll">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{labelHeader}</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th>CTR</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{displayLabel(row)}</td>
                  <td>{formatNumber(row.clicks)}</td>
                  <td>{formatNumber(row.impressions)}</td>
                  <td>{formatPercent(row.ctr)}</td>
                  <td>{row.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

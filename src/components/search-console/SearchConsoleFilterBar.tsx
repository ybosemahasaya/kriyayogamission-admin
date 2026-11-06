import { countryName } from "../../../shared/country-codes";
import type { SearchConsoleFilterOperator } from "../../../shared/search-console";
import type { SearchConsoleFilters } from "../../hooks/useSearchConsole";
import { EMPTY_FILTERS } from "../../hooks/useSearchConsole";

const OPERATOR_OPTIONS: { value: SearchConsoleFilterOperator; label: string }[] = [
  { value: "contains", label: "containing" },
  { value: "notContains", label: "not containing" },
  { value: "equals", label: "exact match" },
];

const DEVICE_OPTIONS = [
  { value: "DESKTOP", label: "Desktop" },
  { value: "MOBILE", label: "Mobile" },
  { value: "TABLET", label: "Tablet" },
];

interface Props {
  filters: SearchConsoleFilters;
  draft: SearchConsoleFilters;
  availableCountries: string[];
  onDraftChange: (next: SearchConsoleFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

/** Mirrors Search Console's own "+ Add filter" picker (Query/Page
 * contains/not-containing/exact, Country/Device plain selects), flattened
 * into one always-visible row instead of a popover-per-dimension --
 * functionally identical, fewer clicks to use. Filters are staged in
 * `draft` and only sent to the backend (and only then costs a Google API
 * call) once "Apply filters" is pressed, same as GSC's own Apply button. */
export function SearchConsoleFilterBar({ filters, draft, availableCountries, onDraftChange, onApply, onReset }: Props) {
  const isDirty = JSON.stringify(draft) !== JSON.stringify(filters);
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="search-console-filter-bar">
      <div className="search-console-filter-field">
        <label>Query</label>
        <div className="search-console-filter-row">
          <select
            value={draft.queryOp}
            onChange={(e) => onDraftChange({ ...draft, queryOp: e.target.value as SearchConsoleFilterOperator })}
          >
            {OPERATOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="e.g. kriya yoga"
            value={draft.query}
            onChange={(e) => onDraftChange({ ...draft, query: e.target.value })}
          />
        </div>
      </div>

      <div className="search-console-filter-field">
        <label>Page</label>
        <div className="search-console-filter-row">
          <select
            value={draft.pageOp}
            onChange={(e) => onDraftChange({ ...draft, pageOp: e.target.value as SearchConsoleFilterOperator })}
          >
            {OPERATOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="e.g. /about"
            value={draft.page}
            onChange={(e) => onDraftChange({ ...draft, page: e.target.value })}
          />
        </div>
      </div>

      <div className="search-console-filter-field">
        <label>Country</label>
        <select value={draft.country} onChange={(e) => onDraftChange({ ...draft, country: e.target.value })}>
          <option value="">All countries</option>
          {availableCountries.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </div>

      <div className="search-console-filter-field">
        <label>Device</label>
        <select value={draft.device} onChange={(e) => onDraftChange({ ...draft, device: e.target.value })}>
          <option value="">All devices</option>
          {DEVICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="search-console-filter-actions">
        <button type="button" className="btn-primary" disabled={!isDirty} onClick={onApply}>
          Apply filters
        </button>
        {hasActiveFilters && (
          <button type="button" className="btn-secondary" onClick={onReset}>
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

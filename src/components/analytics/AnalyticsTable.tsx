interface Props {
  title: string;
  columns: string[];
  rows: string[][];
  /** Optional -- lets a caller (e.g. Site Audit's Crawled Pages table)
   * make rows clickable without this shared component knowing anything
   * about what a "row" means in that context. Omitted entirely for
   * Top Pages/Top Countries/etc., which stay plain. */
  onRowClick?: (rowIndex: number) => void;
}

/** Shared by Top Pages and Top Countries -- both are just "a labeled
 * table of pre-formatted strings," so one component renders either. */
export function AnalyticsTable({ title, columns, rows, onRowClick }: Props) {
  return (
    <div className="analytics-chart-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="analytics-empty">No data for this period.</p>
      ) : (
        <table className="analytics-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              // Row's first cell (page path/country name) is unique
              // within a single GA4 report response -- fine as a key.
              <tr
                key={row[0]}
                className={onRowClick ? "analytics-table-row-clickable" : undefined}
                onClick={onRowClick ? () => onRowClick(rowIndex) : undefined}
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

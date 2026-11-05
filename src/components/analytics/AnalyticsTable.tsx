interface Props {
  title: string;
  columns: string[];
  rows: string[][];
}

/** Shared by Top Pages and Top Countries -- both are just "a labeled
 * table of pre-formatted strings," so one component renders either. */
export function AnalyticsTable({ title, columns, rows }: Props) {
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
            {rows.map((row) => (
              // Row's first cell (page path/country name) is unique
              // within a single GA4 report response -- fine as a key.
              <tr key={row[0]}>
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

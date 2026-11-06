import type { AuditRunDetailDTO } from "../../../shared/site-audit";

/** SEMrush's Overview tab -- the at-a-glance summary. Site Health +
 * severity counts (also visible as the toolbar's permanent context),
 * plus a quick "most common issues" list so an admin doesn't have to
 * open the Issues tab just to see what's dominating the count. */
export function OverviewTab({ latest }: { latest: AuditRunDetailDTO }) {
  const topIssueTypes = countByCheckType(latest.issues).slice(0, 5);

  return (
    <>
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Site Health</span>
          <span className="analytics-kpi-value">{latest.healthScore ?? "--"}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Errors</span>
          <span className="analytics-kpi-value audit-severity-text-error">{latest.errorCount}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Warnings</span>
          <span className="analytics-kpi-value audit-severity-text-warning">{latest.warningCount}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Notices</span>
          <span className="analytics-kpi-value audit-severity-text-notice">{latest.noticeCount}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Pages Crawled</span>
          <span className="analytics-kpi-value">{latest.pagesCrawled}</span>
        </div>
      </div>

      <div className="analytics-chart-row">
        <div className="analytics-chart-card">
          <h3>Most common issues</h3>
          {topIssueTypes.length === 0 ? (
            <p className="analytics-empty">No issues found on this run.</p>
          ) : (
            <ul className="audit-top-issues-list">
              {topIssueTypes.map(([checkType, count]) => (
                <li key={checkType}>
                  <span className="audit-top-issues-type">{checkType}</span>
                  <span className="audit-top-issues-count">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function countByCheckType(issues: AuditRunDetailDTO["issues"]): [string, number][] {
  const counts = new Map<string, number>();
  for (const issue of issues) counts.set(issue.checkType, (counts.get(issue.checkType) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

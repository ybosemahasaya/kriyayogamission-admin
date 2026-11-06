import { useMemo, useState } from "react";
import type { AuditIssueDTO, AuditRunSummaryDTO } from "../../../shared/site-audit";
import { useAuditRunDetail } from "../../hooks/useAuditRunDetail";

function issueKey(issue: AuditIssueDTO): string {
  // Keyed by checkType+page, not the full message -- "this check started
  // or stopped failing on this page" is the useful comparison signal; a
  // message like "3 image(s) missing ALT" changing to "2" shouldn't read
  // as a totally different issue.
  return `${issue.checkType}::${issue.pageUrl ?? "site-wide"}`;
}

function diffIssues(before: AuditIssueDTO[], after: AuditIssueDTO[]) {
  const beforeKeys = new Set(before.map(issueKey));
  const afterKeys = new Set(after.map(issueKey));
  const newIssues = after.filter((issue) => !beforeKeys.has(issueKey(issue)));
  const resolvedIssues = before.filter((issue) => !afterKeys.has(issueKey(issue)));
  return { newIssues, resolvedIssues };
}

/** SEMrush's Compare Crawls tab -- pick any two past runs and see what
 * changed. The underlying data (every run's full pages/issues) already
 * exists in D1 from day one; this is a pure frontend addition plus the
 * one new GET /api/site-audit/runs/:id route. */
export function CompareCrawlsTab({ history }: { history: AuditRunSummaryDTO[] }) {
  const completedRuns = useMemo(() => history.filter((run) => run.status === "complete"), [history]);
  const [runAId, setRunAId] = useState<number | null>(completedRuns[1]?.id ?? null);
  const [runBId, setRunBId] = useState<number | null>(completedRuns[0]?.id ?? null);

  const { detail: runA, loading: loadingA, error: errorA } = useAuditRunDetail(runAId);
  const { detail: runB, loading: loadingB, error: errorB } = useAuditRunDetail(runBId);

  if (completedRuns.length < 2) {
    return <p className="empty-state">Run the audit at least twice to compare crawls.</p>;
  }

  const { newIssues, resolvedIssues } = runA && runB ? diffIssues(runA.issues, runB.issues) : { newIssues: [], resolvedIssues: [] };
  const healthDelta = runA && runB && runA.healthScore !== null && runB.healthScore !== null ? runB.healthScore - runA.healthScore : null;

  return (
    <>
      <div className="audit-compare-picker">
        <label>
          Run A (before)
          <select value={runAId ?? ""} onChange={(e) => setRunAId(Number(e.target.value))}>
            {completedRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {new Date(run.startedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <span className="audit-compare-arrow">&rarr;</span>
        <label>
          Run B (after)
          <select value={runBId ?? ""} onChange={(e) => setRunBId(Number(e.target.value))}>
            {completedRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {new Date(run.startedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(loadingA || loadingB) && <p className="empty-state">Loading both runs...</p>}
      {(errorA || errorB) && <p className="form-error">{errorA ?? errorB}</p>}

      {runA && runB && !loadingA && !loadingB && (
        <>
          <div className="analytics-kpi-grid">
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Health Score Change</span>
              <span
                className={
                  healthDelta === null ? "analytics-kpi-value" : healthDelta >= 0 ? "analytics-kpi-value audit-severity-text-ok" : "analytics-kpi-value audit-severity-text-error"
                }
              >
                {healthDelta === null ? "--" : healthDelta > 0 ? `+${healthDelta}` : healthDelta}
              </span>
            </div>
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">New Issues</span>
              <span className="analytics-kpi-value audit-severity-text-error">{newIssues.length}</span>
            </div>
            <div className="analytics-kpi-card">
              <span className="analytics-kpi-label">Resolved Issues</span>
              <span className="analytics-kpi-value audit-severity-text-ok">{resolvedIssues.length}</span>
            </div>
          </div>

          <div className="analytics-chart-row">
            <div className="analytics-chart-card">
              <h3>New issues ({newIssues.length})</h3>
              {newIssues.length === 0 ? (
                <p className="analytics-empty">Nothing new.</p>
              ) : (
                <ul className="audit-compare-list">
                  {newIssues.map((issue) => (
                    <li key={issue.id}>
                      <span className={`audit-severity-badge audit-severity-${issue.severity}`}>{issue.checkType}</span>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="analytics-chart-card">
              <h3>Resolved issues ({resolvedIssues.length})</h3>
              {resolvedIssues.length === 0 ? (
                <p className="analytics-empty">Nothing resolved.</p>
              ) : (
                <ul className="audit-compare-list">
                  {resolvedIssues.map((issue) => (
                    <li key={issue.id}>
                      <span className={`audit-severity-badge audit-severity-${issue.severity}`}>{issue.checkType}</span>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

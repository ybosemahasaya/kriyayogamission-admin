import { useState } from "react";
import type { AuditIssueDTO, AuditSeverity } from "../../shared/site-audit";
import { AUDIT_CHECK_INFO, DEFAULT_CHECK_INFO } from "../../shared/site-audit-issue-info";
import { useSiteAudit } from "../hooks/useSiteAudit";
import { AnalyticsTable } from "./analytics/AnalyticsTable";
import { ChevronDownIcon } from "./icons";

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  notice: "Notices",
};

// Rendered in this fixed order regardless of how many of each exist --
// matches SEMrush's own Errors / Warnings / Notices ordering.
const SEVERITY_ORDER: AuditSeverity[] = ["error", "warning", "notice"];

function groupBySeverity(issues: AuditIssueDTO[]): Record<AuditSeverity, AuditIssueDTO[]> {
  const groups: Record<AuditSeverity, AuditIssueDTO[]> = { error: [], warning: [], notice: [] };
  for (const issue of issues) groups[issue.severity].push(issue);
  return groups;
}

function relativePagePath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export function SiteAuditPage() {
  const { latest, history, loading, running, error, notConfigured, runAudit } = useSiteAudit();
  // Which issue rows are expanded to show "About the issue" / "How to
  // fix" -- keyed by issue id, reset implicitly whenever a fresh audit
  // replaces `latest` (new ids, so stale entries just stop matching).
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (notConfigured) {
    return (
      <p className="empty-state">
        Site audit storage isn't provisioned yet -- create the D1 database for this project and uncomment the DB
        binding in wrangler.jsonc to enable this page.
      </p>
    );
  }

  const issueGroups = latest ? groupBySeverity(latest.issues) : null;

  return (
    <div className="site-audit-page">
      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={runAudit} disabled={running}>
          {running ? "Crawling site..." : "Run Audit"}
        </button>
        {latest && (
          <span className="site-audit-last-run">
            Last run: {new Date(latest.startedAt).toLocaleString()} &middot; {latest.pagesCrawled} page
            {latest.pagesCrawled === 1 ? "" : "s"} crawled
          </span>
        )}
      </div>

      {loading && <p className="empty-state">Loading site audit...</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && !latest && (
        <p className="empty-state">No audits run yet. Click "Run Audit" to crawl the site for the first time.</p>
      )}

      {latest && issueGroups && (
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

          <h2 className="analytics-section-title">Issues</h2>
          {SEVERITY_ORDER.map((severity) => {
            const items = issueGroups[severity];
            if (items.length === 0) return null;
            return (
              <div key={severity} className="audit-issue-group">
                <h3 className={`audit-severity-text-${severity}`}>
                  {SEVERITY_LABELS[severity]} ({items.length})
                </h3>
                <ul className="audit-issue-list">
                  {items.map((issue) => {
                    const expanded = expandedIds.has(issue.id);
                    const info = AUDIT_CHECK_INFO[issue.checkType] ?? DEFAULT_CHECK_INFO;
                    return (
                      <li key={issue.id} className="audit-issue-item">
                        <button
                          type="button"
                          className="audit-issue-row"
                          onClick={() => toggleExpanded(issue.id)}
                          aria-expanded={expanded}
                        >
                          <ChevronDownIcon className={expanded ? "audit-chevron audit-chevron-open" : "audit-chevron"} />
                          <span className={`audit-severity-badge audit-severity-${issue.severity}`}>
                            {issue.checkType}
                          </span>
                          <span className="audit-issue-message">{issue.message}</span>
                          {issue.pageUrl && (
                            <span className="audit-issue-page-link">{relativePagePath(issue.pageUrl)}</span>
                          )}
                        </button>
                        {expanded && (
                          <div className="audit-issue-detail">
                            <div>
                              <h4>About the issue</h4>
                              <p>{info.about}</p>
                            </div>
                            <div>
                              <h4>How to fix</h4>
                              <ul>
                                {info.howToFix.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ul>
                            </div>
                            {issue.pageUrl && (
                              <a href={issue.pageUrl} target="_blank" rel="noreferrer" className="audit-issue-detail-link">
                                Open page &rarr;
                              </a>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {latest.issues.length === 0 && <p className="empty-state">No issues found on this run.</p>}

          <div className="analytics-chart-row">
            <AnalyticsTable
              title="Crawled Pages"
              columns={["Page", "Status", "Title", "Issues"]}
              rows={latest.pages.map((page) => [
                relativePagePath(page.url),
                page.statusCode?.toString() ?? "--",
                page.title ?? "--",
                page.issueCount.toString(),
              ])}
            />
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 className="analytics-section-title">Previous Runs</h2>
          <div className="analytics-chart-row">
            <AnalyticsTable
              title="Run history"
              columns={["Date", "Health", "Errors", "Warnings", "Notices"]}
              rows={history.map((run) => [
                new Date(run.startedAt).toLocaleString(),
                run.healthScore?.toString() ?? "--",
                run.errorCount.toString(),
                run.warningCount.toString(),
                run.noticeCount.toString(),
              ])}
            />
          </div>
        </>
      )}
    </div>
  );
}

import type { AuditIssueDTO, AuditSeverity } from "../../../shared/site-audit";
import { AuditIssueRow } from "./AuditIssueRow";

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

export function IssuesTab({ issues }: { issues: AuditIssueDTO[] }) {
  const groups = groupBySeverity(issues);

  if (issues.length === 0) {
    return <p className="empty-state">No issues found on this run.</p>;
  }

  return (
    <>
      {SEVERITY_ORDER.map((severity) => {
        const items = groups[severity];
        if (items.length === 0) return null;
        return (
          <div key={severity} className="audit-issue-group">
            <h3 className={`audit-severity-text-${severity}`}>
              {SEVERITY_LABELS[severity]} ({items.length})
            </h3>
            <ul className="audit-issue-list">
              {items.map((issue) => (
                <AuditIssueRow key={issue.id} issue={issue} />
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

import { useState } from "react";
import type { AuditIssueDTO } from "../../../shared/site-audit";
import { AUDIT_CHECK_INFO, DEFAULT_CHECK_INFO } from "../../../shared/site-audit-issue-info";
import { ChevronDownIcon } from "../icons";

interface Props {
  issue: AuditIssueDTO;
  /** Hidden in contexts that are already scoped to one page (the
   * per-page detail modal) -- showing "this issue is on this page" is
   * redundant when the whole panel is already about that one page. */
  showPageLink?: boolean;
}

function relativePagePath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

/** One expandable issue row -- used in the Issues tab's severity-grouped
 * list and in CrawledPageDetailModal's per-page issue list. Manages its
 * own open/closed state rather than lifting it to a parent Set<id>,
 * since each row's disclosure is independent of every other row's. */
export function AuditIssueRow({ issue, showPageLink = true }: Props) {
  const [expanded, setExpanded] = useState(false);
  const info = AUDIT_CHECK_INFO[issue.checkType] ?? DEFAULT_CHECK_INFO;

  return (
    <li className="audit-issue-item">
      <button
        type="button"
        className="audit-issue-row"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <ChevronDownIcon className={expanded ? "audit-chevron audit-chevron-open" : "audit-chevron"} />
        <span className={`audit-severity-badge audit-severity-${issue.severity}`}>{issue.checkType}</span>
        <span className="audit-issue-message">{issue.message}</span>
        {showPageLink && issue.pageUrl && (
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
}

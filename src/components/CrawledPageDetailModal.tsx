import type { AuditIssueDTO, AuditPageDTO } from "../../shared/site-audit";
import { AuditIssueRow } from "./AuditIssueRow";
import { Modal } from "./Modal";

interface Props {
  page: AuditPageDTO;
  issues: AuditIssueDTO[]; // pre-filtered to this page's issues by the caller
  onClose: () => void;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

/** Mirrors the per-page drill-down SEMrush shows when you click a
 * crawled page (back arrow, status badge, Summary, Issues Found). Reuses
 * the generic Modal shell and the same AuditIssueRow used in the main
 * Issues list, so a page's issues get the identical About/How-to-fix
 * detail, not a simplified duplicate. */
export function CrawledPageDetailModal({ page, issues, onClose }: Props) {
  const isHealthy = page.statusCode !== null && page.statusCode < 400;

  return (
    <Modal title={pathOf(page.url)} onClose={onClose}>
      <div className="audit-page-detail-summary">
        <a href={page.url} target="_blank" rel="noreferrer" className="audit-page-detail-url">
          {page.url}
        </a>
        <span className={isHealthy ? "audit-status-ok" : "audit-status-bad"}>{page.statusCode ?? "unreachable"}</span>
      </div>

      <dl className="audit-page-detail-fields">
        <div>
          <dt>Title</dt>
          <dd>{page.title ?? "--"}</dd>
        </div>
        <div>
          <dt>Meta description</dt>
          <dd>{page.metaDescription ?? "--"}</dd>
        </div>
        <div>
          <dt>H1 count</dt>
          <dd>{page.h1Count}</dd>
        </div>
      </dl>

      <h3 className="analytics-section-title">Issues found ({issues.length})</h3>
      {issues.length === 0 ? (
        <p className="empty-state">No issues found on this page.</p>
      ) : (
        <ul className="audit-issue-list">
          {issues.map((issue) => (
            <AuditIssueRow key={issue.id} issue={issue} showPageLink={false} />
          ))}
        </ul>
      )}
    </Modal>
  );
}

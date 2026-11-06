/** Shared between the Worker crawler (worker/lib/site-crawler.ts) and the
 * admin UI (src/components/SiteAuditPage.tsx). Mirrors (a deliberately
 * scoped-down subset of) SEMrush's Site Audit: Errors/Warnings/Notices
 * severity buckets, a 0-100 health score, and per-page results -- see the
 * "mini-site-audit" roadmap item in docs/admin-panel-architecture.html for
 * what's in vs. out of scope. */

export type AuditSeverity = "error" | "warning" | "notice";

export type AuditRunStatus = "running" | "complete" | "failed";

/** One finding. pageUrl is null for site-wide checks that aren't about a
 * specific page (e.g. "robots.txt not found"). */
export interface AuditIssueDTO {
  id: number;
  severity: AuditSeverity;
  checkType: string;
  message: string;
  pageUrl: string | null;
}

export interface AuditPageDTO {
  id: number;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  issueCount: number;
}

export interface AuditRunSummaryDTO {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: AuditRunStatus;
  pagesCrawled: number;
  healthScore: number | null;
  errorCount: number;
  warningCount: number;
  noticeCount: number;
  triggeredBy: string | null;
}

export interface AuditRunDetailDTO extends AuditRunSummaryDTO {
  pages: AuditPageDTO[];
  issues: AuditIssueDTO[];
}

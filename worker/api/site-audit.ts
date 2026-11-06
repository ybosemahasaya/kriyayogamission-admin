import { errorResponse, getAccessUserEmail, json } from "../lib/http";
import { computeHealthScore, runSiteAudit, type CrawledIssue, type CrawledPage } from "../lib/site-crawler";
import type { Env } from "../types";
import type { AuditIssueDTO, AuditPageDTO, AuditRunDetailDTO, AuditRunStatus, AuditRunSummaryDTO } from "../../shared/site-audit";

function requireDb(env: Env): Response | null {
  if (!env.DB) {
    return errorResponse(
      "Site audit storage is not provisioned yet. An admin needs to create the D1 database for THIS " +
        "project (see Phase 1 checklist in docs/admin-panel-architecture.html), then uncomment the DB " +
        "binding in wrangler.jsonc.",
      503,
    );
  }
  return null;
}

export async function handleSiteAuditRunRequest(request: Request, env: Env): Promise<Response> {
  const dbError = requireDb(env);
  if (dbError) return dbError;
  if (request.method !== "POST") return errorResponse("Method not allowed", 405);

  const triggeredBy = getAccessUserEmail(request) ?? "unknown";
  const startedAt = new Date().toISOString();
  const runId = await insertRun(env, startedAt, triggeredBy);

  try {
    const { pages, issues } = await runSiteAudit(env);
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const noticeCount = issues.filter((i) => i.severity === "notice").length;
    const healthScore = computeHealthScore(errorCount, warningCount, noticeCount);

    await persistPagesAndIssues(env, runId, pages, issues);
    await finalizeRun(env, runId, "complete", pages.length, healthScore, errorCount, warningCount, noticeCount);

    const detail = await getRunDetail(env, runId);
    return json(detail, { status: 201 });
  } catch (err) {
    console.error("Site audit crawl failed:", err);
    await finalizeRun(env, runId, "failed", 0, null, 0, 0, 0);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`Site audit crawl failed: ${message}`, 500);
  }
}

export async function handleSiteAuditLatestRequest(env: Env): Promise<Response> {
  const dbError = requireDb(env);
  if (dbError) return dbError;

  const row = await env.DB!.prepare(
    "SELECT id FROM site_audit_runs WHERE status = 'complete' ORDER BY started_at DESC LIMIT 1",
  ).first<{ id: number }>();
  if (!row) return json(null);

  return json(await getRunDetail(env, row.id));
}

export async function handleSiteAuditRunsRequest(env: Env): Promise<Response> {
  const dbError = requireDb(env);
  if (dbError) return dbError;

  const { results } = await env.DB!.prepare(
    `SELECT id, started_at, finished_at, status, pages_crawled, health_score,
            error_count, warning_count, notice_count, triggered_by
     FROM site_audit_runs ORDER BY started_at DESC LIMIT 30`,
  ).all<RunRow>();

  return json(results.map(rowToSummaryDTO));
}

interface RunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: AuditRunStatus;
  pages_crawled: number;
  health_score: number | null;
  error_count: number;
  warning_count: number;
  notice_count: number;
  triggered_by: string | null;
}

function rowToSummaryDTO(row: RunRow): AuditRunSummaryDTO {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    pagesCrawled: row.pages_crawled,
    healthScore: row.health_score,
    errorCount: row.error_count,
    warningCount: row.warning_count,
    noticeCount: row.notice_count,
    triggeredBy: row.triggered_by,
  };
}

async function insertRun(env: Env, startedAt: string, triggeredBy: string): Promise<number> {
  const result = await env.DB!.prepare(
    "INSERT INTO site_audit_runs (started_at, status, triggered_by) VALUES (?, 'running', ?)",
  )
    .bind(startedAt, triggeredBy)
    .run();
  return result.meta.last_row_id;
}

async function finalizeRun(
  env: Env,
  runId: number,
  status: AuditRunStatus,
  pagesCrawled: number,
  healthScore: number | null,
  errorCount: number,
  warningCount: number,
  noticeCount: number,
): Promise<void> {
  await env.DB!.prepare(
    `UPDATE site_audit_runs
     SET finished_at = ?, status = ?, pages_crawled = ?, health_score = ?,
         error_count = ?, warning_count = ?, notice_count = ?
     WHERE id = ?`,
  )
    .bind(new Date().toISOString(), status, pagesCrawled, healthScore, errorCount, warningCount, noticeCount, runId)
    .run();
}

/** Inserts crawled pages first (one batch, to get back D1's autoincrement
 * ids), then inserts issues in a second batch, resolving each issue's
 * page_id from the URL it was found on -- null stays null for site-wide
 * issues like "robots.txt not found". Two batches instead of one because
 * the issues insert depends on ids the pages insert hasn't produced yet. */
async function persistPagesAndIssues(
  env: Env,
  runId: number,
  pages: CrawledPage[],
  issues: CrawledIssue[],
): Promise<void> {
  const issueCountByUrl = new Map<string, number>();
  for (const issue of issues) {
    if (!issue.pageUrl) continue;
    issueCountByUrl.set(issue.pageUrl, (issueCountByUrl.get(issue.pageUrl) ?? 0) + 1);
  }

  const pageIdByUrl = new Map<string, number>();
  if (pages.length > 0) {
    const pageInserts = pages.map((page) =>
      env.DB!.prepare(
        `INSERT INTO site_audit_pages
          (run_id, url, status_code, title, meta_description, h1_count, issue_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        runId,
        page.url,
        page.statusCode,
        page.title,
        page.metaDescription,
        page.h1Count,
        issueCountByUrl.get(page.url) ?? 0,
      ),
    );
    const pageResults = await env.DB!.batch(pageInserts);
    pages.forEach((page, i) => pageIdByUrl.set(page.url, pageResults[i].meta.last_row_id));
  }

  if (issues.length > 0) {
    const issueInserts = issues.map((issue) =>
      env.DB!.prepare(
        `INSERT INTO site_audit_issues (run_id, page_id, severity, check_type, message) VALUES (?, ?, ?, ?, ?)`,
      ).bind(runId, issue.pageUrl ? (pageIdByUrl.get(issue.pageUrl) ?? null) : null, issue.severity, issue.checkType, issue.message),
    );
    await env.DB!.batch(issueInserts);
  }
}

async function getRunDetail(env: Env, runId: number): Promise<AuditRunDetailDTO | null> {
  const runRow = await env.DB!.prepare(
    `SELECT id, started_at, finished_at, status, pages_crawled, health_score,
            error_count, warning_count, notice_count, triggered_by
     FROM site_audit_runs WHERE id = ?`,
  )
    .bind(runId)
    .first<RunRow>();
  if (!runRow) return null;

  const { results: pageRows } = await env.DB!.prepare(
    `SELECT id, url, status_code, title, meta_description, h1_count, issue_count
     FROM site_audit_pages WHERE run_id = ? ORDER BY id ASC`,
  )
    .bind(runId)
    .all<{
      id: number;
      url: string;
      status_code: number | null;
      title: string | null;
      meta_description: string | null;
      h1_count: number;
      issue_count: number;
    }>();

  const { results: issueRows } = await env.DB!.prepare(
    `SELECT i.id, i.severity, i.check_type, i.message, p.url AS page_url
     FROM site_audit_issues i LEFT JOIN site_audit_pages p ON p.id = i.page_id
     WHERE i.run_id = ? ORDER BY i.id ASC`,
  )
    .bind(runId)
    .all<{ id: number; severity: AuditIssueDTO["severity"]; check_type: string; message: string; page_url: string | null }>();

  const pages: AuditPageDTO[] = pageRows.map((row) => ({
    id: row.id,
    url: row.url,
    statusCode: row.status_code,
    title: row.title,
    metaDescription: row.meta_description,
    h1Count: row.h1_count,
    issueCount: row.issue_count,
  }));

  const issues: AuditIssueDTO[] = issueRows.map((row) => ({
    id: row.id,
    severity: row.severity,
    checkType: row.check_type,
    message: row.message,
    pageUrl: row.page_url,
  }));

  return { ...rowToSummaryDTO(runRow), pages, issues };
}

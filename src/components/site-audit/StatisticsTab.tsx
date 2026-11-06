import type { ReactNode } from "react";
import type { AuditIssueDTO, AuditPageDTO } from "../../../shared/site-audit";

interface Props {
  pages: AuditPageDTO[];
  issues: AuditIssueDTO[];
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** SEMrush's Statistics tab, scoped to what this crawl actually measures.
 * Everything here is derived client-side from the already-fetched
 * pages/issues -- no extra backend calls, since a run's full page list is
 * already in memory once the Site Audit page has loaded. */
export function StatisticsTab({ pages, issues }: Props) {
  const statusBuckets = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, unreachable: 0 };
  for (const page of pages) {
    if (page.statusCode === null) statusBuckets.unreachable += 1;
    else if (page.statusCode < 300) statusBuckets["2xx"] += 1;
    else if (page.statusCode < 400) statusBuckets["3xx"] += 1;
    else if (page.statusCode < 500) statusBuckets["4xx"] += 1;
    else statusBuckets["5xx"] += 1;
  }

  let selfCanonical = 0;
  let crossCanonical = 0;
  let missingCanonical = 0;
  for (const page of pages) {
    if (!page.canonicalHref) {
      missingCanonical += 1;
      continue;
    }
    if (pathOf(page.canonicalHref) === pathOf(page.url)) selfCanonical += 1;
    else crossCanonical += 1;
  }

  const structuredDataCount = pages.filter((page) => page.hasStructuredData).length;

  const pagesWithMissingAlt = new Set(
    issues.filter((issue) => issue.checkType === "missing-alt" && issue.pageUrl).map((issue) => issue.pageUrl),
  ).size;

  const titleLengths = pages.filter((page) => page.title).map((page) => page.title!.length);
  const descriptionLengths = pages.filter((page) => page.metaDescription).map((page) => page.metaDescription!.length);

  return (
    <>
      <div className="analytics-chart-row">
        <StatCard title="HTTP status codes">
          <StatRow label="2xx (OK)" value={statusBuckets["2xx"]} />
          <StatRow label="3xx (Redirect)" value={statusBuckets["3xx"]} />
          <StatRow label="4xx (Client error)" value={statusBuckets["4xx"]} />
          <StatRow label="5xx (Server error)" value={statusBuckets["5xx"]} />
          <StatRow label="Unreachable" value={statusBuckets.unreachable} />
        </StatCard>

        <StatCard title="Canonicalization">
          <StatRow label="Self-canonical (healthy)" value={selfCanonical} />
          <StatRow label="Points to a different URL" value={crossCanonical} />
          <StatRow label="No canonical tag" value={missingCanonical} />
        </StatCard>

        <StatCard title="Content quality">
          <StatRow label="Pages with structured data" value={`${structuredDataCount} / ${pages.length}`} />
          <StatRow label="Pages missing ALT text somewhere" value={pagesWithMissingAlt} />
          <StatRow label="Average title length" value={`${average(titleLengths)} chars`} />
          <StatRow label="Average meta description length" value={`${average(descriptionLengths)} chars`} />
        </StatCard>
      </div>
    </>
  );
}

function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="analytics-chart-card">
      <h3>{title}</h3>
      <dl className="audit-stat-list">{children}</dl>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="audit-stat-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

import { useState } from "react";
import type { AuditIssueDTO, AuditPageDTO } from "../../../shared/site-audit";
import { AnalyticsTable } from "../analytics/AnalyticsTable";
import { CrawledPageDetailModal } from "./CrawledPageDetailModal";

function relativePagePath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export function CrawledPagesTab({ pages, issues }: { pages: AuditPageDTO[]; issues: AuditIssueDTO[] }) {
  const [selectedPage, setSelectedPage] = useState<AuditPageDTO | null>(null);

  return (
    <>
      <p className="audit-hint">Click a page to see its own issues in detail.</p>
      <div className="analytics-chart-row">
        <AnalyticsTable
          title="Crawled Pages"
          columns={["Page", "Status", "Title", "Issues"]}
          rows={pages.map((page) => [
            relativePagePath(page.url),
            page.statusCode?.toString() ?? "--",
            page.title ?? "--",
            page.issueCount.toString(),
          ])}
          onRowClick={(index) => setSelectedPage(pages[index])}
        />
      </div>

      {selectedPage && (
        <CrawledPageDetailModal
          page={selectedPage}
          issues={issues.filter((issue) => issue.pageUrl === selectedPage.url)}
          onClose={() => setSelectedPage(null)}
        />
      )}
    </>
  );
}

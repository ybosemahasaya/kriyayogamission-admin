import { useState } from "react";
import type { Theme } from "../hooks/useTheme";
import { useSiteAudit } from "../hooks/useSiteAudit";
import { AiSearchTab } from "./site-audit/AiSearchTab";
import { CompareCrawlsTab } from "./site-audit/CompareCrawlsTab";
import { CrawledPagesTab } from "./site-audit/CrawledPagesTab";
import { IssuesTab } from "./site-audit/IssuesTab";
import { JsImpactTab } from "./site-audit/JsImpactTab";
import { OverviewTab } from "./site-audit/OverviewTab";
import { ProgressTab } from "./site-audit/ProgressTab";
import { StatisticsTab } from "./site-audit/StatisticsTab";

type SiteAuditTab = "overview" | "issues" | "pages" | "statistics" | "compare" | "progress" | "ai-search" | "js-impact";

const TABS: { id: SiteAuditTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "issues", label: "Issues" },
  { id: "pages", label: "Crawled Pages" },
  { id: "statistics", label: "Statistics" },
  { id: "compare", label: "Compare Crawls" },
  { id: "progress", label: "Progress" },
  { id: "ai-search", label: "AI Search" },
  { id: "js-impact", label: "JS Impact" },
];

export function SiteAuditPage({ theme }: { theme: Theme }) {
  const { latest, history, loading, running, error, notConfigured, runAudit } = useSiteAudit();
  const [tab, setTab] = useState<SiteAuditTab>("overview");

  if (notConfigured) {
    return (
      <p className="empty-state">
        Site audit storage isn't provisioned yet -- create the D1 database for this project and uncomment the DB
        binding in wrangler.jsonc to enable this page.
      </p>
    );
  }

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

      {latest && (
        <>
          <div className="tabs site-audit-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? "tab active" : "tab"}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && <OverviewTab latest={latest} />}
          {tab === "issues" && <IssuesTab issues={latest.issues} />}
          {tab === "pages" && <CrawledPagesTab pages={latest.pages} issues={latest.issues} />}
          {tab === "statistics" && <StatisticsTab pages={latest.pages} issues={latest.issues} />}
          {tab === "compare" && <CompareCrawlsTab history={history} />}
          {tab === "progress" && <ProgressTab history={history} theme={theme} />}
          {tab === "ai-search" && <AiSearchTab pages={latest.pages} issues={latest.issues} />}
          {tab === "js-impact" && <JsImpactTab pages={latest.pages} />}
        </>
      )}
    </div>
  );
}

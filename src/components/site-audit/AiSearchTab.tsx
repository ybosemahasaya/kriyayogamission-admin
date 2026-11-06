import type { AuditIssueDTO, AuditPageDTO } from "../../../shared/site-audit";

interface Props {
  pages: AuditPageDTO[];
  issues: AuditIssueDTO[];
}

/** SEMrush's "AI Search" category, scoped to what a self-crawl can
 * actually measure: whether AI agents/LLM tools can find a curated
 * overview (llms.txt), whether structured data helps them understand
 * page content, and whether robots.txt opts in/out of known AI
 * crawlers. Keyword-ranking position data already exists elsewhere in
 * this admin panel (Analytics -> Search Console, via the real Search
 * Console API) rather than being rebuilt here. Backlinks are explicitly
 * NOT shown here -- see the note at the bottom for why. */
export function AiSearchTab({ pages, issues }: Props) {
  const llmsTxtMissing = issues.some((issue) => issue.checkType === "llms-txt-missing");
  const aiBotsBlocked = issues.some((issue) => issue.checkType === "ai-bots-blocked");
  const aiBotsAllowed = issues.some((issue) => issue.checkType === "ai-bots-allowed");
  const structuredDataCount = pages.filter((page) => page.hasStructuredData).length;

  return (
    <>
      <div className="analytics-chart-row">
        <StatusCard
          title="llms.txt"
          status={llmsTxtMissing ? "bad" : "ok"}
          statusLabel={llmsTxtMissing ? "Not found" : "Found"}
          description="A curated, LLM-friendly overview of the site at /llms.txt (llmstxt.org)."
        />
        <StatusCard
          title="AI crawlers (robots.txt)"
          status="neutral"
          statusLabel={aiBotsBlocked ? "Blocked" : aiBotsAllowed ? "Allowed" : "Unknown"}
          description="Whether GPTBot, ClaudeBot, Google-Extended, PerplexityBot, and CCBot are explicitly blocked in robots.txt. Neither state is inherently right or wrong -- it's a policy choice."
        />
        <StatusCard
          title="Structured data"
          status={structuredDataCount === pages.length ? "ok" : structuredDataCount === 0 ? "bad" : "neutral"}
          statusLabel={`${structuredDataCount} / ${pages.length} pages`}
          description="Pages with JSON-LD (schema.org) markup, which helps both search engines and AI tools understand page content without guessing from prose."
        />
      </div>

      <div className="audit-ai-search-note">
        <h3>What's not here, and why</h3>
        <p>
          <strong>Keyword-ranking / search position</strong> data isn't duplicated here -- it already exists in{" "}
          <strong>Analytics &rarr; Search Console</strong>, pulled live from Google's real Search Console API
          (queries, impressions, position). That's the same data SEMrush's keyword tools approximate; ours comes
          straight from the source.
        </p>
        <p>
          <strong>Backlinks</strong> genuinely can't be built from a self-crawl -- discovering who links to this site
          from elsewhere on the web requires either a paid third-party link index (Ahrefs, Moz, SEMrush's own), or
          manually checking Search Console's "Links" report in Google's own dashboard, which Google does not expose
          through its public Search Console API. Rather than fake this data, it's left out entirely.
        </p>
      </div>
    </>
  );
}

function StatusCard({
  title,
  status,
  statusLabel,
  description,
}: {
  title: string;
  status: "ok" | "bad" | "neutral";
  statusLabel: string;
  description: string;
}) {
  return (
    <div className="analytics-chart-card">
      <h3>{title}</h3>
      <span className={`audit-status-pill audit-status-pill-${status}`}>{statusLabel}</span>
      <p className="audit-status-card-description">{description}</p>
    </div>
  );
}

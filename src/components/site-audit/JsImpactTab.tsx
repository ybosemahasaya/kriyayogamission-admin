import type { AuditPageDTO } from "../../../shared/site-audit";

/** SEMrush's JS Impact tab compares a page rendered with vs. without
 * JavaScript to see what content a non-JS crawler would miss. This
 * crawler's fetch() calls never execute JavaScript at all (Workers
 * doesn't run a browser) -- so every title/H1/meta-description check
 * elsewhere in this audit already happened against the exact same
 * "JS disabled" snapshot a JS-impact tool would compare against. That
 * makes the stat below a real finding, not a guess: if every page's
 * critical content was already readable from that raw HTML, there is
 * no JS-rendering gap on this site to report. */
export function JsImpactTab({ pages }: { pages: AuditPageDTO[] }) {
  const withCriticalContent = pages.filter((page) => page.title && page.h1Count > 0).length;
  const allHealthy = pages.length > 0 && withCriticalContent === pages.length;

  return (
    <div className="analytics-chart-row">
      <div className="analytics-chart-card">
        <h3>Content visible without JavaScript</h3>
        <span className={`audit-status-pill ${allHealthy ? "audit-status-pill-ok" : "audit-status-pill-neutral"}`}>
          {withCriticalContent} / {pages.length} pages
        </span>
        <p className="audit-status-card-description">
          Title and H1 found directly in the raw HTML this crawler fetched -- the same "JavaScript disabled" snapshot
          a dedicated JS-impact tool would compare against a JS-rendered version.
        </p>
      </div>

      <div className="analytics-chart-card">
        <h3>Why there's no rendering diff to show</h3>
        <p className="audit-status-card-description">
          This site is built with Astro and ships fully pre-rendered static HTML -- there's no client-side framework
          hydrating critical content after page load, so a "with JS" vs. "without JS" comparison would show identical
          results. If that ever changes (e.g. a client-side-rendered section is added), a literal pixel/DOM diff would
          need a headless browser, which Cloudflare offers as a separate, metered Browser Rendering API binding --
          worth adding only if this site's architecture changes to need it.
        </p>
      </div>
    </div>
  );
}

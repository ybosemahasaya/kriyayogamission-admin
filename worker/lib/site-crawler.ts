/** The crawl + rule engine behind the Mini Site Audit feature. Fetches
 * this site's own public pages over plain HTTP (exactly like SEMrush's
 * crawler, or a browser, would) and runs a small set of checks that
 * matter for an ~18-page static site. See the "mini-site-audit" roadmap
 * item in docs/admin-panel-architecture.html for what's deliberately out
 * of scope (JS-rendering impact, hreflang, AI Search scoring, etc.) and
 * why -- several SEMrush categories already have a dedicated, better
 * data source elsewhere in this admin panel (Search Console, the
 * roadmapped CrUX/PageSpeed card, the roadmapped Cloudflare Web
 * Analytics card).
 *
 * Fetch budget: Workers cap subrequests per request (50 on the free
 * plan). This crawl uses robots.txt (1) + sitemap-index.xml (1) + each
 * nested sitemap file (usually 1) + one fetch per page (~18 today) +
 * up to MAX_LINK_CONFIRM_FETCHES confirmation fetches for internal links
 * that aren't already part of the known page set -- comfortably under
 * the cap with room for the site to grow before this needs revisiting. */

import type { Env } from "../types";
import type { AuditSeverity } from "../../shared/site-audit";

const SITE_ORIGIN = "https://kriyayogamission.org";
const MAX_PAGES = 60; // generous ceiling above today's ~18 sitemap pages
const MAX_LINK_CONFIRM_FETCHES = 10;

export interface CrawledIssue {
  pageUrl: string | null; // null = site-wide
  severity: AuditSeverity;
  checkType: string;
  message: string;
}

export interface CrawledPage {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  canonicalHref: string | null;
  imagesMissingAlt: number;
  internalLinks: string[]; // raw href values found on this page, same-origin only
  mixedContentCount: number;
}

export interface AuditResult {
  pages: CrawledPage[];
  issues: CrawledIssue[];
}

/** Strips query/hash and a trailing slash (except the bare root) so links
 * discovered on the page compare equal to sitemap URLs regardless of how
 * they were written -- matches this site's own trailingSlash: "never"
 * convention (see astro.config.mjs). */
function normalizePath(pathname: string): string {
  const withoutTrailingSlash = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return withoutTrailingSlash || "/";
}

function toAbsoluteSameOrigin(href: string, baseUrl: string): URL | null {
  try {
    const resolved = new URL(href, baseUrl);
    const host = resolved.hostname.replace(/^www\./, "");
    if (host !== new URL(SITE_ORIGIN).hostname) return null; // external link, not our concern here
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null; // mailto:, tel:, etc.
    return resolved;
  } catch {
    return null;
  }
}

async function checkRobotsTxt(): Promise<CrawledIssue[]> {
  const issues: CrawledIssue[] = [];
  try {
    const res = await fetch(`${SITE_ORIGIN}/robots.txt`);
    if (!res.ok) {
      issues.push({ pageUrl: null, severity: "warning", checkType: "robots-missing", message: "robots.txt not found" });
      return issues;
    }
    const text = await res.text();
    if (!/sitemap:/i.test(text)) {
      issues.push({
        pageUrl: null,
        severity: "warning",
        checkType: "robots-no-sitemap",
        message: "Sitemap.xml not specified in robots.txt",
      });
    }
  } catch {
    issues.push({ pageUrl: null, severity: "warning", checkType: "robots-missing", message: "robots.txt not found" });
  }
  return issues;
}

/** Returns the page URLs this site wants indexed, by following
 * sitemap-index.xml -> each nested sitemap file -> each <loc>. Astro's
 * @astrojs/sitemap integration always produces this two-level shape (see
 * astro.config.mjs), so a simple regex extraction is enough here --
 * no need for a full XML parser for a file this site fully controls. */
async function fetchSitemapPageUrls(): Promise<{ urls: string[]; issues: CrawledIssue[] }> {
  const issues: CrawledIssue[] = [];
  const locPattern = /<loc>(.*?)<\/loc>/g;

  async function extractLocs(url: string): Promise<string[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    const text = await res.text();
    return [...text.matchAll(locPattern)].map((m) => m[1].trim());
  }

  let indexEntries: string[];
  try {
    indexEntries = await extractLocs(`${SITE_ORIGIN}/sitemap-index.xml`);
  } catch {
    issues.push({ pageUrl: null, severity: "error", checkType: "sitemap-missing", message: "Sitemap.xml not found" });
    return { urls: [], issues };
  }

  const pageUrls: string[] = [];
  for (const entry of indexEntries) {
    if (entry.endsWith(".xml")) {
      try {
        pageUrls.push(...(await extractLocs(entry)));
      } catch {
        issues.push({
          pageUrl: null,
          severity: "error",
          checkType: "sitemap-entry-unreachable",
          message: `Nested sitemap unreachable: ${entry}`,
        });
      }
    } else {
      pageUrls.push(entry); // sitemap-index.xml pointed straight at a page, not a nested sitemap
    }
  }

  return { urls: [...new Set(pageUrls)].slice(0, MAX_PAGES), issues };
}

/** Fetches one page and, if it's HTML, uses HTMLRewriter to pull out the
 * handful of elements the checks below care about. HTMLRewriter is lazy
 * -- it only runs its handlers while the transformed body is being read,
 * so the `.arrayBuffer()` call is what actually drives the extraction,
 * not a redundant step. */
async function crawlPage(url: string): Promise<CrawledPage> {
  const page: CrawledPage = {
    url,
    statusCode: null,
    title: null,
    metaDescription: null,
    h1Count: 0,
    canonicalHref: null,
    imagesMissingAlt: 0,
    internalLinks: [],
    mixedContentCount: 0,
  };

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return page; // statusCode stays null -- treated as unreachable by the caller
  }
  page.statusCode = res.status;
  if (!res.ok) return page;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return page;

  let titleText = "";
  const rewriter = new HTMLRewriter()
    .on("title", {
      text(chunk) {
        titleText += chunk.text;
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        page.metaDescription = el.getAttribute("content");
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        page.canonicalHref = el.getAttribute("href");
      },
    })
    .on("h1", {
      element() {
        page.h1Count += 1;
      },
    })
    .on("img", {
      element(el) {
        const alt = el.getAttribute("alt");
        if (alt === null || alt.trim() === "") page.imagesMissingAlt += 1;
      },
    })
    .on("a[href]", {
      element(el) {
        const href = el.getAttribute("href");
        if (href && toAbsoluteSameOrigin(href, url)) page.internalLinks.push(href);
        if (href?.startsWith("http://")) page.mixedContentCount += 1;
      },
    })
    .on("script[src], img[src], link[rel=stylesheet][href]", {
      element(el) {
        const src = el.getAttribute("src") ?? el.getAttribute("href");
        if (src?.startsWith("http://")) page.mixedContentCount += 1;
      },
    });

  await rewriter.transform(res).arrayBuffer();
  page.title = titleText.trim() || null;
  return page;
}

function runPerPageChecks(page: CrawledPage): CrawledIssue[] {
  const issues: CrawledIssue[] = [];
  const add = (severity: AuditSeverity, checkType: string, message: string) =>
    issues.push({ pageUrl: page.url, severity, checkType, message });

  if (page.statusCode === null) {
    add("error", "unreachable", "We couldn't open the page's URL");
    return issues; // nothing else to check on a page that never loaded
  }
  if (page.statusCode >= 500) add("error", "5xx-error", `Server error (${page.statusCode})`);
  else if (page.statusCode >= 400) add("error", "4xx-error", `Page not found (${page.statusCode})`);
  if (page.statusCode >= 300 && page.statusCode < 400) return issues; // redirects aren't crawled further

  if (!page.title) add("error", "missing-title", "Missing title tag");
  if (!page.metaDescription) add("warning", "missing-meta-description", "Missing meta description");
  if (page.h1Count === 0) add("error", "missing-h1", "Missing H1");
  else if (page.h1Count > 1) add("notice", "multiple-h1", `Multiple H1 tags (${page.h1Count})`);
  if (page.imagesMissingAlt > 0) {
    add("warning", "missing-alt", `${page.imagesMissingAlt} image(s) missing ALT attributes`);
  }
  if (!page.canonicalHref) add("notice", "missing-canonical", "No canonical tag found");
  if (page.mixedContentCount > 0) {
    add("error", "mixed-content", `${page.mixedContentCount} resource(s) loaded over HTTP on this HTTPS page`);
  }
  return issues;
}

/** Flags titles/meta descriptions shared by more than one page -- the
 * same signal SEMrush's "Duplicate title tags"/"Duplicate meta
 * descriptions" checks surface. */
function runCrossPageChecks(pages: CrawledPage[]): CrawledIssue[] {
  const issues: CrawledIssue[] = [];

  function flagDuplicates(getValue: (p: CrawledPage) => string | null, checkType: string, label: string) {
    const seen = new Map<string, CrawledPage[]>();
    for (const page of pages) {
      const value = getValue(page);
      if (!value) continue;
      const group = seen.get(value) ?? [];
      group.push(page);
      seen.set(value, group);
    }
    for (const group of seen.values()) {
      if (group.length < 2) continue;
      for (const page of group) {
        issues.push({ pageUrl: page.url, severity: "warning", checkType, message: `Duplicate ${label} shared with ${group.length - 1} other page(s)` });
      }
    }
  }

  flagDuplicates((p) => p.title, "duplicate-title", "title tag");
  flagDuplicates((p) => p.metaDescription, "duplicate-meta-description", "meta description");
  return issues;
}

/** Internal links that don't point at a page this crawl already fetched
 * get a confirmation fetch (capped) rather than being assumed broken --
 * a link to /contact/thank-you or /404 is deliberately excluded from the
 * sitemap (see astro.config.mjs's sitemap filter) but is still a real,
 * working page. */
async function checkBrokenInternalLinks(pages: CrawledPage[]): Promise<CrawledIssue[]> {
  const issues: CrawledIssue[] = [];
  const knownPaths = new Set(pages.map((p) => normalizePath(new URL(p.url).pathname)));
  const toConfirm = new Map<string, { href: string; sourcePage: string }>();

  for (const page of pages) {
    for (const href of page.internalLinks) {
      const absolute = toAbsoluteSameOrigin(href, page.url);
      if (!absolute) continue;
      const path = normalizePath(absolute.pathname);
      if (knownPaths.has(path)) continue;
      if (!toConfirm.has(path)) toConfirm.set(path, { href: absolute.toString(), sourcePage: page.url });
    }
  }

  const candidates = [...toConfirm.values()].slice(0, MAX_LINK_CONFIRM_FETCHES);
  await Promise.all(
    candidates.map(async ({ href, sourcePage }) => {
      try {
        const res = await fetch(href, { method: "HEAD" });
        if (!res.ok) {
          issues.push({
            pageUrl: sourcePage,
            severity: "warning",
            checkType: "broken-internal-link",
            message: `Broken internal link to ${href} (${res.status})`,
          });
        }
      } catch {
        issues.push({
          pageUrl: sourcePage,
          severity: "warning",
          checkType: "broken-internal-link",
          message: `Broken internal link to ${href} (unreachable)`,
        });
      }
    }),
  );
  return issues;
}

export function computeHealthScore(errorCount: number, warningCount: number, noticeCount: number): number {
  const deduction = errorCount * 5 + warningCount * 2 + noticeCount * 0.5;
  return Math.max(0, Math.min(100, Math.round(100 - deduction)));
}

/** Runs the full crawl and returns raw results -- persistence lives in
 * worker/api/site-audit.ts so this module stays focused on "what did we
 * find", not "how is it stored". */
export async function runSiteAudit(_env: Env): Promise<AuditResult> {
  const issues: CrawledIssue[] = [];

  issues.push(...(await checkRobotsTxt()));

  const { urls, issues: sitemapIssues } = await fetchSitemapPageUrls();
  issues.push(...sitemapIssues);

  // Small concurrency batches, not pure sequential or pure Promise.all --
  // kind to the target site and keeps total latency reasonable for an
  // admin watching a "Run Audit" spinner.
  const pages: CrawledPage[] = [];
  const BATCH_SIZE = 5;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    pages.push(...(await Promise.all(batch.map(crawlPage))));
  }

  for (const page of pages) issues.push(...runPerPageChecks(page));
  issues.push(...runCrossPageChecks(pages));
  issues.push(...(await checkBrokenInternalLinks(pages)));

  return { pages, issues };
}

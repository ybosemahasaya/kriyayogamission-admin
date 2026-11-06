/** Static "About the issue" / "How to fix" copy for each site-audit
 * checkType, keyed the same way worker/lib/site-crawler.ts names its
 * checks. Deliberately plain data (no i18n, no CMS) -- this is reference
 * copy for admins, not end-user content, and the check list is small and
 * stable enough that a flat lookup table is simpler than anything fancier
 * (YAGNI: a database table for this would be solving a problem we don't
 * have yet). Mirrors the "About the issue" / "How to fix" panel SEMrush
 * shows per issue -- see the mini-site-audit roadmap item. */

export interface AuditCheckInfo {
  about: string;
  howToFix: string[];
}

export const AUDIT_CHECK_INFO: Record<string, AuditCheckInfo> = {
  unreachable: {
    about: "The crawler couldn't open this page's URL at all -- a network failure, not an HTTP error status.",
    howToFix: [
      "Open the URL directly in a browser to confirm it loads.",
      "Check that the URL in the sitemap matches a real, published page.",
      "Re-run the audit -- a one-off network blip resolves itself.",
    ],
  },
  "5xx-error": {
    about: "The page returned a server error. The page is broken for every visitor, not just this crawler.",
    howToFix: [
      "Check the Cloudflare Workers Builds deploy logs for the public site for a failed or broken deploy.",
      "Open the URL directly to see the actual error.",
      "If it's intermittent, check Cloudflare's status page and the Worker's own error logs.",
    ],
  },
  "4xx-error": {
    about: "The page returned a not-found (or similar client error) status. Something links to a page that no longer exists.",
    howToFix: [
      "Confirm whether the page was intentionally removed or renamed.",
      "If renamed, add a redirect in public/_redirects.",
      "If intentional, remove any remaining links to it and let it drop out of the sitemap naturally.",
    ],
  },
  "missing-title": {
    about: "The page has no <title> tag. Search engines and browser tabs have nothing meaningful to show for it.",
    howToFix: [
      "Pass a title prop to BaseLayout for this page (see any other src/pages/*.astro file for the pattern).",
      "Keep it under ~60 characters and specific to the page's content.",
    ],
  },
  "missing-meta-description": {
    about: "No meta description means search engines will auto-generate a snippet from the page body, which is usually worse than a written one.",
    howToFix: [
      "Pass a description prop to BaseLayout for this page.",
      "Write 1-2 sentences (~150-160 characters) summarizing the page for someone scanning search results.",
    ],
  },
  "missing-h1": {
    about: "No H1 heading. H1 is the strongest on-page signal for what a page is about, for both search engines and screen reader users.",
    howToFix: [
      "Add exactly one <h1> near the top of the page's main content.",
      "Make it describe the page, not a generic site-wide heading.",
    ],
  },
  "multiple-h1": {
    about: "More than one H1 on the page dilutes the page's single clearest topic signal.",
    howToFix: [
      "Keep one H1 for the page's main heading.",
      "Change the others to H2/H3 depending on where they sit in the content hierarchy.",
    ],
  },
  "missing-alt": {
    about: "Images without ALT text are invisible to screen readers and search engine image indexing -- an accessibility issue as much as an SEO one.",
    howToFix: [
      "Add a short, descriptive alt attribute to each flagged image.",
      "Purely decorative images (not content) can use alt=\"\" (empty, not missing) to be explicitly skipped by screen readers.",
    ],
  },
  "missing-canonical": {
    about: "No canonical tag. Usually harmless on a small single-language site like this one, but it's the one signal that prevents duplicate-content confusion if a page is ever reachable at more than one URL.",
    howToFix: [
      "Add <link rel=\"canonical\" href=\"...\"> pointing at the page's own preferred URL.",
      "BaseLayout already computes canonicalURL from Astro.url -- confirm the page actually renders that <link> tag.",
    ],
  },
  "mixed-content": {
    about: "An HTTPS page is loading a resource (image, script, or stylesheet) over plain HTTP. Browsers may block or warn about this.",
    howToFix: [
      "Change the flagged resource's URL from http:// to https://.",
      "If it's a third-party resource that doesn't support HTTPS, consider removing it.",
    ],
  },
  "duplicate-title": {
    about: "Two or more pages share the exact same <title>. Search engines may struggle to tell them apart in results.",
    howToFix: [
      "Give each page a distinct, specific title reflecting its own content.",
    ],
  },
  "duplicate-meta-description": {
    about: "Two or more pages share the exact same meta description, which wastes the opportunity to differentiate them in search results.",
    howToFix: [
      "Write a unique description for each page.",
    ],
  },
  "broken-internal-link": {
    about: "A link on this page points to another page on this site that doesn't resolve successfully.",
    howToFix: [
      "Confirm the target page's real URL and fix the link.",
      "If the target page was removed, either remove the link or point it somewhere still valid.",
    ],
  },
  "robots-missing": {
    about: "No robots.txt file. Not strictly required, but its absence means there's no explicit, central place telling crawlers where the sitemap lives.",
    howToFix: [
      "Add a robots.txt file in the public/ directory of the public site's repo.",
    ],
  },
  "robots-no-sitemap": {
    about: "robots.txt exists but doesn't point to the sitemap, making it harder for crawlers to discover all pages efficiently.",
    howToFix: [
      "Add a line like \"Sitemap: https://kriyayogamission.org/sitemap-index.xml\" to public/robots.txt.",
    ],
  },
  "sitemap-missing": {
    about: "sitemap-index.xml isn't reachable, which is also why this audit itself found 0 pages to crawl.",
    howToFix: [
      "Confirm the public site actually built and deployed successfully.",
      "@astrojs/sitemap generates this automatically at build time -- check astro.config.mjs's sitemap integration is still configured.",
    ],
  },
  "sitemap-entry-unreachable": {
    about: "A nested sitemap file referenced from sitemap-index.xml couldn't be fetched.",
    howToFix: [
      "Open the nested sitemap URL directly to see the real error.",
      "Usually resolves itself after the next successful deploy.",
    ],
  },
  "llms-txt-missing": {
    about: "No /llms.txt file. This is an emerging convention (not a search-ranking factor) that gives AI agents/LLM-based tools a concise, curated overview of the site instead of having to parse full HTML pages.",
    howToFix: [
      "Add a public/llms.txt file following the llms.txt v2 spec (llmstxt.org): an H1 site name, a blockquote summary, then markdown link sections to key pages.",
      "Keep it updated as pages are added or renamed -- it's a static file, not auto-generated.",
    ],
  },
  "ai-bots-blocked": {
    about: "robots.txt explicitly blocks all known AI crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot, etc.). This is a policy status, not a problem -- it means this site's content won't be used to train or be retrieved by those AI systems.",
    howToFix: [
      "No action needed if this is the intended policy.",
      "If you'd rather AI assistants be able to find and cite this site's content, remove the relevant Disallow rules from public/robots.txt.",
    ],
  },
  "ai-bots-allowed": {
    about: "robots.txt does not block one or more known AI crawlers. This may be intentional (letting AI assistants discover and cite this content) or accidental.",
    howToFix: [
      "If intentional, no action needed -- combined with an llms.txt file, this helps AI tools understand and reference the site accurately.",
      "If you want to opt out, add 'User-agent: <bot>' + 'Disallow: /' blocks to public/robots.txt for each crawler you want to exclude (GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, CCBot).",
    ],
  },
};

export const DEFAULT_CHECK_INFO: AuditCheckInfo = {
  about: "No additional detail is available for this check yet.",
  howToFix: ["Open the affected page directly and investigate the message above."],
};

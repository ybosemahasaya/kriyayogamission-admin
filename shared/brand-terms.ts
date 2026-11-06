/** Brand terms for classifying Search Console queries as "branded"
 * (searcher already knows this is Kriya Yoga Mission / its guru) vs.
 * "non-branded" (searcher is looking for a topic, this site is one of
 * many possible results). Deliberately does NOT include "kriya yoga" or
 * "brahmachari" alone -- those are generic terms thousands of unrelated
 * pages compete for, not evidence of brand awareness; conflating them
 * with real branded searches would hide the non-branded traffic this
 * site should actually be growing. Keep this list in sync with any
 * future rename/rebrand or change of guru. */
export const BRAND_TERMS = ["kriya yoga mission", "kriyayogamission", "kym", "swarupananda"];

export function isBrandedQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  return BRAND_TERMS.some((term) => normalized.includes(term));
}

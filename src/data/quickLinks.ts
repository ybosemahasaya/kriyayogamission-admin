export interface QuickLink {
  label: string;
  url: string;
  description: string;
}

export interface QuickLinkGroup {
  category: string;
  links: QuickLink[];
}

/**
 * Just bookmarks -- none of these URLs are secrets (no API keys/tokens
 * embedded in them, just dashboard deep-link identifiers like GA's
 * property/comparison IDs), so this is safe to keep in the client bundle.
 * Add new entries here directly; no other code needs to change.
 */
export const QUICK_LINKS: QuickLinkGroup[] = [
  {
    category: "Infrastructure",
    links: [
      {
        label: "Cloudflare Dashboard",
        url: "https://dash.cloudflare.com",
        description: "Workers, R2, D1, Zero Trust / Access, DNS",
      },
      {
        label: "Google Cloud Console",
        url: "https://console.cloud.google.com/welcome/new?project=kriya-yoga-mission",
        description: "GCP project backing the GA4 Data API (OAuth / service account)",
      },
    ],
  },
  {
    category: "Code",
    links: [
      {
        label: "GitHub — Public Site",
        url: "https://github.com/ybosemahasaya/kriyayogamission",
        description: "kriyayogamission.org source",
      },
      {
        label: "GitHub — Admin Panel",
        url: "https://github.com/ybosemahasaya/kriyayogamission-admin",
        description: "This admin console's source",
      },
    ],
  },
  {
    category: "Analytics",
    links: [
      {
        label: "Google Analytics",
        url: "https://analytics.google.com/analytics/web/?utm_source=marketingplatform.google.com&utm_medium=et&utm_campaign=marketingplatform.google.com/about/analytics/&hl=en#/a411977548p558900253/reports/reportinghub?params=_u..nav%3Dmaui%26_u..comparisons%3D%5B%7B%22savedComparisonId%22:%2216128931810%22,%22name%22:%22All%20Users%22,%22isEnabled%22:true,%22filters%22:%5B%5D,%22systemDefinedSavedComparisonType%22:8,%22isSystemDefined%22:true%7D,%7B%22savedComparisonId%22:%2216128931802%22,%22name%22:%22Direct%20traffic%22,%22isEnabled%22:true,%22filters%22:%5B%7B%22fieldName%22:%22sessionDefaultChannelGrouping%22,%22expressionList%22:%5B%22Direct%22%5D,%22isCaseSensitive%22:true%7D%5D,%22systemDefinedSavedComparisonType%22:1,%22isSystemDefined%22:true%7D,%7B%22savedComparisonId%22:%2216128931803%22,%22name%22:%22Organic%20traffic%22,%22isEnabled%22:true,%22filters%22:%5B%7B%22fieldName%22:%22sessionDefaultChannelGrouping%22,%22evaluationType%22:8,%22expressionList%22:%5B%22Organic%20Search%22,%22Organic%20Video%22,%22Organic%20Social%22,%22Organic%20Shopping%22%5D,%22isCaseSensitive%22:true%7D%5D,%22systemDefinedSavedComparisonType%22:2,%22isSystemDefined%22:true%7D,%7B%22savedComparisonId%22:%2216128931804%22,%22name%22:%22Paid%20traffic%22,%22isEnabled%22:true,%22filters%22:%5B%7B%22fieldName%22:%22sessionDefaultChannelGrouping%22,%22evaluationType%22:8,%22expressionList%22:%5B%22Paid%20Shopping%22,%22Paid%20Search%22,%22Paid%20Social%22,%22Paid%20Other%22,%22Paid%20Video%22,%22Display%22,%22Cross-network%22,%22Audio%22%5D,%22isCaseSensitive%22:true%7D%5D,%22systemDefinedSavedComparisonType%22:3,%22isSystemDefined%22:true%7D%5D%26_u..built_comparisons_enabled%3Dtrue&collectionId=16203862068&discardConfirmed=true",
        description: "GA4 reporting hub for kriyayogamission.org",
      },
      {
        label: "Google Search Console",
        url: "https://search.google.com/search-console?resource_id=sc-domain%3Akriyayogamission.org",
        description: "Indexing, search performance, sitemaps",
      },
    ],
  },
  {
    category: "SEO Tools",
    links: [
      {
        label: "SEMrush — Site Audit Issue #112",
        url: "https://www.semrush.com/siteaudit/campaign/31894957/review/issue/detail/112?sort=url_asc",
        description: "Campaign 31894957, issue detail drill-down (URL list sorted ascending) -- external SEMrush audit, separate from this app's own Site Audit tab",
      },
    ],
  },
  {
    category: "Email",
    links: [
      {
        label: "Resend",
        url: "https://resend.com/",
        description: "Transactional / SMTP email provider",
      },
    ],
  },
];

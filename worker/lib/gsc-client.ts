/**
 * Thin wrapper around the Search Console API's searchAnalytics.query
 * endpoint -- same shape/philosophy as ga4-client.ts. Confirmed against
 * Google's docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 *
 * Unlike GA4, there's no batch endpoint here -- each query (totals, top
 * queries, top pages, devices, ...) is its own HTTP call. Dates are
 * literal "YYYY-MM-DD" strings too; GSC doesn't understand GA4's
 * relative "7daysAgo" shorthand.
 */

const BASE_URL = "https://www.googleapis.com/webmasters/v3";

export type GscDimension = "query" | "page" | "country" | "device" | "date";

export interface GscQueryRequest {
  startDate: string;
  endDate: string;
  dimensions?: GscDimension[];
  rowLimit?: number;
}

export interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryResponse {
  rows?: GscRow[];
}

export async function querySearchAnalytics(
  siteUrl: string,
  accessToken: string,
  request: GscQueryRequest,
): Promise<GscQueryResponse> {
  const res = await fetch(`${BASE_URL}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Search Console searchAnalytics.query failed: ${res.status} ${text}`);
  }

  return res.json();
}

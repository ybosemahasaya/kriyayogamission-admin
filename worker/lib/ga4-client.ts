/**
 * Thin wrapper around the GA4 Data API's REST endpoints. Confirmed
 * against Google's official docs: batchRunReports allows at most 5
 * report requests per call (developers.google.com/analytics/devguides/
 * reporting/data/v1/rest/v1beta/properties/batchRunReports), which is
 * why worker/api/analytics.ts splits its report list into two batches.
 */

const BASE_URL = "https://analyticsdata.googleapis.com/v1beta";

export interface GA4DateRange {
  startDate: string;
  endDate: string;
  name?: string;
}

export interface GA4ReportRequest {
  property: string;
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  dateRanges: GA4DateRange[];
  orderBys?: unknown[];
  limit?: string;
}

export interface GA4Row {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

export interface GA4ReportResponse {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string; type: string }[];
  rows?: GA4Row[];
}

export async function batchRunReports(
  propertyId: string,
  accessToken: string,
  requests: GA4ReportRequest[],
): Promise<GA4ReportResponse[]> {
  if (requests.length > 5) {
    throw new Error(`batchRunReports supports at most 5 requests per call, got ${requests.length}`);
  }

  const res = await fetch(`${BASE_URL}/properties/${propertyId}:batchRunReports`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GA4 batchRunReports failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { reports: GA4ReportResponse[] };
  return data.reports;
}

export async function runRealtimeReport(propertyId: string, accessToken: string): Promise<GA4ReportResponse> {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}:runRealtimeReport`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ metrics: [{ name: "activeUsers" }] }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GA4 runRealtimeReport failed: ${res.status} ${text}`);
  }

  return res.json();
}

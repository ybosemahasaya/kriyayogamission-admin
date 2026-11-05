import type {
  AnalyticsChannel,
  AnalyticsCountry,
  AnalyticsDevice,
  AnalyticsDTO,
  AnalyticsRange,
  AnalyticsRealtimeDTO,
  AnalyticsSegment,
  AnalyticsSummary,
  AnalyticsTimeseriesPoint,
  AnalyticsTopPage,
} from "../../shared/analytics";
import { batchRunReports, runRealtimeReport, type GA4ReportResponse, type GA4Row } from "../lib/ga4-client";
import { getGoogleAccessToken } from "../lib/google-auth";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

function parseRange(value: string | null): AnalyticsRange {
  if (value === "30d" || value === "90d") return value;
  return "7d";
}

/** GA4 understands relative date strings directly ("7daysAgo",
 * "yesterday") -- no need to compute literal ISO dates ourselves. The
 * "previous" window is the same-length period immediately before
 * "current", e.g. for 7d: current = 7daysAgo..yesterday, previous =
 * 14daysAgo..8daysAgo. */
function buildDateRanges(range: AnalyticsRange) {
  const days = RANGE_DAYS[range];
  return {
    current: { startDate: `${days}daysAgo`, endDate: "yesterday", name: "current" },
    previous: { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: "previous" },
  };
}

interface Credentials {
  propertyId: string;
  email: string;
  privateKey: string;
}

function requireCredentials(env: Env): Credentials | null {
  if (!env.GA4_PROPERTY_ID || !env.GA4_SERVICE_ACCOUNT_EMAIL || !env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return null;
  }
  return {
    propertyId: env.GA4_PROPERTY_ID,
    email: env.GA4_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
}

function dimensionValue(row: GA4Row | undefined, index: number): string {
  return row?.dimensionValues?.[index]?.value ?? "";
}

function metricValue(row: GA4Row | undefined, index: number): number {
  const raw = row?.metricValues?.[index]?.value;
  return raw ? Number(raw) : 0;
}

export async function handleAnalyticsSummaryRequest(request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Analytics is not configured yet.", 503);

  const range = parseRange(new URL(request.url).searchParams.get("range"));
  const { current, previous } = buildDateRanges(range);
  const property = `properties/${creds.propertyId}`;
  const accessToken = await getGoogleAccessToken(creds);

  // Split across two batchRunReports calls -- Google caps each batch at
  // 5 report requests (see ga4-client.ts).
  const [batchA, batchB] = await Promise.all([
    batchRunReports(creds.propertyId, accessToken, [
      {
        property,
        dateRanges: [current, previous],
        metrics: [
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
          { name: "conversions" },
        ],
      },
      {
        property,
        dateRanges: [current],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
      {
        property,
        dateRanges: [current],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "10",
      },
      {
        property,
        dateRanges: [current],
        dimensions: [{ name: "sessionDefaultChannelGrouping" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
      {
        property,
        dateRanges: [current],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    ]),
    batchRunReports(creds.propertyId, accessToken, [
      {
        property,
        dateRanges: [current],
        dimensions: [{ name: "newVsReturning" }],
        metrics: [{ name: "totalUsers" }],
      },
      {
        property,
        dateRanges: [current],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "10",
      },
    ]),
  ]);

  const [summaryReport, timeseriesReport, topPagesReport, channelsReport, devicesReport] = batchA;
  const [newVsReturningReport, geoReport] = batchB;

  const payload: AnalyticsDTO = {
    range,
    summary: shapeSummary(summaryReport),
    timeseries: shapeTimeseries(timeseriesReport),
    topPages: shapeTopPages(topPagesReport),
    channels: shapeChannels(channelsReport),
    devices: shapeDevices(devicesReport),
    newVsReturning: shapeNewVsReturning(newVsReturningReport),
    geo: shapeGeo(geoReport),
  };

  return json(payload);
}

export async function handleAnalyticsRealtimeRequest(_request: Request, env: Env): Promise<Response> {
  const creds = requireCredentials(env);
  if (!creds) return errorResponse("Analytics is not configured yet.", 503);

  const accessToken = await getGoogleAccessToken(creds);
  const report = await runRealtimeReport(creds.propertyId, accessToken);
  const payload: AnalyticsRealtimeDTO = { activeUsers: metricValue(report.rows?.[0], 0) };
  return json(payload);
}

// ---- Response shaping: GA4 returns everything as strings, one row per
// dimension combination -- each shape* function turns that into the
// plain-number, named-field shape the frontend actually wants. ----

function shapeSummary(report: GA4ReportResponse): AnalyticsSummary {
  const rows = report.rows ?? [];
  // Multiple named dateRanges with zero other dimensions requested means
  // "dateRange" is the only (and therefore first) dimension on each row.
  const currentRow = rows.find((r) => dimensionValue(r, 0) === "current");
  const previousRow = rows.find((r) => dimensionValue(r, 0) === "previous");
  const metric = (index: number) => ({ current: metricValue(currentRow, index), previous: metricValue(previousRow, index) });

  return {
    totalUsers: metric(0),
    newUsers: metric(1),
    sessions: metric(2),
    engagementRate: metric(3),
    averageSessionDuration: metric(4),
    conversions: metric(5),
  };
}

function shapeTimeseries(report: GA4ReportResponse): AnalyticsTimeseriesPoint[] {
  return (report.rows ?? []).map((row) => ({
    date: dimensionValue(row, 0),
    activeUsers: metricValue(row, 0),
    sessions: metricValue(row, 1),
  }));
}

function shapeTopPages(report: GA4ReportResponse): AnalyticsTopPage[] {
  return (report.rows ?? []).map((row) => ({
    path: dimensionValue(row, 0),
    title: dimensionValue(row, 1),
    views: metricValue(row, 0),
    avgDuration: metricValue(row, 1),
  }));
}

function shapeChannels(report: GA4ReportResponse): AnalyticsChannel[] {
  return (report.rows ?? []).map((row) => ({
    channel: dimensionValue(row, 0),
    sessions: metricValue(row, 0),
    users: metricValue(row, 1),
  }));
}

function shapeDevices(report: GA4ReportResponse): AnalyticsDevice[] {
  return (report.rows ?? []).map((row) => ({
    device: dimensionValue(row, 0),
    sessions: metricValue(row, 0),
  }));
}

function shapeNewVsReturning(report: GA4ReportResponse): AnalyticsSegment[] {
  return (report.rows ?? []).map((row) => ({
    segment: dimensionValue(row, 0),
    users: metricValue(row, 0),
  }));
}

function shapeGeo(report: GA4ReportResponse): AnalyticsCountry[] {
  return (report.rows ?? []).map((row) => ({
    country: dimensionValue(row, 0),
    sessions: metricValue(row, 0),
    users: metricValue(row, 1),
  }));
}

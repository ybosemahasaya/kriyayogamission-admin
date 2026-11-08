export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export interface Delta {
  label: string;
  direction: "up" | "down" | "flat";
}

/** GA4's "previous period" comparison isn't a built-in UI thing on our
 * end -- we compute it ourselves from the two dateRanges the backend
 * requests (see worker/api/analytics.ts), so this is just basic
 * percent-change math with sane edge cases for zero. */
export function formatDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    return current === 0 ? { label: "No change", direction: "flat" } : { label: "New", direction: "up" };
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return { label: "No change", direction: "flat" };
  const direction = change > 0 ? "up" : "down";
  return { label: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`, direction };
}

/** GA4 returns dates as a bare "YYYYMMDD" string. */
export function formatGa4Date(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return new Date(`${year}-${month}-${day}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Cloudflare's GraphQL httpRequests1dGroups returns dates as plain ISO
 * "YYYY-MM-DD" strings -- no reparsing needed like formatGa4Date above. */
export function formatIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Cloudflare's edge-bandwidth totals arrive as raw bytes -- this is the
 * same binary-prefix (1024-based) convention the Cloudflare dashboard
 * itself uses for its own bandwidth figures. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Kriya Yoga Mission is an India-based org and every admin using this
 * panel is in IST -- timestamps are shown in IST explicitly, not
 * whatever timezone the browser/OS happens to be set to, so the
 * dashboard reads the same way for everyone regardless of device
 * settings. */
const IST_TIME_ZONE = "Asia/Kolkata";

/** Workers Observability's `series` bucket labels come back from
 * Cloudflare as "YYYY-MM-DD HH:mm:ss" IN UTC, with no "Z" suffix or
 * offset. `new Date("2026-11-08T09:12:00")` (no timezone marker) is
 * parsed by JS as LOCAL time, not UTC -- so without this fix, a UTC
 * bucket time got silently treated as if it were already IST, showing
 * times hours behind the real current IST time. Appending "Z" forces
 * the correct UTC interpretation before converting to IST for display. */
export function parseCloudflareUtcString(utcString: string): Date | null {
  const date = new Date(`${utcString.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** For values that are already unambiguous instants (epoch ms, or a
 * real `Date`) -- no UTC-vs-local parsing ambiguity here, just forcing
 * the DISPLAY timezone to IST regardless of the viewer's own device
 * settings. */
export function formatIstDateTime(value: number | Date): string {
  const date = typeof value === "number" ? new Date(value) : value;
  return date.toLocaleString("en-IN", { timeZone: IST_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
}

export function formatIstTime(value: number | Date): string {
  const date = typeof value === "number" ? new Date(value) : value;
  return date.toLocaleTimeString("en-IN", { timeZone: IST_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

export function formatIstDate(value: number | Date): string {
  const date = typeof value === "number" ? new Date(value) : value;
  return date.toLocaleDateString("en-IN", { timeZone: IST_TIME_ZONE, month: "short", day: "numeric" });
}

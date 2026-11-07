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

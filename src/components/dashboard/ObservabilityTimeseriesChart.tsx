import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { ObservabilitySeriesPoint } from "../../../shared/worker-observability";
import type { Theme } from "../../hooks/useTheme";
import { formatIstDate, formatIstTime, parseCloudflareUtcString } from "../../lib/format";
import { readThemeColors } from "../../lib/theme-colors";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Props {
  points: ObservabilitySeriesPoint[];
  theme: Theme;
  hours: number;
}

// Cloudflare returns bucket labels as "YYYY-MM-DD HH:mm:ss" IN UTC -- a
// short window shows just the time-of-day (otherwise every label would
// be the same date and tell you nothing); a longer window shows the
// date instead, since time-of-day stops being the interesting axis.
// Always displayed in IST (see lib/format.ts) regardless of what UTC
// bucket Cloudflare actually used internally.
function formatLabel(time: string, hours: number): string {
  const date = parseCloudflareUtcString(time);
  if (!date) return time;
  return hours <= 24 ? formatIstTime(date) : formatIstDate(date);
}

/** Grafana's signature panel type: requests and errors over time, for
 * ONE Worker. Built from Cloudflare's own server-side time-bucketed
 * aggregation (the `series` field), not a client-side count of the
 * capped 100-event sample -- see shared/worker-observability.ts. */
export function ObservabilityTimeseriesChart({ points, theme, hours }: Props) {
  const { data, options } = useMemo(() => {
    const colors = readThemeColors();
    return {
      data: {
        labels: points.map((p) => formatLabel(p.time, hours)),
        datasets: [
          {
            label: "Requests",
            data: points.map((p) => p.count),
            borderColor: colors.accent,
            backgroundColor: "transparent",
            tension: 0.25,
          },
          {
            label: "Errors",
            data: points.map((p) => p.errors),
            borderColor: "#ef4444",
            backgroundColor: "transparent",
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" as const, labels: { color: colors.textSecondary } },
        },
        scales: {
          x: { ticks: { color: colors.textSecondary, maxRotation: 0 }, grid: { color: colors.border } },
          y: { ticks: { color: colors.textSecondary }, grid: { color: colors.border }, beginAtZero: true },
        },
      },
    };
  }, [points, theme, hours]);

  if (points.length === 0) {
    return <p className="analytics-empty">No request data for this window.</p>;
  }

  return (
    <div className="analytics-chart-canvas-wrap analytics-chart-canvas-wrap-sm">
      <Line data={data} options={options} />
    </div>
  );
}

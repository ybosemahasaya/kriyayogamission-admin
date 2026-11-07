import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { EdgeAnalyticsDailyPoint } from "../../../shared/edge-analytics";
import type { Theme } from "../../hooks/useTheme";
import { formatIsoDate } from "../../lib/format";
import { CHART_PALETTE, readThemeColors } from "../../lib/theme-colors";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Props {
  points: EdgeAnalyticsDailyPoint[];
  theme: Theme;
}

/** Same structure as AnalyticsTimeseriesChart (GA4's "Visitors over
 * time") -- a separate component rather than a generalized shared one
 * because the two datasets track genuinely different series (requests +
 * cached requests here vs. active users + sessions there), and forcing
 * a shared abstraction over "two named numeric series on a date axis"
 * would need almost as many props as just writing it twice. */
export function EdgeRequestsChart({ points, theme }: Props) {
  const { data, options } = useMemo(() => {
    const colors = readThemeColors();
    const labels = points.map((p) => formatIsoDate(p.date));

    return {
      data: {
        labels,
        datasets: [
          {
            label: "Total requests",
            data: points.map((p) => p.requests),
            borderColor: colors.accent,
            backgroundColor: "transparent",
            tension: 0.3,
          },
          {
            label: "Cached requests",
            data: points.map((p) => p.cachedRequests),
            borderColor: CHART_PALETTE[1],
            backgroundColor: "transparent",
            tension: 0.3,
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
          x: { ticks: { color: colors.textSecondary }, grid: { color: colors.border } },
          y: { ticks: { color: colors.textSecondary }, grid: { color: colors.border }, beginAtZero: true },
        },
      },
    };
  }, [points, theme]);

  return (
    <div className="analytics-chart-card">
      <h3>Edge requests over time</h3>
      {points.length === 0 ? (
        <p className="analytics-empty">No data for this period.</p>
      ) : (
        <div className="analytics-chart-canvas-wrap">
          <Line data={data} options={options} />
        </div>
      )}
    </div>
  );
}

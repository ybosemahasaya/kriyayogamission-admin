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
import type { AnalyticsTimeseriesPoint } from "../../../shared/analytics";
import type { Theme } from "../../hooks/useTheme";
import { formatGa4Date } from "../../lib/format";
import { readThemeColors, CHART_PALETTE } from "../../lib/theme-colors";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Props {
  points: AnalyticsTimeseriesPoint[];
  theme: Theme;
}

export function AnalyticsTimeseriesChart({ points, theme }: Props) {
  const { data, options } = useMemo(() => {
    const colors = readThemeColors();
    const labels = points.map((p) => formatGa4Date(p.date));

    return {
      data: {
        labels,
        datasets: [
          {
            label: "Active users",
            data: points.map((p) => p.activeUsers),
            borderColor: colors.accent,
            backgroundColor: "transparent",
            tension: 0.3,
          },
          {
            label: "Sessions",
            data: points.map((p) => p.sessions),
            // A cool blue rather than accent-strong (another shade of
            // the same orange accent) -- the two lines need to be
            // visually distinguishable at a glance, not just in the
            // legend text.
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
    // theme is a dependency purely to force recomputation after a
    // light/dark toggle -- the actual colors come from getComputedStyle
    // at call time, not from the theme string itself.
  }, [points, theme]);

  return (
    <div className="analytics-chart-card">
      <h3>Visitors over time</h3>
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

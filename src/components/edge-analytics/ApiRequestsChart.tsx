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
import type { ApiDailyPoint } from "../../../shared/api-observability";
import type { Theme } from "../../hooks/useTheme";
import { formatIsoDate } from "../../lib/format";
import { readThemeColors } from "../../lib/theme-colors";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Props {
  points: ApiDailyPoint[];
  theme: Theme;
}

/** Same pattern as EdgeRequestsChart -- its own component rather than a
 * shared generic one, for the same reason documented there (forcing an
 * abstraction over "two named numeric series on a date axis" wouldn't
 * save much). Tracks THIS admin panel's own API traffic, not the public
 * site's. */
export function ApiRequestsChart({ points, theme }: Props) {
  const { data, options } = useMemo(() => {
    const colors = readThemeColors();
    const labels = points.map((p) => formatIsoDate(p.date));

    return {
      data: {
        labels,
        datasets: [
          {
            label: "Requests",
            data: points.map((p) => p.requests),
            borderColor: colors.accent,
            backgroundColor: "transparent",
            tension: 0.3,
          },
          {
            label: "Errors",
            data: points.map((p) => p.errors),
            borderColor: colors.danger,
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
      <h3>Admin API requests over time (14d)</h3>
      {points.length === 0 ? (
        <p className="analytics-empty">No data yet -- this fills in as the admin panel gets used.</p>
      ) : (
        <div className="analytics-chart-canvas-wrap">
          <Line data={data} options={options} />
        </div>
      )}
    </div>
  );
}

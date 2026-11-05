import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import type { Theme } from "../../hooks/useTheme";
import { CHART_PALETTE, readThemeColors } from "../../lib/theme-colors";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  title: string;
  theme: Theme;
  labels: string[];
  values: number[];
}

/** One reusable chart for every "breakdown by category" view (channels,
 * devices, new-vs-returning) instead of three near-identical
 * components -- they only differ in which fields feed labels/values. */
export function AnalyticsDonutChart({ title, theme, labels, values }: Props) {
  const { data, options } = useMemo(() => {
    const colors = readThemeColors();
    return {
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: CHART_PALETTE, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom" as const,
            labels: { color: colors.textSecondary, boxWidth: 12, padding: 10 },
          },
        },
      },
    };
  }, [labels, values, theme]);

  return (
    <div className="analytics-chart-card">
      <h3>{title}</h3>
      {values.length === 0 ? (
        <p className="analytics-empty">No data for this period.</p>
      ) : (
        <div className="analytics-chart-canvas-wrap analytics-chart-canvas-wrap-sm">
          <Doughnut data={data} options={options} />
        </div>
      )}
    </div>
  );
}

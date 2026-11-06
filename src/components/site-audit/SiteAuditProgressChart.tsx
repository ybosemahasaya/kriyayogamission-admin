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
import type { AuditRunSummaryDTO } from "../../../shared/site-audit";
import type { Theme } from "../../hooks/useTheme";
import { readThemeColors } from "../../lib/theme-colors";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Props {
  runs: AuditRunSummaryDTO[];
  theme: Theme;
}

/** Stands in for SEMrush's "Progress" tab -- a trend of health score and
 * issue counts across runs. useSiteAudit's history list is already
 * newest-first (see worker/api/site-audit.ts's ORDER BY started_at DESC),
 * so it's reversed here to plot oldest-to-newest left-to-right, the way
 * every other chart in this admin panel does. */
export function SiteAuditProgressChart({ runs, theme }: Props) {
  const { data, options } = useMemo(() => {
    const colors = readThemeColors();
    const chronological = [...runs].reverse();
    const labels = chronological.map((run) => new Date(run.startedAt).toLocaleDateString());

    return {
      data: {
        labels,
        datasets: [
          {
            label: "Site Health",
            data: chronological.map((run) => run.healthScore ?? null),
            borderColor: colors.accent,
            backgroundColor: "transparent",
            tension: 0.3,
            yAxisID: "health",
          },
          {
            label: "Errors",
            data: chronological.map((run) => run.errorCount),
            borderColor: colors.danger,
            backgroundColor: "transparent",
            tension: 0.3,
            yAxisID: "counts",
          },
          {
            label: "Warnings",
            data: chronological.map((run) => run.warningCount),
            borderColor: colors.warning,
            backgroundColor: "transparent",
            tension: 0.3,
            yAxisID: "counts",
          },
          {
            label: "Notices",
            data: chronological.map((run) => run.noticeCount),
            borderColor: colors.notice,
            backgroundColor: "transparent",
            tension: 0.3,
            yAxisID: "counts",
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
          health: {
            position: "left" as const,
            min: 0,
            max: 100,
            ticks: { color: colors.textSecondary },
            grid: { color: colors.border },
          },
          counts: {
            position: "right" as const,
            beginAtZero: true,
            ticks: { color: colors.textSecondary },
            grid: { display: false },
          },
        },
      },
    };
    // theme forces recomputation after a light/dark toggle -- colors
    // themselves come from getComputedStyle at call time, same pattern
    // as AnalyticsTimeseriesChart.
  }, [runs, theme]);

  return (
    <div className="analytics-chart-card">
      <h3>Health &amp; issues over time</h3>
      {runs.length < 2 ? (
        <p className="analytics-empty">Run the audit a few more times to see a trend here.</p>
      ) : (
        <div className="analytics-chart-canvas-wrap">
          <Line data={data} options={options} />
        </div>
      )}
    </div>
  );
}

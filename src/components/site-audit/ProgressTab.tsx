import type { AuditRunSummaryDTO } from "../../../shared/site-audit";
import type { Theme } from "../../hooks/useTheme";
import { AnalyticsTable } from "../analytics/AnalyticsTable";
import { SiteAuditProgressChart } from "./SiteAuditProgressChart";

export function ProgressTab({ history, theme }: { history: AuditRunSummaryDTO[]; theme: Theme }) {
  if (history.length === 0) {
    return <p className="empty-state">Run the audit to start building a history.</p>;
  }

  return (
    <>
      <div className="analytics-chart-row">
        <SiteAuditProgressChart runs={history} theme={theme} />
      </div>
      <div className="analytics-chart-row">
        <AnalyticsTable
          title="Run history"
          columns={["Date", "Health", "Errors", "Warnings", "Notices"]}
          rows={history.map((run) => [
            new Date(run.startedAt).toLocaleString(),
            run.healthScore?.toString() ?? "--",
            run.errorCount.toString(),
            run.warningCount.toString(),
            run.noticeCount.toString(),
          ])}
        />
      </div>
    </>
  );
}

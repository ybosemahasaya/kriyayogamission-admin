import type { EmailMetricsDTO } from "../../../shared/email-metrics";
import { formatNumber } from "../../lib/format";

/** Email-send KPIs sourced directly from Resend's own API (see
 * worker/api/email-metrics.ts) -- "how many emails have we actually
 * sent", not just "how many contact messages did we receive". The two
 * numbers can and will diverge: attemptedButNeverReachedResend is exactly
 * that gap, surfaced explicitly rather than papered over. */
export function EmailMetricsCard({ metrics }: { metrics: EmailMetricsDTO }) {
  const maxDailyCount = Math.max(1, ...metrics.dailyBreakdown.map((d) => d.count));

  return (
    <div className="analytics-chart-card">
      <h3>
        Email Delivery (via Resend)
        {metrics.partial && (
          <span className="contact-email-failed-badge" title="Resend's send history is deep enough that this ran into the pagination safety cap -- totals below are a lower bound, not exact.">
            Partial data
          </span>
        )}
      </h3>

      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Sent Today</span>
          <span className="analytics-kpi-value">{formatNumber(metrics.sentToday)}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Sent This Month</span>
          <span className="analytics-kpi-value">{formatNumber(metrics.sentThisMonth)}</span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Total Sent (All Time)</span>
          <span className="analytics-kpi-value">
            {formatNumber(metrics.totalSent)}
            {metrics.partial ? "+" : ""}
          </span>
        </div>
        <div className="analytics-kpi-card">
          <span className="analytics-kpi-label">Never Reached Resend</span>
          <span className="analytics-kpi-value">{formatNumber(metrics.attemptedButNeverReachedResend)}</span>
        </div>
      </div>

      <div className="contact-daily-sparkline">
        {metrics.dailyBreakdown.map((day) => (
          <div key={day.date} className="contact-daily-sparkline-bar" title={`${day.date}: ${day.count} sent`}>
            <div className="contact-daily-sparkline-fill" style={{ height: `${(day.count / maxDailyCount) * 100}%` }} />
          </div>
        ))}
      </div>

      {Object.keys(metrics.byLastEvent).length > 0 && (
        <div className="contact-last-event-breakdown">
          {Object.entries(metrics.byLastEvent).map(([event, count]) => (
            <span key={event} className="contact-last-event-chip">
              {event}: {formatNumber(count)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

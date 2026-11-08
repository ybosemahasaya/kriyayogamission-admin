type StatTone = "neutral" | "good" | "warn" | "bad";

interface Props {
  label: string;
  value: string;
  tone?: StatTone;
  detail?: string;
}

/** Grafana's "Stat" panel, stripped to the essentials: a label, a big
 * number, and an optional color tone for at-a-glance severity (e.g. an
 * error rate that's fine in green vs. one worth looking at in red).
 * Deliberately NOT reusing .analytics-kpi-card as-is -- that component
 * has no tone concept, and bolting color-coding onto a type meant for
 * plain KPIs would make both components harder to reason about. */
export function StatTile({ label, value, tone = "neutral", detail }: Props) {
  return (
    <div className={`dashboard-stat dashboard-stat-${tone}`}>
      <span className="dashboard-stat-label">{label}</span>
      <span className="dashboard-stat-value">{value}</span>
      {detail && <span className="dashboard-stat-detail">{detail}</span>}
    </div>
  );
}

/** Error rate is the one piece of severity logic every stat tile in
 * this dashboard needs -- centralized here so "what counts as bad" is
 * defined once, not re-guessed per panel. */
export function toneForErrorRate(errors: number, total: number): StatTone {
  if (total === 0) return "neutral";
  const rate = errors / total;
  if (rate >= 0.05) return "bad";
  if (rate > 0) return "warn";
  return "good";
}

export const TIME_RANGE_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 7 * 24 },
  { label: "30d", hours: 30 * 24 },
] as const;

interface Props {
  hours: number;
  onChange: (hours: number) => void;
}

/** Grafana's time-range picker, reduced to a fixed preset list --
 * genuinely wired up (see useWorkerObservability's `hoursWindow` param),
 * not just decorative. Only the Workers Observability panels respond to
 * this; the SQL-backed traffic/contact-funnel/API-health panels keep
 * their own fixed windows (labeled as such on each panel) rather than
 * pretending a selector controls data it doesn't actually touch. */
export function TimeRangeSelector({ hours, onChange }: Props) {
  return (
    <div className="dashboard-time-range" role="group" aria-label="Time range">
      {TIME_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          className={hours === opt.hours ? "dashboard-time-range-btn active" : "dashboard-time-range-btn"}
          onClick={() => onChange(opt.hours)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

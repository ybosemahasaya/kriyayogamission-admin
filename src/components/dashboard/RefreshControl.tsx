import { formatIstTime } from "../../lib/format";

export const REFRESH_OPTIONS = [
  { label: "Off", seconds: 0 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
] as const;

interface Props {
  seconds: number;
  onChange: (seconds: number) => void;
  onRefreshNow: () => void;
  lastRefreshedAt: Date | null;
}

/** Grafana's auto-refresh dropdown + manual refresh button, combined
 * into one control. The actual interval timer lives in DashboardPage
 * (this component is just the UI for picking it), same separation as
 * everywhere else in this project between "state owner" and "control
 * that renders it." */
export function RefreshControl({ seconds, onChange, onRefreshNow, lastRefreshedAt }: Props) {
  return (
    <div className="dashboard-refresh-control">
      <button type="button" className="btn-secondary" onClick={onRefreshNow}>
        Refresh now
      </button>
      <select
        className="category-select"
        value={seconds}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Auto-refresh interval"
      >
        {REFRESH_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.seconds}>
            Auto-refresh: {opt.label}
          </option>
        ))}
      </select>
      {lastRefreshedAt && <span className="dashboard-last-refreshed">Updated {formatIstTime(lastRefreshedAt)} IST</span>}
    </div>
  );
}

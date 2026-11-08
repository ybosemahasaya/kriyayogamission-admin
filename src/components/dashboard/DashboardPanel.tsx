import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Small text on the right of the header -- e.g. a worker name or
   * "fixed window" caveat. Grafana panels show units/thresholds here;
   * this project's equivalent is mostly "which data source and window
   * this panel is reading from." */
  subtitle?: string;
  children: ReactNode;
  /** Panels default to spanning one grid cell (see .dashboard-grid in
   * App.css); "wide" spans the full row for charts/tables that need
   * more horizontal room than a stat tile does. */
  span?: "normal" | "wide";
}

/** The one visual building block every dashboard panel is built from --
 * a bordered card with a small header bar, deliberately plain so stat
 * tiles, charts, and tables all look like they belong to the same
 * dashboard instead of three different widgets bolted together. */
export function DashboardPanel({ title, subtitle, children, span = "normal" }: Props) {
  return (
    <section className={span === "wide" ? "dashboard-panel dashboard-panel-wide" : "dashboard-panel"}>
      <header className="dashboard-panel-header">
        <h3>{title}</h3>
        {subtitle && <span className="dashboard-panel-subtitle">{subtitle}</span>}
      </header>
      <div className="dashboard-panel-body">{children}</div>
    </section>
  );
}

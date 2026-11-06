/** Chart.js draws to a <canvas>, which can't resolve CSS var() the way
 * DOM elements can -- colors have to be read as resolved strings via
 * getComputedStyle. Call this at render time (inside a useMemo keyed on
 * the current theme) so charts pick up the right palette after a
 * light/dark toggle instead of staying stuck on whatever theme was
 * active when the chart first mounted. */
export interface ThemeColors {
  accent: string;
  accentStrong: string;
  textSecondary: string;
  border: string;
  danger: string;
  warning: string;
  notice: string;
}

export function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    accent: read("--accent"),
    accentStrong: read("--accent-strong"),
    textSecondary: read("--text-secondary"),
    border: read("--border"),
    danger: read("--danger"),
    warning: read("--warning"),
    notice: read("--notice"),
  };
}

/** Categorical palette for donut charts with more slices than just
 * "accent vs accent-strong" (e.g. 5+ traffic channels). Deliberately not
 * theme-dependent -- these are saturated, mid-brightness colors chosen
 * to stay legible on both the dark and light surface colors. */
export const CHART_PALETTE = [
  "#f97316",
  "#60a5fa",
  "#34d399",
  "#a78bfa",
  "#f472b6",
  "#facc15",
  "#38bdf8",
  "#94a3b8",
];

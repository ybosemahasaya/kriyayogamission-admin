import type { Theme } from "../hooks/useTheme";
import { ImageIcon, MoonIcon, SunIcon } from "./icons";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
}

/** Just one real section today (Gallery) -- resist the urge to pad this
 * out with disabled placeholder nav items for features that don't exist
 * yet (YAGNI). Add more entries here when Phase 2+ actually ships. */
export function Sidebar({ theme, onToggleTheme }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/kym-logo.webp" alt="Kriya Yoga Mission" className="sidebar-brand-mark" />
        <div>
          <strong>Kriya Yoga Mission</strong>
          <span className="sidebar-brand-sub">Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-nav-label">Content</span>
        <a className="sidebar-nav-item active" href="#gallery">
          <ImageIcon />
          Gallery
        </a>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="theme-toggle" onClick={onToggleTheme}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <p>Access gated by Cloudflare Access.</p>
      </div>
    </aside>
  );
}

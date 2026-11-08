import type { MouseEvent } from "react";
import type { Theme } from "../hooks/useTheme";
import {
  BarChartIcon,
  GlobeIcon,
  ImageIcon,
  LinkIcon,
  MailIcon,
  MoonIcon,
  SearchIcon,
  ShieldCheckIcon,
  SunIcon,
  TerminalIcon,
} from "./icons";

export type SidebarView =
  | "gallery"
  | "contact-messages"
  | "links"
  | "ga4"
  | "search-console"
  | "edge-analytics"
  | "worker-logs"
  | "site-audit";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  activeView: SidebarView;
  onNavigate: (view: SidebarView) => void;
}

/** Collapsed to icons-only by default, expands on hover/focus to reveal
 * text labels -- a pure-CSS interaction (see .sidebar:hover in App.css),
 * not React state, so there's no risk of it getting stuck open/closed on
 * a stale render. Every label is still a real DOM text node at all
 * times (just visually faded out while collapsed via opacity, never
 * removed), so screen readers and keyboard navigation see full labels
 * regardless of the current visual width.
 *
 * :focus-within (not just :hover) is what keeps the sidebar expanded
 * while tabbing through it with a keyboard -- but that same rule means
 * clicking a nav button, which leaves the browser's focus sitting on
 * that button, would otherwise keep the sidebar stuck open forever
 * afterward regardless of where the mouse goes (and on touchscreens,
 * which have no real :hover at all, EVERY tap would get stuck this way).
 * handleNavigate blurs the button immediately after navigating so focus
 * leaves the sidebar's subtree and it can collapse again normally. */
export function Sidebar({ theme, onToggleTheme, activeView, onNavigate }: Props) {
  function handleNavigate(view: SidebarView, e: MouseEvent<HTMLButtonElement>) {
    onNavigate(view);
    e.currentTarget.blur();
  }

  function handleToggleTheme(e: MouseEvent<HTMLButtonElement>) {
    onToggleTheme();
    e.currentTarget.blur();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/kym-logo.webp" alt="Kriya Yoga Mission" className="sidebar-brand-mark" />
        <div className="sidebar-label">
          <strong>Kriya Yoga Mission</strong>
          <span className="sidebar-brand-sub">Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-nav-label sidebar-label">Content</span>
        <button
          type="button"
          className={activeView === "gallery" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("gallery", e)}
        >
          <ImageIcon />
          <span className="sidebar-label">Gallery</span>
        </button>
        <button
          type="button"
          className={activeView === "contact-messages" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("contact-messages", e)}
        >
          <MailIcon />
          <span className="sidebar-label">Contact Messages</span>
        </button>

        <span className="sidebar-nav-label sidebar-label">Analytics</span>
        <button
          type="button"
          className={activeView === "ga4" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("ga4", e)}
        >
          <BarChartIcon />
          <span className="sidebar-label">GA4</span>
        </button>
        <button
          type="button"
          className={activeView === "search-console" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("search-console", e)}
        >
          <SearchIcon />
          <span className="sidebar-label">Search Console</span>
        </button>
        <button
          type="button"
          className={activeView === "edge-analytics" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("edge-analytics", e)}
        >
          <GlobeIcon />
          <span className="sidebar-label">Edge Analytics</span>
        </button>
        <button
          type="button"
          className={activeView === "worker-logs" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("worker-logs", e)}
        >
          <TerminalIcon />
          <span className="sidebar-label">Worker Logs</span>
        </button>

        <span className="sidebar-nav-label sidebar-label">Resources</span>
        <button
          type="button"
          className={activeView === "site-audit" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("site-audit", e)}
        >
          <ShieldCheckIcon />
          <span className="sidebar-label">Site Audit</span>
        </button>
        <button
          type="button"
          className={activeView === "links" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={(e) => handleNavigate("links", e)}
        >
          <LinkIcon />
          <span className="sidebar-label">Quick Links</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="theme-toggle" onClick={handleToggleTheme}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          <span className="sidebar-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <p className="sidebar-label">Access gated by Cloudflare Access.</p>
      </div>
    </aside>
  );
}

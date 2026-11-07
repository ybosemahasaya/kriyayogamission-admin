import type { Theme } from "../hooks/useTheme";
import { BarChartIcon, ImageIcon, LinkIcon, MailIcon, MoonIcon, SearchIcon, ShieldCheckIcon, SunIcon } from "./icons";

export type SidebarView = "gallery" | "contact-messages" | "links" | "ga4" | "search-console" | "site-audit";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  activeView: SidebarView;
  onNavigate: (view: SidebarView) => void;
}

export function Sidebar({ theme, onToggleTheme, activeView, onNavigate }: Props) {
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
        <button
          type="button"
          className={activeView === "gallery" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={() => onNavigate("gallery")}
        >
          <ImageIcon />
          Gallery
        </button>
        <button
          type="button"
          className={activeView === "contact-messages" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={() => onNavigate("contact-messages")}
        >
          <MailIcon />
          Contact Messages
        </button>

        <span className="sidebar-nav-label">Analytics</span>
        <button
          type="button"
          className={activeView === "ga4" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={() => onNavigate("ga4")}
        >
          <BarChartIcon />
          GA4
        </button>
        <button
          type="button"
          className={activeView === "search-console" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={() => onNavigate("search-console")}
        >
          <SearchIcon />
          Search Console
        </button>

        <span className="sidebar-nav-label">Resources</span>
        <button
          type="button"
          className={activeView === "site-audit" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={() => onNavigate("site-audit")}
        >
          <ShieldCheckIcon />
          Site Audit
        </button>
        <button
          type="button"
          className={activeView === "links" ? "sidebar-nav-item active" : "sidebar-nav-item"}
          onClick={() => onNavigate("links")}
        >
          <LinkIcon />
          Quick Links
        </button>
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

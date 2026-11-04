import { ImageIcon } from "./icons";

/** Just one real section today (Gallery) -- resist the urge to pad this
 * out with disabled placeholder nav items for features that don't exist
 * yet (YAGNI). Add more entries here when Phase 2+ actually ships. */
export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">KYM</span>
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
        Access gated by Cloudflare Access.
      </div>
    </aside>
  );
}

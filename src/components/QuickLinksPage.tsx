import { QUICK_LINKS } from "../data/quickLinks";
import { ExternalLinkIcon } from "./icons";

/** Just a bookmarks page -- every link opens in a new tab (rel=noopener
 * since target=_blank without it lets the opened page access
 * window.opener). No state, no API calls; add new links by editing
 * data/quickLinks.ts, not this component. */
export function QuickLinksPage() {
  return (
    <div className="quick-links-page">
      {QUICK_LINKS.map((group) => (
        <section key={group.category} className="quick-links-group">
          <h2 className="quick-links-group-title">{group.category}</h2>
          <div className="quick-links-grid">
            {group.links.map((link) => (
              <a
                key={link.url}
                className="quick-link-card"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="quick-link-card-header">
                  <span className="quick-link-card-label">{link.label}</span>
                  <ExternalLinkIcon className="quick-link-card-icon" />
                </div>
                <p className="quick-link-card-description">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

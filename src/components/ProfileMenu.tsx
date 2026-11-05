import { useEffect, useRef, useState } from "react";
import { LogOutIcon } from "./icons";

interface MeResponse {
  email: string | null;
}

/** Fixed top-right, independent of whichever view (Gallery/Quick Links)
 * is active -- simpler than threading it through two different header
 * layouts for the same visual result. This app has no login/session
 * code of its own (see worker/index.ts's /api/me comment) -- Cloudflare
 * Access owns all of that, so "sign out" just has to hit Access's real
 * logout endpoint rather than clearing any state we control.
 *
 * Only "Sign out" lives in the menu -- resist padding this out with
 * Settings/Pricing/Subscriptions-style rows just because that's a
 * common profile-menu pattern elsewhere; this app doesn't have those
 * features (YAGNI, same call already made for the sidebar nav). */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<MeResponse>) : null))
      .then((data) => setEmail(data?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const displayName = email ? deriveDisplayName(email) : "Account";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        type="button"
        className="profile-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="profile-avatar">{initial}</span>
      </button>

      {open && (
        <div className="profile-menu-dropdown" role="menu">
          <div className="profile-menu-header">
            <span className="profile-avatar profile-avatar-lg">{initial}</span>
            <div className="profile-menu-identity">
              <span className="profile-menu-name">{displayName}</span>
              {email && (
                <span className="profile-menu-email" title={email}>
                  {email}
                </span>
              )}
            </div>
          </div>

          <div className="profile-menu-list">
            {/* Real top-level navigation, not a fetch -- Access's logout
                clears the CF_Authorization cookie via a redirect flow
                that needs an actual page load to complete correctly. */}
            <a className="profile-menu-item" href="/cdn-cgi/access/logout" role="menuitem">
              <LogOutIcon />
              Sign out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/** Access only gives us an email, no real display name -- turn
 * "jane.doe@x.com" into "Jane Doe" rather than showing a bare email
 * next to another copy of the same email. */
function deriveDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  const words = localPart.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return email;
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

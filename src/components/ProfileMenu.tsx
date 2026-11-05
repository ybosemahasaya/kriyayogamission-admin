import { useEffect, useRef, useState } from "react";

interface MeResponse {
  email: string | null;
}

/** Fixed top-right, independent of whichever view (Gallery/Quick Links)
 * is active -- simpler than threading it through two different header
 * layouts for the same visual result. This app has no login/session
 * code of its own (see worker/index.ts's /api/me comment and
 * docs/admin-panel-architecture.html) -- Cloudflare Access owns all of
 * that, so "sign out" just has to hit Access's real logout endpoint
 * rather than clearing any state we control. */
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

  const initial = email ? email[0].toUpperCase() : "?";

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        type="button"
        className="profile-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="profile-avatar">{initial}</span>
        <span className="profile-label">Profile</span>
      </button>

      {open && (
        <div className="profile-menu-dropdown" role="menu">
          {email && (
            <p className="profile-menu-email" title={email}>
              {email}
            </p>
          )}
          {/* Real top-level navigation, not a fetch -- Access's logout
              clears the CF_Authorization cookie via a redirect flow that
              needs an actual page load to complete correctly. */}
          <a className="profile-menu-signout" href="/cdn-cgi/access/logout" role="menuitem">
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}

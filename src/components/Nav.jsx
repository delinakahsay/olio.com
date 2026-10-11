import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
export default function Nav({
  page,
  go,
  profile,
  onSignIn,
  onSignOut,
  cartCount,
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    function dismiss(e) {
      if (
        e.key === "Escape" ||
        (e.type === "pointerdown" && !root.current?.contains(e.target))
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);
  const link = (route, label) => (
    <a
      href={"#/" + route}
      aria-current={page === route ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {label}
    </a>
  );
  return (
    <header className="site-header">
      <a className="wordmark" href="#/chat" aria-label="Olio home">
        {/* The mark is the capital O of the word. Masked rather than an
            <img>, so it takes the page ink; an img is its own document and
            could not inherit currentColor. */}
        <span className="wordmark-mark" aria-hidden="true" />
        <span>lio</span>
      </a>
      <nav aria-label="Main">
        {/* The shopping surface is where the wordmark points, so it needs a
            label of its own rather than being reachable only by the logo. */}
        {link("chat", "Find")}
        {link("discover", "Discover")}
        {link("about", "About")}
      </nav>
      <nav className="nav-end" aria-label="Personal">
        {profile ? (
          link("saved", "Saved")
        ) : (
          <button className="primary signup-button" onClick={onSignIn}>
            Create account
          </button>
        )}
        <div className="account-menu" ref={root}>
          <button
            className="text-button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            Account <Icon name="chevron" />
          </button>
          {open && (
            <div className="menu-popover">
              {link("account/profile", "Profile")}
              {link("account/appearance", "Settings")}
              {link("account/history", "Shopping history")}
              {link("cart", `Cart${cartCount ? ` (${cartCount})` : ""}`)}
              <hr />
              {profile ? (
                <button
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => {
                    setOpen(false);
                    onSignIn();
                  }}
                >
                  Sign in / Create account
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

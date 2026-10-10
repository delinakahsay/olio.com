import { useState } from "react";
import Icon from "./Icon.jsx";
import { isValidHttpUrl, fallbackSearchLink } from "../utils.js";
const sections = [
  ["profile", "Profile"],
  ["personal", "Personal info"],
  ["history", "Shopping history"],
  ["appearance", "Appearance"],
  ["preferences", "Shopping preferences"],
  ["notifications", "Notifications"],
  ["privacy", "Privacy & security"],
  ["help", "Help"],
];
export const appearanceDefaults = {
  palette: "wine",
  mode: "light",
  text: "default",
  reduceMotion: false,
};
export default function Account({
  section,
  profile,
  personal,
  setPersonal,
  appearance,
  setAppearance,
  preferences,
  setPreferences,
  history,
  setHistory,
  conversations,
  setConversations,
  trackHistory,
  setTrackHistory,
  showFeedback,
  setShowFeedback,
  onNameSave,
  onSignIn,
  onVisit,
  onResume,
  onPassword,
  notify,
  onExport,
  onClear,
}) {
  const [form, setForm] = useState({
    ...personal,
    name: profile?.name || personal.name || "",
  });
  const [theme, setTheme] = useState(appearance);
  const [prefs, setPrefs] = useState(preferences);
  const [historyTab, setHistoryTab] = useState("clicked");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState("30");
  const [password, setPassword] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const displayName = profile?.name || personal.name || "Your account";
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      if (profile) await onNameSave(form.name);
      setPersonal(form);
      setStatus("Your details are saved.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }
  function mark(item) {
    setHistory((rows) =>
      rows.map((r) =>
        r.id === item.id
          ? {
              ...r,
              bought: !r.bought,
              boughtAt: !r.bought ? new Date().toISOString() : null,
            }
          : r,
      ),
    );
  }
  const filtered = history.filter(
    (r) =>
      (historyTab !== "bought" || r.bought) &&
      r.title.toLowerCase().includes(query.toLowerCase()) &&
      (days === "all" ||
        Date.now() -
          new Date(
            historyTab === "bought" ? r.boughtAt || r.clickedAt : r.clickedAt,
          ).getTime() <
          Number(days) * 86400000),
  );
  return (
    <>
      <div className="page-heading">
        <h1>
          {section === "history"
            ? "Pick up where you left off."
            : section === "appearance"
              ? "Make Olio yours."
              : "A little about you."}
        </h1>
      </div>
      <div className="account-layout">
        <aside className="account-sidebar surface">
          <div className="identity">
            <span className="avatar">
              {displayName === "Your account"
                ? "o"
                : displayName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
            </span>
            <h2>{displayName}</h2>
          </div>
          <nav aria-label="Account settings">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={"#/account/" + id}
                aria-current={id === section ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          {!profile && (
            <button className="outline" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </aside>
        <section className="settings-content surface">
          {["profile", "personal"].includes(section) && (
            <form onSubmit={save}>
              <h2>
                {section === "profile" ? "Your profile" : "Personal info"}
              </h2>
              <p className="subtle">
                {profile
                  ? "Your name syncs with your account. Other preferences stay on this browser."
                  : "Your guest profile is saved on this browser. Sign in to keep saved products across devices."}
              </p>
              <label>
                Display name
                <input
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  First name
                  <input
                    value={form.first || ""}
                    maxLength={80}
                    onChange={(e) =>
                      setForm({ ...form, first: e.target.value })
                    }
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={form.last || ""}
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, last: e.target.value })}
                  />
                </label>
              </div>
              {profile && (
                <label>
                  Email
                  <input value={profile.email} readOnly />
                  <small>Used for sign-in.</small>
                </label>
              )}
              <label>
                Shopping region
                <select value="US" disabled>
                  <option value="US">United States · USD</option>
                </select>
                <small>Search currently supports US shopping results.</small>
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <p role="status">{status}</p>
            </form>
          )}
          {section === "appearance" && (
            <>
              <h2>Appearance</h2>
              <p className="serif intro">A little more you.</p>
              <h3>Theme</h3>
              <div className="theme-options">
                {[
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["system", "Match device"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-label={label}
                    className={"theme-option theme-" + id}
                    aria-pressed={theme.mode === id}
                    onClick={() => setTheme({ ...theme, mode: id })}
                  >
                    <span className="mini-window">
                      <span className="mini-logo">olio</span>
                      <span className="mini-bubble" />
                      <span className="mini-line" />
                    </span>
                    <span>{label}</span>
                    {theme.mode === id && <Icon name="check" />}
                  </button>
                ))}
              </div>
              <hr />
              <h3>Color palette</h3>
              <p className="subtle">
                Choose an accent for highlights and buttons.
              </p>
              <div className="palette-options">
                {[
                  ["wine", "Olio wine"],
                  ["forest", "Forest"],
                  ["midnight", "Midnight"],
                  ["clay", "Clay"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={"palette-option palette-" + id}
                    onClick={() => setTheme({ ...theme, palette: id })}
                    aria-pressed={theme.palette === id}
                  >
                    <span className="swatches">
                      <i />
                      <i />
                      <i />
                    </span>
                    {label}
                    {theme.palette === id && <Icon name="check" />}
                  </button>
                ))}
              </div>
              <hr />
              <div className="form-grid">
                <label>
                  Text size
                  <select
                    value={theme.text}
                    onChange={(e) =>
                      setTheme({ ...theme, text: e.target.value })
                    }
                  >
                    <option value="default">Default</option>
                    <option value="large">Large</option>
                  </select>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={theme.reduceMotion}
                    onChange={(e) =>
                      setTheme({ ...theme, reduceMotion: e.target.checked })
                    }
                  />
                  Reduce motion
                </label>
              </div>
              <div
                className={"appearance-preview preview-" + theme.mode}
                data-palette={theme.palette}
                style={{
                  fontSize: theme.text === "large" ? "1.15em" : undefined,
                }}
              >
                <h3 className="serif">Your preview</h3>
                <p className="preview-user">A bag for the everyday.</p>
                <p className="serif">What details matter most to you?</p>
                <span className="preview-button">Find it</span>
              </div>
              <p className="subtle">
                Only changes how Olio looks on this browser.
              </p>
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => {
                    setAppearance(theme);
                    notify("Appearance saved");
                  }}
                >
                  Save changes
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setTheme(appearanceDefaults);
                    setAppearance(appearanceDefaults);
                  }}
                >
                  Reset to default
                </button>
              </div>
            </>
          )}
          {section === "preferences" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPreferences(prefs);
                notify("Shopping preferences saved");
              }}
            >
              <h2>Your shopping preferences</h2>
              <p className="subtle">
                Optional starting points for new conversations on this browser.
                You can change them in the chat.
              </p>
              <label>
                Preferred category
                <select
                  value={prefs.category || ""}
                  onChange={(e) =>
                    setPrefs({ ...prefs, category: e.target.value })
                  }
                >
                  <option value="">All categories</option>
                  <option value="clothing">Clothing & bags</option>
                  <option value="home">Home</option>
                  <option value="electronics">Tech</option>
                  <option value="beauty">Beauty</option>
                </select>
              </label>
              <label>
                Usual budget
                <select
                  value={prefs.budget || ""}
                  onChange={(e) =>
                    setPrefs({ ...prefs, budget: e.target.value })
                  }
                >
                  <option value="">No limit</option>
                  {[25, 50, 100, 200, 500].map((n) => (
                    <option key={n} value={n}>
                      Under ${n}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary">Save preferences</button>
            </form>
          )}
          {section === "history" && (
            <>
              <h2>Shopping history</h2>
              <div className="tabs">
                {[
                  ["clicked", "Clicked"],
                  ["bought", "Marked as bought"],
                  ["conversations", "Conversations"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={historyTab === id}
                    onClick={() => setHistoryTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="subtle">
                Saved on this browser. Retailer visits are not confirmed
                purchases.
              </p>
              <div className="toolbar">
                <input
                  aria-label="Search history"
                  placeholder="Search your history"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="History date range"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                >
                  <option value="30">Past 30 days</option>
                  <option value="7">Past 7 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
              {historyTab === "conversations" ? (
                <>
                  {conversations
                    .filter(
                      (c) =>
                        c.title.toLowerCase().includes(query.toLowerCase()) &&
                        (days === "all" ||
                          Date.now() - new Date(c.at).getTime() <
                            Number(days) * 86400000),
                    )
                    .map((c) => (
                      <div key={c.id} className="history-row">
                        <div className="history-info">
                          <h3>{c.title}</h3>
                          <p className="subtle">
                            {new Date(c.at).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="outline" onClick={() => onResume(c)}>
                          Continue
                        </button>
                      </div>
                    ))}
                  {!conversations.length && (
                    <p className="empty-copy">
                      Your conversations will appear here.
                    </p>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Clear conversations saved on this browser?",
                        )
                      )
                        setConversations([]);
                    }}
                  >
                    Clear conversations
                  </button>
                </>
              ) : (
                <>
                  {filtered.map((p) => (
                    <div className="history-row" key={p.id}>
                      <div className="history-thumb">
                        {isValidHttpUrl(p.thumbnail) ? (
                          <img src={p.thumbnail} alt="" />
                        ) : (
                          <span className="serif">olio</span>
                        )}
                      </div>
                      <div className="history-info">
                        <h3>{p.title}</h3>
                        <p>{p.price}</p>
                        <small>
                          {new Date(p.clickedAt).toLocaleDateString()}
                        </small>
                      </div>
                      <div className="history-actions">
                        <button className="outline" onClick={() => mark(p)}>
                          {p.bought ? "Undo bought" : "Mark as bought"}
                        </button>
                        <a
                          href={
                            isValidHttpUrl(p.link)
                              ? p.link
                              : fallbackSearchLink(p.title)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onVisit(p)}
                        >
                          View item
                        </a>
                        <button
                          className="text-button small"
                          onClick={() =>
                            setHistory((rows) =>
                              rows.filter((r) => r.id !== p.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {!filtered.length && (
                    <p className="empty-copy">No items here yet.</p>
                  )}
                  <hr />
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={trackHistory}
                      onChange={(e) => setTrackHistory(e.target.checked)}
                    />
                    Save clicked history
                  </label>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Clear clicked items? Items marked as bought will stay.",
                        )
                      )
                        setHistory((rows) => rows.filter((r) => r.bought));
                    }}
                  >
                    Clear clicked history
                  </button>
                </>
              )}
            </>
          )}
          {section === "notifications" && (
            <>
              <h2>Notifications</h2>
              <p className="subtle">
                Choose the feedback you see while using Olio.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={showFeedback}
                  onChange={(e) => setShowFeedback(e.target.checked)}
                />
                Show save and preference confirmations
              </label>
              <p>
                Important errors always appear. Olio does not send marketing
                emails or price alerts.
              </p>
            </>
          )}
          {section === "privacy" && (
            <>
              <h2>Privacy & security</h2>
              <p>
                Your shopping profile is private. Appearance, collections,
                preferences, and activity history are stored on this browser.
                Signed-in saved products and your account name are stored with
                your account.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={trackHistory}
                  onChange={(e) => setTrackHistory(e.target.checked)}
                />
                Save clicked history on this browser
              </label>
              <div className="actions">
                <button className="outline" onClick={onExport}>
                  Export my Olio data
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Clear this profile’s browser data, including local history, collections, and preferences? Server-saved products and your account will remain.",
                      )
                    )
                      onClear();
                  }}
                >
                  Clear browser data
                </button>
              </div>
              {profile && (
                <form
                  className="password-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setStatus("");
                    try {
                      await onPassword(password);
                      setPassword({ current: "", next: "" });
                      setStatus("Password updated.");
                    } catch (err) {
                      setStatus(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <h3>Change password</h3>
                  <label>
                    Current password
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password.current}
                      onChange={(e) =>
                        setPassword({ ...password, current: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={200}
                      required
                      value={password.next}
                      onChange={(e) =>
                        setPassword({ ...password, next: e.target.value })
                      }
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Update password
                  </button>
                  <p role="status">{status}</p>
                </form>
              )}
            </>
          )}
          {section === "help" && (
            <>
              <h2>A little help</h2>
              {[
                [
                  "How do I refine a search?",
                  "Keep typing in the same conversation. Tell Olio what to change, or choose a suggested refinement. Start a new search for a different product.",
                ],
                [
                  "Where do I buy a product?",
                  "View at retailer opens the seller’s page. Confirm price, specifications, stock, and shipping there. Olio does not take payments or place orders.",
                ],
                [
                  "What stays on this browser?",
                  "Appearance, collections, shopping preferences, and activity history. Sign in to sync saved products across devices.",
                ],
                [
                  "What does Mark as bought mean?",
                  "It is your own record of a purchase. Opening a retailer page does not mark an item as bought.",
                ],
                [
                  "How are products chosen?",
                  "Olio interprets your request, searches product listings, and ranks options from available listing details. Descriptions can be incomplete, so verify important details with the retailer.",
                ],
              ].map(([q, a]) => (
                <details className="faq" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}

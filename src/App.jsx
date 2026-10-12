import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api.js";
import Nav from "./components/Nav.jsx";
import Chat from "./components/Chat.jsx";
import Discover from "./components/Discover.jsx";
import Saved from "./components/Saved.jsx";
import Account, { appearanceDefaults } from "./components/Account.jsx";
import AccountModal from "./components/AccountModal.jsx";
import Toast from "./components/Toast.jsx";
import Icon from "./components/Icon.jsx";
import { useLocal, readLocal } from "./hooks/useLocal.js";
import { isValidHttpUrl, fallbackSearchLink } from "./utils.js";

// Routes that merged into another page. Old links and bookmarks still land.
const REDIRECTS = {
  "account/personal": "account/profile",
  // Discover duplicated the tiles already on the chat panel.
  discover: "chat",
};
const getRoute = () => {
  const raw = window.location.hash.replace(/^#\/?/, "") || "chat";
  return REDIRECTS[raw] || raw;
};
export default function App() {
  const [page, setPage] = useState(getRoute);
  const [token, setToken] = useState(
    () =>
      readLocal("olio-session", null) || localStorage.getItem("olioAuthToken"),
  );
  const [profile, setProfile] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(!!token);
  const [sessionError, setSessionError] = useState("");
  const [serverSaved, setServerSaved] = useState([]);
  const [cart, setCart] = useState([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const pendingSearch = useRef(null);
  const scope = "olio:v2:" + (profile?.email || "guest") + ":";
  const [guestSaved, setGuestSaved] = useLocal("olio:v2:guest:saved", []);
  const [personal, setPersonal] = useLocal(scope + "personal", {});
  const [appearance, setAppearance] = useLocal(
    scope + "appearance",
    appearanceDefaults,
  );
  const [preferences, setPreferences] = useLocal(scope + "preferences", {});
  const [collections, setCollections] = useLocal(scope + "collections", {
    names: [],
    assignments: {},
  });
  const [history, setHistory] = useLocal(scope + "history", []);
  const [conversations, setConversations] = useLocal(
    scope + "conversations",
    [],
  );
  const [trackHistory, setTrackHistory] = useLocal(
    scope + "trackHistory",
    true,
  );
  const [showFeedback, setShowFeedback] = useLocal(
    scope + "showFeedback",
    true,
  );
  const saved = profile ? serverSaved : guestSaved;
  const [messages, setMessages] = useState([]);
  const [results, setResults] = useState([]);
  // True only when a search ran and came back empty, so the shortlist panel
  // never calls a conversational turn a failed search.
  const [noMatch, setNoMatch] = useState(false);
  const [reading, setReading] = useState(null);
  // The queries the agent actually ran. Shown to the shopper, because an
  // agent you cannot see is an agent you cannot trust or debug.
  const [searches, setSearches] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const conversationId = useRef(null);
  const requestId = useRef(0);
  const lastParams = useRef({});
  const saving = useRef(new Set());
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const notify = useCallback(
    (message, important = false) => {
      if (!showFeedback && !important) return;
      setToast(message);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(
        () => setToast(""),
        important ? 6500 : 3000,
      );
    },
    [showFeedback],
  );
  const sessionRef = useRef(token);
  sessionRef.current = token;
  function go(route) {
    window.location.hash = "/" + route;
  }
  useEffect(() => {
    const changed = () => {
      setPage(getRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    if (!token) {
      setSessionLoading(false);
      return;
    }
    let current = true;
    setSessionLoading(true);
    setSessionError("");
    api
      .getProfile(token)
      .then((data) => {
        if (current) {
          setProfile(data);
          setServerSaved([...(data.savedItems || [])].reverse());
          setCart(data.cart || []);
        }
      })
      .catch((err) => {
        if (!current) return;
        if (err.status === 401) {
          localStorage.removeItem("olioAuthToken");
          localStorage.removeItem("olio-session");
          setToken(null);
          setProfile(null);
        } else
          setSessionError(
            "Could not load your account. Please reload to try again.",
          );
      })
      .finally(() => {
        if (current) setSessionLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      document.documentElement.dataset.mode =
        appearance.mode === "system"
          ? media.matches
            ? "dark"
            : "light"
          : appearance.mode;
    }
    apply();
    media.addEventListener("change", apply);
    document.documentElement.dataset.palette = appearance.palette;
    document.documentElement.dataset.text = appearance.text;
    document.documentElement.dataset.motion = appearance.reduceMotion
      ? "reduced"
      : "normal";
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  function reset() {
    ++requestId.current;
    setLoading(false);
    setMessages([]);
    setResults([]);
    setNoMatch(false);
    setReading(null);
    setSearches([]);
    setSources([]);
    setError("");
    conversationId.current = null;
    lastParams.current = {};
  }
  async function send(text, options = {}) {
    if (!text?.trim() || loading) return;
    if (!profile || !token) {
      pendingSearch.current = { text, options };
      setAccountOpen(true);
      return;
    }
    go("chat");
    const id = ++requestId.current;
    const previous = options.fresh ? [] : messages;
    const next = options.retry
      ? previous
      : [...previous, { role: "user", text: text.trim() }];
    if (options.fresh || !conversationId.current)
      conversationId.current = crypto.randomUUID();
    const cid = conversationId.current;
    const params = {
      ...(options.fresh ? preferences : lastParams.current),
      ...options,
    };
    // Settings use budget, the search API uses priceMax.
    const priceMax =
      params.priceMax ?? params.budget ?? preferences.budget ?? "";
    lastParams.current = {
      category: params.category ?? preferences.category ?? "",
      priceMax,
      // Carried so a filter change re-runs the same request narrowed, rather
      // than starting over.
      refinements: params.refinements ?? lastParams.current?.refinements ?? [],
    };
    setMessages(next);
    setLoading(true);
    setError("");
    setReading(null);
    try {
      const data = await api.search(
        {
          query: text.trim(),
          ...lastParams.current,
          // The whole exchange with roles, so the agent can resolve "the blue
          // one" and remember what it has been told. This used to send only
          // the user's lines, joined, with the assistant's side discarded.
          history: previous.slice(-12).map((m) => ({ role: m.role, text: m.text })),
          // Sent back so hard requirements survive a follow-up about taste.
          brief: options.fresh ? [] : options.brief || reading?.requirements || [],
        },
        token,
      );
      if (id !== requestId.current) return;
      // null products means the agent decided this was conversation, not a
      // search. Keep whatever is on screen instead of blanking the shortlist.
      const searched = Array.isArray(data.products);
      const products = searched ? data.products : results;
      const response =
        data.summary ||
        (products.length
          ? `I found ${products.length} options to explore. Tell me what you’d like to change.`
          : "I couldn’t find a match this time. Try a broader description or a different budget.");
      const complete = [...next, { role: "assistant", text: response }];
      if (searched) {
        setResults(data.products);
        setNoMatch(data.products.length === 0);
      }
      setSearches(Array.isArray(data.searches) ? data.searches : []);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      if (searched || data.reading) setReading(data.reading || null);
      setMessages(complete);
      setConversations((rows) =>
        [
          {
            id: cid,
            title: complete.find((m) => m.role === "user")?.text || text,
            at: new Date().toISOString(),
            messages: complete.slice(-40),
            results: products,
            reading: data.reading || null,
            params: lastParams.current,
          },
          ...rows.filter((c) => c.id !== cid),
        ].slice(0, 30),
      );
    } catch (err) {
      if (id === requestId.current) {
        if (err.status === 401) {
          pendingSearch.current = {
            text,
            options: { ...options, retry: true },
          };
          setAccountOpen(true);
        }
        setError(err.message);
        setResults([]);
        setNoMatch(false);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  async function toggleSave(product) {
    if (saving.current.size) {
      notify("Finishing your previous save. Please try again.");
      return;
    }
    const isSaved = saved.some((p) => p.id === product.id);
    if (!profile) {
      setAccountOpen(true);
      return;
    }
    const owner = token;
    saving.current.add(product.id);
    try {
      const data = await api.profileAction(
        token,
        isSaved ? "removeItem" : "saveItem",
        isSaved ? { itemId: product.id } : { item: product },
      );
      if (sessionRef.current === owner) {
        setServerSaved([...(data.savedItems || [])].reverse());
        notify(isSaved ? "Removed from saved" : "Saved to your account");
      }
    } catch (err) {
      notify("Could not update saved items. Please try again.", true);
    } finally {
      saving.current.delete(product.id);
    }
  }
  function visit(product) {
    if (!trackHistory) return;
    setHistory((rows) =>
      [
        {
          ...product,
          clickedAt: new Date().toISOString(),
          bought: rows.find((r) => r.id === product.id)?.bought || false,
          boughtAt: rows.find((r) => r.id === product.id)?.boughtAt || null,
        },
        ...rows.filter((r) => r.id !== product.id),
      ].slice(0, 200),
    );
  }
  function authed(data) {
    localStorage.setItem("olioAuthToken", data.token);
    setToken(data.token);
    setProfile({ email: data.email, name: data.name });
    setServerSaved([...(data.savedItems || [])].reverse());
    setCart(data.cart || []);
    setAccountOpen(false);
    reset();
    go(pendingSearch.current ? "chat" : "account/profile");
  }
  useEffect(() => {
    if (profile && token && pendingSearch.current && !accountOpen) {
      const pending = pendingSearch.current;
      pendingSearch.current = null;
      send(pending.text, { ...pending.options, fresh: true, retry: false });
    }
  }, [profile, token, accountOpen]);
  function signOut() {
    setSessionError("");
    // Revoke the session server-side too, otherwise the row stays valid for
    // its full 30 days and clearing localStorage only hides it.
    api.logout(token);
    localStorage.removeItem("olioAuthToken");
    localStorage.removeItem("olio-session");
    setToken(null);
    setProfile(null);
    setServerSaved([]);
    setCart([]);
    reset();
    go("chat");
  }
  async function saveName(name) {
    const data = await api.profileAction(token, "updateProfile", { name });
    setProfile((p) => ({ ...p, name: data.name }));
  }
  function resume(c) {
    reset();
    conversationId.current = c.id;
    setMessages(c.messages);
    setResults(c.results || []);
    setReading(c.reading);
    lastParams.current = c.params || {};
    go("chat");
  }
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            profile: profile
              ? {
                  name: profile.name,
                  email: profile.email,
                  legacyOrders: profile.orders || [],
                }
              : personal,
            saved,
            collections,
            history,
            conversations,
            appearance,
            preferences,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "olio-my-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearLocal() {
    setPersonal({});
    setAppearance(appearanceDefaults);
    setPreferences({});
    setCollections({ names: [], assignments: {} });
    setHistory([]);
    setConversations([]);
    setTrackHistory(true);
    setShowFeedback(true);
    if (!profile) setGuestSaved([]);
    reset();
    notify("Browser data cleared");
  }
  const section = page.split("/")[1] || "profile";
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        Skip to content
      </a>
      <Nav
        page={page}
        go={go}
        profile={profile}
        cartCount={cart.length}
        onSignIn={() => setAccountOpen(true)}
        onSignOut={signOut}
      />
      <main id="main" tabIndex={-1}>
        {sessionLoading ? (
          <div className="empty-state">
            <h1>Welcome back.</h1>
            <p>Loading your account…</p>
          </div>
        ) : sessionError ? (
          <div role="alert" className="empty-state">
            <p>{sessionError}</p>
            <button
              className="outline"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button className="text-button" onClick={signOut}>
              Continue signed out
            </button>
          </div>
        ) : !profile &&
          (page === "saved" ||
            page === "cart" ||
            page.startsWith("account/")) ? (
          <div className="empty-state">
            <h1>Make yourself at home.</h1>
            <p>
              Create an account to keep your finds, conversations, and
              preferences together.
            </p>
            <button className="primary" onClick={() => setAccountOpen(true)}>
              Create account / Sign in
            </button>
          </div>
        ) : (
          <>
            {page === "chat" && (
              <Chat
                key={scope}
                messages={messages}
                results={results}
                reading={reading}
                loading={loading}
                error={error}
                onSend={send}
                onReset={reset}
                saved={saved}
                onSave={toggleSave}
                onVisit={visit}
                preferences={preferences}
                noMatch={noMatch}
                searches={searches}
                sources={sources}
                onRelax={(text) => {
                  const next = (reading?.requirements || []).filter(
                    (r) => r.text !== text,
                  );
                  setReading({ ...(reading || {}), requirements: next,
                    constraints: next.map((r) => r.text) });
                  const last = messages.filter((m) => m.role === "user").at(-1)?.text;
                  if (last) send(last, { retry: true, brief: next });
                }}
              />
            )}
            {page === "discover" && (
              <Discover onSearch={(q) => send(q, { fresh: true })} />
            )}
            {page === "saved" && (
              <Saved
                saved={saved}
                onSave={toggleSave}
                onVisit={visit}
                collections={collections}
                setCollections={setCollections}
                onCompare={(items) =>
                  send(
                    "Find alternatives to these: " +
                      items
                        .map((p) => p.title)
                        .join("; ")
                        .slice(0, 260),
                    { fresh: true },
                  )
                }
              />
            )}
            {page.startsWith("account") && (
              <Account
                key={scope + section}
                section={section}
                profile={profile}
                personal={personal}
                setPersonal={setPersonal}
                appearance={appearance}
                setAppearance={setAppearance}
                preferences={preferences}
                setPreferences={setPreferences}
                history={history}
                setHistory={setHistory}
                conversations={conversations}
                setConversations={setConversations}
                trackHistory={trackHistory}
                setTrackHistory={setTrackHistory}
                showFeedback={showFeedback}
                setShowFeedback={setShowFeedback}
                onNameSave={saveName}
                onSignIn={() => setAccountOpen(true)}
                onVisit={visit}
                onResume={resume}
                onPassword={(p) =>
                  api.profileAction(token, "changePassword", {
                    currentPassword: p.current,
                    newPassword: p.next,
                  })
                }
                notify={notify}
                onExport={exportData}
                onClear={clearLocal}
              />
            )}
            {page === "about" && (
              <div className="about-page">
                {/* The mark at full resolution. This is the only place it can
                    be itself: 160 overlapping curves need the room. */}
                <div className="about-mark" aria-hidden="true" />
                <span className="eyebrow">A little about Olio</span>
                <h1>
                  For the thing you can describe,
                  <br />
                  but can’t quite find.
                </h1>
                <p className="about-lead">
                  Shopping should leave room for the details. The bag that fits
                  your laptop. The light that makes a small room feel warmer.
                  The budget you actually want to stick to.
                </p>
                <div className="about-photo art-home" />
                <div className="about-columns">
                  <section>
                    <h2>Start with your own words.</h2>
                    <p>
                      Olio is a shopping assistant built by Delina Kahsay to
                      explore a simple idea: what if finding a product started
                      with describing what you need?
                    </p>
                  </section>
                  <section>
                    <h2>A shortlist you can shape.</h2>
                    <p>
                      Olio reads your request, searches shopping listings, and
                      helps you refine the options. Keep the conversation going,
                      save a find, or explore another direction.
                    </p>
                  </section>
                  <section>
                    <h2>The details still matter.</h2>
                    <p>
                      Recommendations use available listing information. Check
                      specifications, current price, availability, and shipping
                      with the retailer before buying. Olio does not process
                      purchases.
                    </p>
                  </section>
                </div>
                <a href="#/chat" className="primary">
                  Find your kind of thing <Icon name="arrow" />
                </a>
              </div>
            )}
            {page === "cart" && (
              <>
                <div className="page-heading">
                  <h1>Your cart</h1>
                  <p>
                    Items from your earlier searches. Purchases happen with each
                    retailer.
                  </p>
                </div>
                <div className="surface settings-content">
                  {!cart.length ? (
                    <p>Your cart is empty. You can keep new finds in Saved.</p>
                  ) : (
                    cart.map((p) => (
                      <div key={p.id} className="history-row">
                        <div className="history-info">
                          <h3>{p.title}</h3>
                          <p>{p.price}</p>
                        </div>
                        <a
                          className="outline"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={
                            isValidHttpUrl(p.link)
                              ? p.link
                              : fallbackSearchLink(p.title)
                          }
                          onClick={() => visit(p)}
                        >
                          View at retailer
                        </a>
                        <button
                          className="text-button"
                          onClick={async () => {
                            try {
                              const next = cart.filter((x) => x.id !== p.id);
                              await api.profileAction(token, "saveCart", {
                                cart: next,
                              });
                              setCart(next);
                            } catch {
                              notify("Could not update cart", true);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
            {!["chat", "discover", "saved", "about", "cart"].includes(page) &&
              !page.startsWith("account") && (
                <div className="empty-state">
                  <h1>Let’s get you back.</h1>
                  <a className="primary" href="#/chat">
                    Open Olio
                  </a>
                </div>
              )}
          </>
        )}
      </main>
      <footer className="site-footer">
        <span className="serif">A little particular. A little Olio.</span>
        <a href="#/about">About</a>
        <a href="#/account/help">Help</a>
        <a href="#/account/privacy">Privacy</a>
      </footer>
      {accountOpen && (
        <AccountModal
          onClose={() => {
            pendingSearch.current = null;
            setAccountOpen(false);
          }}
          onAuthed={authed}
        />
      )}
      <Toast message={toast} />
    </>
  );
}

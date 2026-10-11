import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import ProductCard from "./ProductCard.jsx";
const CATEGORIES = [
  ["clothing", "Clothing"],
  ["shoes", "Shoes"],
  ["bags", "Bags & luggage"],
  ["jewelry", "Jewelry & watches"],
  ["beauty", "Beauty & skincare"],
  ["home", "Home & furniture"],
  ["kitchen", "Kitchen & dining"],
  ["bedding", "Bedding & bath"],
  ["electronics", "Tech & audio"],
  ["fitness", "Fitness & outdoors"],
  ["books", "Books & stationery"],
  ["toys", "Toys & games"],
  ["pets", "Pet supplies"],
  ["gifts", "Gifts"],
];
import { Inspiration, inspirations } from "./Discover.jsx";
// The one line on an empty conversation. Not a greeting: Olio is a place you
// shop, not someone you say good evening to. Each line gives permission to be
// vague, which is the premise of the whole product.
const OPENERS = [
  "Describe it however it comes out.",
  "Tell me the thing you can’t quite find.",
  "Start anywhere. We’ll narrow it.",
  "What’s the thing?",
];
// Chosen once per mount, so it varies between visits but never mid-session.
const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
export default function Chat({
  messages,
  results,
  reading,
  loading,
  error,
  onSend,
  onReset,
  saved,
  onSave,
  onVisit,
  preferences,
}) {
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState(preferences.category || "");
  const [budget, setBudget] = useState(preferences.budget || "");
  const [sort, setSort] = useState("match");
  // Refinements accumulate. Clicking one used to fire a whole new search and
  // throw away the last, so you could never ask for two things at once.
  const [pinned, setPinned] = useState([]);
  const feed = useRef(null);
  useEffect(() => {
    if (feed.current)
      feed.current.scrollTop =
        messages.length || loading ? feed.current.scrollHeight : 0;
  }, [messages, loading]);
  const products = [...results].sort((a, b) =>
    sort === "low"
      ? a.priceNum - b.priceNum
      : sort === "high"
        ? b.priceNum - a.priceNum
        : 0,
  );
  function submit(e) {
    e.preventDefault();
    if (!draft.trim() || loading) return;
    onSend(draft.trim(), { category, priceMax: budget, refinements: pinned });
    setDraft("");
  }
  // Re-runs the last request with the filter set changed, instead of sending
  // the filter itself as a new message.
  function applyFilters(next) {
    setPinned(next);
    const last = messages.filter((m) => m.role === "user").at(-1)?.text;
    if (last && !loading)
      onSend(last, {
        category,
        priceMax: budget,
        refinements: next,
        retry: true,
      });
  }
  return (
    <>
      <div className="shopping-workspace">
        <section
          className={
            "chat-panel surface" + (messages.length ? "" : " is-empty")
          }
          aria-label="Shopping conversation"
        >
          {/* Only offer "New search" once there is something to clear. */}
          {messages.length > 0 && (
            <div className="panel-heading">
              <button
                className="text-button small"
                onClick={onReset}
                disabled={loading}
              >
                <Icon name="reset" /> New search
              </button>
            </div>
          )}
          <div
            className="message-feed"
            ref={feed}
            role="log"
            aria-live="polite"
          >
            {!messages.length && (
              // The mark, one line, then the composer. Suggestions come back
              // when they can be drawn from what someone has actually
              // looked at.
              <>
                <div className="chat-mark" aria-hidden="true" />
                <p className="welcome-line">{opener}</p>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"message " + m.role}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="message assistant loading-message">
                Reading your request, then looking for options
                <span className="loading-dots" aria-hidden="true">
                  …
                </span>
              </div>
            )}
            {error && (
              <div className="error-message" role="alert">
                {error}
                <button
                  className="text-button"
                  onClick={() =>
                    onSend(
                      messages.filter((m) => m.role === "user").at(-1)?.text,
                      { category, priceMax: budget, retry: true },
                    )
                  }
                >
                  Try again
                </button>
              </div>
            )}
            {!loading && (pinned.length > 0 || reading?.refinements?.length > 0) && (
              <div className="suggestions">
                {pinned.map((r) => (
                  <button
                    className="pinned"
                    key={r}
                    aria-pressed="true"
                    title={`Remove ${r}`}
                    onClick={() => applyFilters(pinned.filter((p) => p !== r))}
                  >
                    {r}
                    <Icon name="close" />
                  </button>
                ))}
                {(reading?.refinements || [])
                  .filter((r) => !pinned.includes(r))
                  .map((r) => (
                    <button
                      className="outline"
                      key={r}
                      onClick={() => applyFilters([...pinned, r])}
                    >
                      {r}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <form className="composer" onSubmit={submit}>
            <div className="composer-input">
              <textarea
                aria-label="Message Olio"
                placeholder={
                  messages.length
                    ? "Tell me what you’d change…"
                    : "A work bag that fits my laptop, under $100…"
                }
                value={draft}
                maxLength={300}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
              />
            </div>
            {/* Controls live on the composer, not in a row beneath it, so the
                input reads as one object the way Claude's and GPT's do. */}
            <div className="composer-bar">
              <div className="composer-filters">
                {/* A free number beats a five-rung dropdown: "under $140" is a
                    real budget and "Under $200" was never anyone's. */}
                <label className="budget-field">
                  <span className="sr-only">Maximum budget</span>
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    placeholder="Max"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </label>
                <label className="select-field">
                  <span className="sr-only">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {CATEGORIES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="send-button"
                aria-label="Send message"
                disabled={!draft.trim() || loading}
              >
                <Icon name="send" />
              </button>
            </div>
          </form>
        </section>
        <section className="shortlist surface" aria-label="Shopping shortlist">
          <div className="panel-heading">
            <h2>
              {messages.length ? "A few worth a look" : "Good places to start"}
            </h2>
            {results.length > 0 && (
              <select
                aria-label="Sort results"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="match">Best match</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            )}
          </div>
          {reading?.constraints?.length > 0 && (
            <div className="constraint-list">
              {reading.constraints.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}
          {results.length ? (
            <>
              <p className="subtle result-count">
                {results.length} options · Check details and current prices with
                the retailer.
              </p>
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isSaved={saved.some((s) => s.id === p.id)}
                    onToggleSave={onSave}
                    onVisit={onVisit}
                  />
                ))}
              </div>
            </>
          ) : loading ? (
            <div className="skeleton-grid" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="inspiration-grid">
                {inspirations.map((item) => (
                  <Inspiration
                    compact
                    key={item.title}
                    item={item}
                    onChoose={(q) => onSend(q, { fresh: true })}
                  />
                ))}
              </div>
              <div className="shortlist-note">
                {/* One line here too. A heading, a paragraph and a footnote
                    for an empty panel was three taglines for no content. */}
                <p className="empty-line">
                  {messages.length
                    ? "Nothing matched. Try a broader description or a different budget."
                    : "Your shortlist will appear here."}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

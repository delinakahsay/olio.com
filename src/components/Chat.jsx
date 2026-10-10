import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import ProductCard from "./ProductCard.jsx";
import { Inspiration, inspirations } from "./Discover.jsx";
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
    onSend(draft.trim(), { category, priceMax: budget });
    setDraft("");
  }
  return (
    <>
      <div className="page-heading chat-heading">
        <h1>Let’s find your kind of thing.</h1>
      </div>
      <div className="shopping-workspace">
        <section
          className="chat-panel surface"
          aria-label="Shopping conversation"
        >
          <div className="panel-heading">
            <h2>Your shopping conversation</h2>
            <button
              className="text-button small"
              onClick={onReset}
              disabled={loading}
            >
              <Icon name="reset" /> New search
            </button>
          </div>
          <div
            className="message-feed"
            ref={feed}
            role="log"
            aria-live="polite"
          >
            {!messages.length && (
              <div className="welcome">
                <span className="eyebrow">A little particular? Perfect.</span>
                <h2>
                  What do you have
                  <br />
                  in mind?
                </h2>
                <p>
                  Tell me what you’re looking for, what you’d like to spend, and
                  the details that matter to you.
                </p>
                <div className="starter-list">
                  {[
                    "A bag for class that fits my laptop",
                    "A lamp for a small desk",
                    "Headphones for my daily commute",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => onSend(q, { category, priceMax: budget })}
                    >
                      {q}
                      <Icon name="arrow" />
                    </button>
                  ))}
                </div>
              </div>
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
            {!loading && reading?.refinements?.length > 0 && (
              <div className="suggestions">
                {reading.refinements.map((r) => (
                  <button
                    className="outline"
                    key={r}
                    onClick={() => onSend(r, { category, priceMax: budget })}
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
              <button
                className="send-button"
                aria-label="Send message"
                disabled={!draft.trim() || loading}
              >
                <Icon name="send" />
              </button>
            </div>
            <div className="composer-filters">
              <label>
                <span className="sr-only">Maximum budget</span>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                >
                  <option value="">Budget: Any</option>
                  {[25, 50, 100, 200, 500].map((n) => (
                    <option key={n} value={n}>
                      Under ${n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  <option value="clothing">Clothing & bags</option>
                  <option value="home">Home</option>
                  <option value="electronics">Tech</option>
                  <option value="beauty">Beauty</option>
                </select>
              </label>
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
                <h2>
                  {messages.length
                    ? "Let’s try another angle."
                    : "The details make the difference."}
                </h2>
                <p>
                  {messages.length
                    ? "Try a broader description or a different budget."
                    : "Start with an idea. Your shortlist will appear here, and we can narrow it down together."}
                </p>
                <span className="subtle">
                  Inspiration images, not product listings.
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

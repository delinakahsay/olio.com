import { useState } from "react";
import ProductCard from "./ProductCard.jsx";
import Icon from "./Icon.jsx";
export default function Saved({
  saved,
  onSave,
  onVisit,
  collections,
  setCollections,
  onCompare,
}) {
  const [filter, setFilter] = useState("All saved");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [comparing, setComparing] = useState(false);
  const shown = saved
    .filter(
      (p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) &&
        (filter === "All saved" || collections.assignments[p.id] === filter),
    )
    .slice()
    .sort((a, b) => (sort === "low" ? a.priceNum - b.priceNum : 0));
  function create(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value || value === "All saved") return;
    setCollections((c) => ({ ...c, names: [...new Set([...c.names, value])] }));
    setName("");
    setCreating(false);
    setFilter(value);
  }
  const compared = saved.filter((p) => selected.includes(p.id));
  return (
    <>
      <div className="page-heading with-action">
        <div>
          <h1>Worth coming back to.</h1>
          <p>Your finds, all in one place.</p>
        </div>
        <button className="primary" onClick={() => setCreating(!creating)}>
          <Icon name="plus" />
          New collection
        </button>
      </div>
      {creating && (
        <form className="inline-form surface" onSubmit={create}>
          <label>
            Collection name
            <input
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button className="primary">Create</button>
          <button
            type="button"
            className="outline"
            onClick={() => setCreating(false)}
          >
            Cancel
          </button>
        </form>
      )}
      <div className="toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search saved finds"
            placeholder="Search your saved finds"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Sort saved items"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Recently saved</option>
          <option value="low">Price: low to high</option>
        </select>
      </div>
      <div className="tabs">
        {["All saved", ...collections.names].map((n) => (
          <button
            key={n}
            onClick={() => setFilter(n)}
            aria-pressed={filter === n}
          >
            {n}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="saved-grid">
          {shown.map((p) => (
            <div key={p.id}>
              <ProductCard
                product={p}
                isSaved
                onToggleSave={onSave}
                onVisit={onVisit}
                collectionControl={
                  <label className="collection-label">
                    <span className="sr-only">Collection for {p.title}</span>
                    <select
                      value={collections.assignments[p.id] || ""}
                      onChange={(e) =>
                        setCollections((c) => ({
                          ...c,
                          assignments: {
                            ...c.assignments,
                            [p.id]: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">No collection</option>
                      {collections.names.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                }
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, p.id]
                        : s.filter((id) => id !== p.id),
                    )
                  }
                />
                Compare this find
              </label>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state surface">
          <h2>
            {saved.length
              ? "Nothing here just yet."
              : "A place for your good finds."}
          </h2>
          <p>
            {saved.length
              ? "Try another collection or search."
              : "Save products from your conversation and come back whenever you like."}
          </p>
          <a className="outline" href="#/chat">
            Start a conversation <Icon name="arrow" />
          </a>
        </div>
      )}
      <div className="compare-banner">
        <div>
          <h2>Still deciding?</h2>
          <p>Select two or more finds to compare their details.</p>
        </div>
        <button
          className="primary"
          disabled={compared.length < 2}
          onClick={() => setComparing(!comparing)}
        >
          {comparing
            ? "Close comparison"
            : `Compare${compared.length ? ` (${compared.length})` : ""}`}
        </button>
      </div>
      {comparing && compared.length >= 2 && (
        <section className="surface comparison">
          <h2>Your finds, side by side</h2>
          <div className="comparison-grid">
            {compared.map((p) => (
              <article key={p.id}>
                <h3>{p.title}</h3>
                <p>{p.price || "Price unavailable"}</p>
                <p className="subtle">{p.source}</p>
                <p>
                  {p.why ||
                    p.snippet ||
                    "Check the retailer for specifications."}
                </p>
              </article>
            ))}
          </div>
          <button className="outline" onClick={() => onCompare(compared)}>
            Find more like these <Icon name="arrow" />
          </button>
        </section>
      )}
    </>
  );
}

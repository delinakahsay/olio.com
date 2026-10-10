import { useState } from "react";
import Icon from "./Icon.jsx";
export const inspirations = [
  {
    title: "A better little workspace",
    category: "Home",
    photo: "home",
    query: "A warm desk lamp for a small workspace under $80",
  },
  {
    title: "Room for the everyday",
    category: "Style",
    photo: "carry",
    query: "An everyday tote that fits a 14 inch laptop under $100",
  },
  {
    title: "Small tech, good company",
    category: "Tech",
    photo: "tech",
    query: "Comfortable over ear headphones for studying under $100",
  },
];
export function Inspiration({ item, onChoose, compact }) {
  return (
    <button
      className={"inspiration art-" + item.photo + (compact ? " compact" : "")}
      onClick={() => onChoose(item.query)}
    >
      <span>
        <strong>{item.title}</strong>
        <span className="explore-label">
          Explore with Olio <Icon name="arrow" />
        </span>
      </span>
    </button>
  );
}
export default function Discover({ onSearch }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  return (
    <>
      <div className="page-heading">
        <h1>Something might catch your eye.</h1>
        <p>A starting point for your next conversation.</p>
      </div>
      <form
        className="discover-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSearch(query.trim());
        }}
      >
        <input
          aria-label="What are you looking for?"
          placeholder="What are you looking for today?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
          maxLength={300}
        />
        <button className="primary">
          Ask Olio <Icon name="arrow" />
        </button>
      </form>
      <div className="tabs" aria-label="Discover category">
        {["All", "Home", "Style", "Tech"].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c === "All" ? "Explore" : c}
          </button>
        ))}
      </div>
      <div
        className={"discover-grid" + (category !== "All" ? " filtered" : "")}
      >
        {inspirations
          .filter((x) => category === "All" || x.category === category)
          .map((item) => (
            <Inspiration key={item.title} item={item} onChoose={onSearch} />
          ))}
      </div>
      <div className="discovery-note">
        <h2>A little particular? Perfect.</h2>
        <p>
          Tell Olio what matters: the budget, the material, or the thing you can
          never quite find.
        </p>
        <button
          className="outline"
          onClick={() => onSearch("A thoughtful practical gift under $50")}
        >
          Find a thoughtful gift <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}

import { useState } from 'react';

const CATEGORIES = ['clothing', 'electronics', 'home', 'beauty'];

export default function Hero({ onSearch, searching }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  function submit() {
    onSearch({ query: query.trim(), category, priceMin, priceMax });
  }

  return (
    <section id="hero">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="hero-badge">AI-powered shopping</div>
      <h1 className="hero-title">Find anything,<br />the way you&rsquo;d <em>describe it</em></h1>
      <p className="hero-sub">Tell Olio what you&rsquo;re looking for in your own words. We search the web and organize the best options for you.</p>
      <div className="search-container">
        <div className="search-box">
          <div className="search-main">
            <span className="search-icon">&#128269;</span>
            <input
              type="text"
              id="searchInput"
              placeholder="A warm coat for rainy weather, not too heavy..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </div>
          <div className="search-actions">
            <div className="filter-row">
              <div className="price-inputs">
                <span className="price-sep">$</span>
                <input type="number" className="price-in" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                <span className="price-sep">to</span>
                <input type="number" className="price-in" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
              </div>
              {CATEGORIES.map((c) => (
                <div
                  key={c}
                  className={'filter-pill' + (category === c ? ' active' : '')}
                  onClick={() => setCategory(category === c ? '' : c)}
                >
                  {c[0].toUpperCase() + c.slice(1)}
                </div>
              ))}
            </div>
            <button className="search-go" onClick={submit} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { forwardRef } from 'react';
import ProductCard from './ProductCard.jsx';

const ResultsSection = forwardRef(function ResultsSection(
  { query, state, error, summary, results, cart, saved, sort, onSort, onToggleCart, onToggleSave },
  ref
) {
  return (
    <section id="resultsSection" ref={ref}>
      <div className="results-header">
        <div>
          <div className="results-title">&ldquo;{query}&rdquo;</div>
          {state === 'done' && <div className="results-count">{results.length} products found</div>}
        </div>
        <select className="sort-select" value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="relevance">Relevance</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
        </select>
      </div>
      {summary && (
        <div className="ai-summary">
          <div className="ai-summary-label">Olio&rsquo;s recommendation</div>
          <div className="ai-summary-text">{summary}</div>
        </div>
      )}
      {state === 'loading' && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Finding the best products for you...</div>
        </div>
      )}
      {state === 'error' && (
        <div style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>{error}</div>
      )}
      {state === 'done' && (
        results.length ? (
          <div className="product-grid">
            {results.map((r) => (
              <ProductCard
                key={r.id}
                product={r}
                inCart={cart.some((c) => c.id === r.id)}
                isSaved={saved.some((s) => s.id === r.id)}
                onToggleCart={() => onToggleCart(r)}
                onToggleSave={() => onToggleSave(r)}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', padding: '2rem' }}>No products found.</div>
        )
      )}
    </section>
  );
});

export default ResultsSection;

import { forwardRef } from 'react';
import ProductCard from './ProductCard.jsx';

const ResultsSection = forwardRef(function ResultsSection(
  { query, state, error, summary, reading, results, cart, saved, sort, onSort, onToggleCart, onToggleSave, onRefine },
  ref
) {
  const constraints = reading?.constraints || [];
  const refinements = reading?.refinements || [];

  return (
    <section id="resultsSection" ref={ref}>
      <div className="results-header">
        <div>
          <div className="results-title">&ldquo;{query}&rdquo;</div>
          {state === 'done' && <div className="results-count">{results.length} products found</div>}
        </div>
        <select className="sort-select" value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="relevance">Best match</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
        </select>
      </div>

      {state === 'done' && constraints.length > 0 && (
        <div className="reading">
          <div className="reading-row">
            <span className="reading-label">Looking for</span>
            <span className="chips">
              {constraints.map((c) => <span className="chip chip-fixed" key={c}>{c}</span>)}
            </span>
          </div>
          {summary && <div className="reading-note">{summary}</div>}
          {refinements.length > 0 && (
            <div className="reading-row">
              <span className="reading-label">Narrow it</span>
              <span className="chips">
                {refinements.map((r) => (
                  <button type="button" className="chip chip-action" key={r} onClick={() => onRefine && onRefine(r)}>
                    {r}
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {state === 'loading' && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-text">Reading your request, then searching&hellip;</div>
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

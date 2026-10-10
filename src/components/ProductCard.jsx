import { useState } from 'react';
import { isValidHttpUrl, fallbackSearchLink } from '../utils.js';

export default function ProductCard({ product, inCart, isSaved, onToggleCart, onToggleSave }) {
  const [imgFailed, setImgFailed] = useState(false);
  const link = isValidHttpUrl(product.link) ? product.link : fallbackSearchLink(product.title);
  const showImg = isValidHttpUrl(product.thumbnail) && !imgFailed;

  return (
    <div className="product-card">
      <div className="product-img-wrap">
        {showImg
          ? <img src={product.thumbnail} alt={product.title} onError={() => setImgFailed(true)} />
          : <span className="placeholder">olio</span>}
      </div>
      <div className="product-body">
        <div className="product-source">{product.source}</div>
        <div className="product-title">{product.title}</div>
        {product.price && <div className="product-price">{product.price}</div>}
        {product.why
          ? <div className="product-why">{product.why}</div>
          : <div className="product-snippet">{product.snippet}</div>}
        <div className="product-actions">
          <button className={'btn-cart' + (inCart ? ' in-cart' : '')} onClick={onToggleCart}>
            {inCart ? 'Added' : '+ Cart'}
          </button>
          <button className={'btn-save' + (isSaved ? ' saved' : '')} onClick={onToggleSave}>
            {isSaved ? '♥' : '♡'}
          </button>
          <a className="btn-link" href={link} target="_blank" rel="noopener noreferrer">Shop</a>
        </div>
      </div>
    </div>
  );
}

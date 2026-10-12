import { useState } from "react";
import { isValidHttpUrl, fallbackSearchLink } from "../utils.js";
import Icon from "./Icon.jsx";
export default function ProductCard({
  product,
  isSaved,
  onToggleSave,
  onVisit,
  collectionControl,
}) {
  const [failed, setFailed] = useState(false);
  const link = isValidHttpUrl(product.link)
    ? product.link
    : fallbackSearchLink(product.title);
  return (
    <article className="product-card">
      <div className="product-photo">
        {isValidHttpUrl(product.thumbnail) && !failed ? (
          <img
            loading="lazy"
            src={product.thumbnail}
            alt={product.title}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="photo-fallback">olio</span>
        )}
        <button
          className={"save-icon" + (isSaved ? " selected" : "")}
          aria-label={`${isSaved ? "Unsave" : "Save"} ${product.title}`}
          aria-pressed={!!isSaved}
          onClick={() => onToggleSave(product)}
        >
          <Icon name="bookmark" fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <p className="retailer">{product.source}</p>
        <h3>{product.title}</h3>
        <p className="price">
          {product.price || "Check retailer for price"}
          {product.rating ? (
            <span className="rating">
              {product.rating.toFixed(1)}
              {product.reviews ? ` · ${product.reviews.toLocaleString()}` : ""}
            </span>
          ) : null}
        </p>
        {product.why && <p className="product-why">{product.why}</p>}
        <a
          className="retailer-link"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onVisit(product)}
        >
          View at retailer <Icon name="arrow" />
        </a>
        {collectionControl}
      </div>
    </article>
  );
}

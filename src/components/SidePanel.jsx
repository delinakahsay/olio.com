import { isValidHttpUrl } from '../utils.js';

function PanelItem({ item, onRemove }) {
  return (
    <div className="panel-item">
      <div className="panel-item-img">
        {isValidHttpUrl(item.thumbnail) ? <img src={item.thumbnail} alt="" /> : <>&#9675;</>}
      </div>
      <div className="panel-item-info">
        <div className="panel-item-title">{item.title}</div>
        <div className="panel-item-price">{item.price || ''}</div>
      </div>
      <button className="panel-item-remove" onClick={onRemove}>&#10005;</button>
    </div>
  );
}

export default function SidePanel({ type, cart, saved, onClose, onRemoveCart, onRemoveSaved, onCheckout }) {
  const open = type !== null;
  const isCart = type === 'cart';
  const items = isCart ? cart : saved;
  const total = cart.reduce((s, i) => s + (i.priceNum || 0), 0);

  const groups = {};
  if (isCart) {
    cart.forEach((item) => {
      const src = item.source || 'Online';
      (groups[src] = groups[src] || []).push(item);
    });
  }

  return (
    <>
      <div className={'panel-overlay' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'panel' + (open ? ' open' : '')}>
        <div className="panel-header">
          <div className="panel-title">{isCart ? 'Your Cart' : 'Saved Items'}</div>
          <button className="panel-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="panel-body">
          {!items.length ? (
            <div className="panel-empty">
              {isCart ? <>&#9675;</> : <>&#9825;</>}
              <span>{isCart ? 'Your cart is empty' : 'Nothing saved yet'}</span>
            </div>
          ) : isCart ? (
            Object.entries(groups).map(([src, groupItems]) => (
              <div className="checkout-group" key={src}>
                <div className="checkout-group-header">{src} ({groupItems.length})</div>
                {groupItems.map((item) => (
                  <PanelItem key={item.id} item={item} onRemove={() => onRemoveCart(item.id)} />
                ))}
              </div>
            ))
          ) : (
            items.map((item) => (
              <PanelItem key={item.id} item={item} onRemove={() => onRemoveSaved(item.id)} />
            ))
          )}
        </div>
        {isCart && items.length > 0 && (
          <div className="panel-footer">
            <div className="panel-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
            <button className="panel-checkout" onClick={onCheckout}>Checkout</button>
          </div>
        )}
      </div>
    </>
  );
}

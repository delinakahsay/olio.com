import { isValidHttpUrl } from '../utils.js';

function ProfileRow({ item }) {
  return (
    <div className="profile-row">
      <div className="profile-row-img">
        {isValidHttpUrl(item.thumbnail) ? <img src={item.thumbnail} alt="" /> : <>&#128722;</>}
      </div>
      <div className="profile-row-info">
        <div className="profile-row-title">{item.title}</div>
        <div className="profile-row-meta">
          {item.source || ''}{item.price ? <> &middot; {item.price}</> : null}
        </div>
      </div>
    </div>
  );
}

export default function ProfileModal({ profile, saved, onClose, onSignOut }) {
  const orders = (profile.orders || []).slice().reverse();
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">My Profile</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div>
            <div className="profile-greeting">Hi{profile.name ? ', ' + profile.name : ''}!</div>
            <div className="profile-email">{profile.email || ''}</div>
          </div>
          <div>
            <div className="profile-section-title">Saved Items ({saved.length})</div>
            {!saved.length
              ? <div className="profile-empty">Nothing saved yet.</div>
              : saved.map((it) => <ProfileRow key={it.id} item={it} />)}
          </div>
          <div>
            <div className="profile-section-title">Order History ({orders.length})</div>
            {!orders.length
              ? <div className="profile-empty">No orders yet.</div>
              : orders.map((o, i) => (
                <div className="order-card" key={i}>
                  <div className="order-card-head">
                    <span>{o.purchasedAt ? new Date(o.purchasedAt).toLocaleDateString() : ''}</span>
                    <span className="order-card-total">${Number(o.total || 0).toFixed(2)}</span>
                  </div>
                  {(o.items || []).map((it) => <ProfileRow key={it.id} item={it} />)}
                </div>
              ))}
          </div>
          <button className="signout-btn" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

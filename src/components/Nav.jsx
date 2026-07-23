export default function Nav({ cartCount, profile, onOpenPanel, onOpenAccount }) {
  const accountLabel = profile
    ? (profile.name ? 'Hi, ' + profile.name.split(' ')[0] : 'My Profile')
    : 'Account';
  return (
    <nav>
      <div className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        oli<span>o</span>
      </div>
      <div className="nav-right">
        <button className="nav-btn" onClick={() => onOpenPanel('saved')}>Saved</button>
        <button className="nav-btn" onClick={() => onOpenPanel('cart')}>
          Cart <span className={'cart-count' + (cartCount ? ' visible' : '')}>{cartCount}</span>
        </button>
        <button className="nav-btn" onClick={onOpenAccount}>{accountLabel}</button>
      </div>
    </nav>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import ResultsSection from './components/ResultsSection.jsx';
import SidePanel from './components/SidePanel.jsx';
import AccountModal from './components/AccountModal.jsx';
import ProfileModal from './components/ProfileModal.jsx';
import Toast from './components/Toast.jsx';
import { isValidHttpUrl, fallbackSearchLink } from './utils.js';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('olioAuthToken'));
  const [profile, setProfile] = useState(null);
  const [cart, setCart] = useState([]);
  const [saved, setSaved] = useState([]);

  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState('');
  const [searchState, setSearchState] = useState('idle'); // idle | loading | done | error
  const [searchError, setSearchError] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [sort, setSort] = useState('relevance');

  const [panel, setPanel] = useState(null); // null | 'cart' | 'saved'
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const resultsRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  // Restore the session on load: a stale token is cleared silently.
  useEffect(() => {
    if (!token) return;
    api.getProfile(token).then((data) => {
      setProfile(data);
      setSaved(data.savedItems || []);
      setCart(data.cart || []);
    }).catch(() => {
      localStorage.removeItem('olioAuthToken');
      setToken(null);
      setProfile(null);
    });
  }, [token]);

  async function doSearch({ query, category, priceMin, priceMax }) {
    if (!query) {
      showToast('Type what you are looking for');
      return;
    }
    let context = query;
    if (category) context += ' ' + category;
    if (priceMin) context += ' min price $' + priceMin;
    if (priceMax) context += ' max price $' + priceMax;

    setLastQuery(query);
    setSearchState('loading');
    setResults([]);
    setSummary('');
    setSort('relevance');
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const data = await api.search(context);
      setResults(data.products || []);
      setSummary(data.summary || '');
      setSearchState('done');
    } catch (err) {
      setSearchError(err.message);
      setSearchState('error');
    }
  }

  function persistCart(nextCart) {
    if (!profile || !token) return;
    api.profileAction(token, 'saveCart', { cart: nextCart }).catch(() => {});
  }

  function toggleCart(item) {
    const inCart = cart.some((c) => c.id === item.id);
    const next = inCart ? cart.filter((c) => c.id !== item.id) : [...cart, item];
    setCart(next);
    showToast(inCart ? 'Removed from cart' : 'Added to cart!');
    persistCart(next);
  }

  function toggleSave(item) {
    const isSaved = saved.some((s) => s.id === item.id);
    const next = isSaved ? saved.filter((s) => s.id !== item.id) : [...saved, item];
    setSaved(next);
    if (profile && token) {
      api.profileAction(token, isSaved ? 'removeItem' : 'saveItem', isSaved ? { itemId: item.id } : { item }).catch(() => {});
      showToast(isSaved ? 'Removed' : 'Saved!');
    } else {
      showToast(isSaved ? 'Removed' : 'Saved! Log in to keep it across devices');
    }
  }

  function handleAuthed(data) {
    localStorage.setItem('olioAuthToken', data.token);
    setToken(data.token);
    setProfile({ email: data.email, name: data.name, savedItems: data.savedItems || [], orders: data.orders || [] });
    setSaved(data.savedItems || []);
    setCart(data.cart || []);
    setTimeout(() => {
      setAccountOpen(false);
      setProfileOpen(true);
    }, 700);
  }

  function signOut() {
    localStorage.removeItem('olioAuthToken');
    setToken(null);
    setProfile(null);
    setSaved([]);
    setCart([]);
    setProfileOpen(false);
    showToast('Signed out');
  }

  function checkout() {
    if (!cart.length) {
      showToast('Your cart is empty');
      return;
    }
    if (!profile) showToast('Log in to track your orders');
    // Open one retailer tab per seller group, like a hand-off checkout.
    const groups = {};
    cart.forEach((item) => {
      const src = item.source || 'Online';
      (groups[src] = groups[src] || []).push(item);
    });
    Object.values(groups).forEach(([first]) => {
      const link = isValidHttpUrl(first.link) ? first.link : fallbackSearchLink(first.title);
      window.open(link, '_blank');
    });
    if (profile && token) {
      api.profileAction(token, 'confirmPurchase', { items: cart })
        .then((d) => {
          if (d.orders) setProfile((p) => ({ ...p, orders: d.orders }));
          setCart([]);
          persistCart([]);
          setPanel(null);
          showToast('Order saved to your history!');
        })
        .catch(() => showToast('Opened checkout, but could not save order'));
    } else {
      showToast('Opened checkout for each retailer');
    }
  }

  const sortedResults = [...results];
  if (sort === 'price-low') sortedResults.sort((a, b) => a.priceNum - b.priceNum);
  if (sort === 'price-high') sortedResults.sort((a, b) => b.priceNum - a.priceNum);

  return (
    <>
      <Nav
        cartCount={cart.length}
        profile={profile}
        onOpenPanel={setPanel}
        onOpenAccount={() => (profile ? setProfileOpen(true) : setAccountOpen(true))}
      />
      <Hero onSearch={doSearch} searching={searchState === 'loading'} />
      {searchState !== 'idle' && (
        <ResultsSection
          ref={resultsRef}
          query={lastQuery}
          state={searchState}
          error={searchError}
          summary={summary}
          results={sortedResults}
          cart={cart}
          saved={saved}
          sort={sort}
          onSort={setSort}
          onToggleCart={toggleCart}
          onToggleSave={toggleSave}
        />
      )}
      <SidePanel
        type={panel}
        cart={cart}
        saved={saved}
        onClose={() => setPanel(null)}
        onRemoveCart={(id) => toggleCart(cart.find((c) => c.id === id))}
        onRemoveSaved={(id) => toggleSave(saved.find((s) => s.id === id))}
        onCheckout={checkout}
      />
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} onAuthed={handleAuthed} />}
      {profileOpen && profile && (
        <ProfileModal profile={profile} saved={saved} onClose={() => setProfileOpen(false)} onSignOut={signOut} />
      )}
      <Toast message={toast} />
    </>
  );
}

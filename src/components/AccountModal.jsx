import { useState } from 'react';
import * as api from '../api.js';

export default function AccountModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null); // { msg, ok }

  async function submit() {
    if (!email.trim() || !password.trim()) {
      setStatus({ msg: 'Email and password are required.', ok: false });
      return;
    }
    try {
      const payload = { action: mode, email: email.trim(), password: password.trim() };
      if (mode === 'register') payload.name = name.trim();
      const data = await api.auth(payload);
      setStatus({ msg: 'Signed in successfully!', ok: true });
      onAuthed(data);
    } catch (err) {
      setStatus({ msg: err.message, ok: false });
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Account</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="account-steps">
            <button className={'account-step' + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setStatus(null); }}>Login</button>
            <button className={'account-step' + (mode === 'register' ? ' active' : '')} onClick={() => { setMode('register'); setStatus(null); }}>Register</button>
          </div>
          <div className="account-form">
            {mode === 'register' && (
              <>
                <label>Name</label>
                <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              </>
            )}
            <label>Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            <button className="account-submit" onClick={submit}>{mode === 'login' ? 'Login' : 'Register'}</button>
          </div>
          <div className="account-status" style={{ color: status ? (status.ok ? 'var(--green)' : '#ec5f5c') : undefined }}>
            {status?.msg || ''}
          </div>
        </div>
      </div>
    </div>
  );
}

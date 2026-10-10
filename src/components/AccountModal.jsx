import { useEffect, useRef, useState } from "react";
import * as api from "../api.js";
export default function AccountModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector("input")?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = dialog.current.querySelectorAll(
          "button:not(:disabled),input",
        );
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const data = await api.auth({
        action: mode,
        email: email.trim(),
        password,
        ...(mode === "register" ? { name: name.trim() } : {}),
      });
      onAuthed(data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        ref={dialog}
      >
        <div className="modal-header">
          <h2 id="account-title" className="modal-title">
            Your Olio account
          </h2>
          <button
            className="modal-close"
            aria-label="Close account dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="account-steps">
          {["login", "register"].map((m) => (
            <button
              key={m}
              className={"account-step" + (mode === m ? " active" : "")}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setStatus("");
              }}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <form className="account-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input
                required
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? 8 : undefined}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="account-submit" disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
          {status && (
            <p role="alert" className="account-status">
              {status}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

import { useState } from "react";
import Modal from "./Modal.jsx";
import "./AuthModal.css";

export default function AuthModal({ open, onClose, supabase, user }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (data.session) onClose();
        else setMessage("Check your email to confirm your account, then come back to sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onClose();
      }
    } catch (authError) {
      const message = authError.message || "Could not complete sign in. Please try again.";
      const hitEmailLimit = mode === "signup" &&
        (authError.code === "over_email_send_rate_limit" || /email rate limit exceeded/i.test(message));
      setError(hitEmailLimit
        ? "Supabase has temporarily limited confirmation emails for this project. Wait for the limit to reset, or configure a custom SMTP provider in Supabase → Authentication → SMTP Settings, then retry."
        : message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    const { error: authError } = await supabase.auth.signOut();
    setBusy(false);
    if (authError) setError(authError.message);
    else onClose();
  };

  return (
    <Modal open={open} onClose={onClose} panelClassName="auth-modal">
      <div className="auth-heading">
        <div>
          <p className="label-xs">your practice account</p>
          <h2 className="modal-title">{user ? "Your account" : "Keep your practice"}</h2>
        </div>
        <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {user ? (
        <div className="auth-account">
          <p className="auth-email">{user.email}</p>
          <p className="modal-text">Your finished sessions are saved privately to your account.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn-ghost auth-submit" onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : !supabase ? (
        <div className="auth-account">
          <p className="modal-text">
            Cloud history needs your Supabase project URL and publishable key. Add them to the app
            environment, then restart locally or redeploy on Vercel.
          </p>
          <button className="btn-ghost auth-submit" onClick={onClose}>Got it</button>
        </div>
      ) : (
        <>
          <p className="modal-text">Create an account to keep your topics and transcripts synced.</p>
          <div className="auth-tabs" role="tablist" aria-label="Account action">
            <button className={mode === "signin" ? "is-active" : ""} onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>
              Sign in
            </button>
            <button className={mode === "signup" ? "is-active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>
              Create account
            </button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="account-email">Email</label>
            <input id="account-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="account-password">Password</label>
            <input id="account-password" className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <p className="auth-privacy">Your transcript is saved only after you sign in. You can use Vocab Speak without an account.</p>
            {message && <p className="auth-message" role="status">{message}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn-amber auth-submit" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}

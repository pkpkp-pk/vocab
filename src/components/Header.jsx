import { useState } from "react";
import "./Header.css";

export default function Header({ onOpenCustomTopics, onOpenSettings, onHome, onOpenAccount, onOpenHistory, user, streak }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <button className="logo logo-home" type="button" onClick={onHome} aria-label="Vocab Speak home">
        <div className="logo-mark">V</div>
        <div className="logo-text">
          <p className="logo-name">Vocab Speak</p>
          <p className="logo-sub">spontaneous speaking practice</p>
        </div>
      </button>

      <div className="header-actions">
        {streak > 0 && (
          <div className="streak-badge">🔥 {streak} day streak</div>
        )}

        {user && <button className="header-text-btn" onClick={onOpenHistory}>History</button>}
        <button className="header-text-btn header-account-btn" onClick={onOpenAccount}>
          {user ? user.email : "Sign in"}
        </button>

        <div className="settings-menu-wrap">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Settings"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="icon-btn settings-gear-btn"
          >
            ⚙
          </button>
          {menuOpen && (
            <div className="settings-menu" role="menu">
              <button role="menuitem" onClick={() => { setMenuOpen(false); onOpenCustomTopics(); }}>
                Add your own topics
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); onOpenSettings(); }}>
                Gemini API key
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

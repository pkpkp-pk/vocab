import "./Header.css";

export default function Header({ onOpenCustomTopics, onHome, onOpenAccount, onOpenHistory, user, streak }) {
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

        <button onClick={onOpenCustomTopics} aria-label="Add your own topics" className="icon-btn">
          +
        </button>

      </div>
    </header>
  );
}

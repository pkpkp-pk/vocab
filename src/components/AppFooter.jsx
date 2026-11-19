import "./AppFooter.css";

export default function AppFooter({ onHome, onAddTopic, onOpenHistory, onOpenAccount }) {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-main">
        <div className="footer-brand-block">
          <button className="footer-brand" type="button" onClick={onHome} aria-label="Vocab Speak home">
            <span className="footer-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>vocab<span className="footer-brand-accent">speak</span></span>
          </button>
          <p className="footer-tagline">Find your words. Follow your thoughts. Speak a little more every day.</p>
          <p className="footer-privacy">Live microphone audio is streamed to Gemini for transcription.</p>
        </div>

        <nav className="footer-links" aria-label="Explore">
          <h2>Explore</h2>
          <button type="button" onClick={onHome}>Practice</button>
          <button type="button" onClick={onAddTopic}>Add a topic</button>
        </nav>

        <nav className="footer-links" aria-label="Your practice">
          <h2>Your practice</h2>
          <button type="button" onClick={onOpenHistory}>Session history</button>
          <button type="button" onClick={onOpenAccount}>Account</button>
        </nav>
      </div>

      <div className="app-footer-bottom">
        <p>© {year} Vocab Speak <span aria-hidden="true">·</span> Made for everyday fluency.</p>
        <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
      </div>
    </footer>
  );
}

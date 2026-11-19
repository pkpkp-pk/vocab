import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { deletePracticeSession, getPracticeSessions } from "../lib/sessionHistory.js";
import { formatDuration } from "../lib/analyzeSpeech.js";
import "./HistoryModal.css";

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function HistoryModal({ open, onClose, supabase, user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !supabase || !user) {
      setSessions([]);
      setError("");
      setLoading(false);
      return undefined;
    }
    let active = true;
    setSessions([]);
    setLoading(true);
    setError("");
    getPracticeSessions(supabase)
      .then((rows) => { if (active) setSessions(rows); })
      .catch((err) => { if (active) setError(err.message || "Could not load your history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, supabase, user]);

  const removeSession = async (id) => {
    setError("");
    try {
      await deletePracticeSession(supabase, id);
      setSessions((rows) => rows.filter((row) => row.id !== id));
    } catch (err) {
      setError(err.message || "Could not delete that session.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} panelClassName="history-modal">
      <div className="history-heading">
        <div>
          <p className="label-xs">your account</p>
          <h2 className="modal-title">Practice history</h2>
        </div>
        <button className="auth-close" onClick={onClose} aria-label="Close history">×</button>
      </div>
      <p className="modal-text">Your latest 100 saved sessions, newest first.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p className="history-empty">Loading your sessions…</p> : null}
      {!loading && !error && sessions.length === 0 && (
        <p className="history-empty">No saved sessions yet. Your next finished practice will appear here.</p>
      )}
      <div className="history-list">
        {sessions.map((session) => (
          <article className="history-item card card-dim" key={session.id}>
            <div className="history-item-head">
              <div>
                <h3>{session.topic_title}</h3>
                <p className="history-meta">
                  {formatDate(session.created_at)} · {formatDuration(session.duration_seconds)}
                  {session.topic_category ? ` · ${session.topic_category}` : ""}
                </p>
              </div>
              <button className="history-delete" onClick={() => removeSession(session.id)} aria-label={`Delete ${session.topic_title} session`}>
                Delete
              </button>
            </div>
            {session.topic_prompt && <p className="history-prompt">{session.topic_prompt}</p>}
            {session.transcript ? (
              <details className="history-transcript">
                <summary>View transcript</summary>
                <p>{session.transcript}</p>
              </details>
            ) : <p className="history-no-transcript">No transcript was captured.</p>}
          </article>
        ))}
      </div>
    </Modal>
  );
}

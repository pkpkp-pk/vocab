import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import "./SettingsModal.css";

export default function SettingsModal({ open, onClose, geminiApiKey, onSaveGeminiApiKey }) {
  const [draft, setDraft] = useState(geminiApiKey || "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(geminiApiKey || "");
      setSaved(false);
    }
  }, [open, geminiApiKey]);

  const save = (event) => {
    event.preventDefault();
    onSaveGeminiApiKey(draft.trim());
    setSaved(true);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="modal-title">Settings</h3>
      <form onSubmit={save} className="settings-key-form">
        <label className="label-xs" htmlFor="gemini-api-key">Your Gemini API key</label>
        <input
          id="gemini-api-key"
          type="password"
          autoComplete="off"
          spellCheck="false"
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }}
          placeholder="Paste your Gemini API key"
          className="input"
        />
        <p className="modal-text settings-key-note">
          Stored only in this browser. It is sent with your transcript for scoring and is not saved to your account. Leave blank to use the app’s configured key.
        </p>
        {saved && <p className="settings-saved" role="status">API key saved on this device.</p>}
        <div className="settings-actions">
          {geminiApiKey && <button type="button" className="btn-ghost" onClick={() => { setDraft(""); onSaveGeminiApiKey(""); setSaved(true); }}>Remove key</button>}
          <button type="submit" className="btn-primary">Save key</button>
        </div>
      </form>
    </Modal>
  );
}

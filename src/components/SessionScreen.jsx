import { useEffect, useRef, useState } from "react";
import TimerRing from "./TimerRing.jsx";
import KeywordHelper, { REVEAL_BATCH } from "./KeywordHelper.jsx";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useAudioAnalysis, checkMic } from "../hooks/useAudioAnalysis.js";
import "./SessionScreen.css";

// Verdict from the pre-session mic check numbers.
function micVerdict({ floorDb, peakDb, voicedPct }) {
  if (voicedPct < 0.05 && floorDb < -70) {
    return "No voice detected — check that the right input device is selected and unmuted.";
  }
  if (peakDb > -1) {
    return "Signal is clipping — move a little further from the mic or lower the input gain.";
  }
  if (floorDb > -35) {
    return `Noisy room (floor ${floorDb} dB) — analysis will use your measured noise floor, but quieter is better.`;
  }
  return `Mic sounds good (noise floor ${floorDb} dB).`;
}

// Human-readable copy for browser speech recognition errors.
function friendlySpeechError(code) {
  if (typeof code === "string" && code.startsWith("gemini-api:")) {
    return `Gemini rejected the live session setup (${code.slice("gemini-api:".length)}).`;
  }
  if (typeof code === "string" && code.startsWith("websocket-close:")) {
    return `Gemini closed the live connection (${code.slice("websocket-close:".length)}).`;
  }
  if (typeof code === "string" && /^(token-request-failed|token_request_failed):/.test(code)) {
    return `Gemini could not issue a transcription token (${code.slice(code.indexOf(":") + 1)}).`;
  }
  if (typeof code === "string" && code.startsWith("token_request_invalid:")) {
    return `Gemini rejected the token setup (${code.slice("token_request_invalid:".length)}).`;
  }
  switch (code) {
    case "sign-in-required":
    case "sign_in_required":
      return "Sign in to use Gemini transcription, then retry.";
    case "local-api-not-running":
      return "The local transcription API is not running. Restart npm run dev on port 5173, then retry.";
    case "local_api_failed":
      return "The local transcription API failed to start. Check the terminal running npm run dev.";
    case "auth_not_configured":
    case "supabase_unavailable":
      return "Your account service could not be reached. Check the Supabase setup and retry.";
    case "transcription_daily_limit":
      return "You've reached today's live transcription limit. Try again tomorrow.";
    case "transcription_quota_not_configured":
      return "Live transcription limits are not set up yet. Run the latest Supabase schema, then retry.";
    case "model_not_configured":
      return "Gemini transcription is not configured yet. Add GEMINI_API_KEY to Vercel and redeploy.";
    case "model_key_invalid":
      return "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel settings.";
    case "model_rate_limited":
      return "Gemini's token quota has been reached. Try again later or review the project quota.";
    case "token_request_invalid":
    case "token_request_failed":
    case "model-unavailable":
    case "connection-closed":
    case "websocket-error":
      return "Gemini transcription could not connect. Check your connection and retry.";
    case "audio-unavailable":
      return "Audio capture is unavailable. Check your microphone and browser permissions.";
    case "audio-context-blocked":
      return "Your browser blocked the live microphone stream. Tap retry, then allow audio when prompted.";
    case "microphone-audio-not-flowing":
      return "Gemini connected but no microphone audio reached it. Check the selected input device, then retry.";
    case "gemini-setup-timeout":
      return "Gemini did not complete the live connection. A browser extension, VPN, proxy, or network may be blocking secure WebSockets to Google.";
    default:
      return `Transcription error: ${code}.`;
  }
}

function transcriptionStatus(state) {
  switch (state) {
    case "requesting-token": return "connecting to Gemini…";
    case "connecting": return "opening live transcription…";
    case "ready-for-speech": return "Gemini is ready — start speaking.";
    case "receiving-audio": return "Gemini is receiving your microphone audio.";
    case "finishing": return "finishing your transcript…";
    default: return "listening…";
  }
}

export default function SessionScreen({ topic, targetSeconds, onFinish, onExit }) {
  const [elapsed, setElapsed] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [running, setRunning] = useState(false);
  // Mic check: null | {phase: "quiet"|"speak"} | {done, floorDb, peakDb, voicedPct} | {done, error}
  const [micCheck, setMicCheck] = useState(null);
  const [micLevel, setMicLevel] = useState(-60);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);
  const calibStreamRef = useRef(null);
  const micFloorRef = useRef(null);

  const speech = useSpeechRecognition();
  const audio = useAudioAnalysis();
  const t0Ref = useRef(0);
  const streamRef = useRef(null);

  useEffect(() => {
    if (running) {
      startedAtRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 200);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // If the user exits mid-session, stop any mic-check stream left open.
  useEffect(
    () => () => {
      calibStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const runMicCheck = async () => {
    if (micCheck && !micCheck.done) return; // already running
    // A re-check replaces the old stream.
    calibStreamRef.current?.getTracks().forEach((t) => t.stop());
    calibStreamRef.current = null;
    micFloorRef.current = null;
    try {
      setMicCheck({ phase: "quiet" });
      const res = await checkMic(
        (db) => setMicLevel(db),
        (phase) => setMicCheck({ phase })
      );
      calibStreamRef.current = res.stream;
      micFloorRef.current = res.floorDb;
      setMicCheck({ done: true, ...res });
    } catch {
      setMicCheck({ done: true, error: true });
    }
  };

  const beginSession = async () => {
    setRunning(true);
    // One shared clock for speech segments and audio samples — the waveform
    // alignment on the results screen depends on both using the same t0.
    const t0 = performance.now();

    // Acquire the mic FIRST: a single getUserMedia prompt settles the
    // permission, then the transcription engine starts cleanly. (Starting both
    // at once races the two requests and recognition can fail with
    // "not-allowed"/"audio-capture" while the prompt is still open.)
    // If the mic check already opened a stream, reuse it — no prompt at all.
    const stream = await audio.start(t0, { stream: calibStreamRef.current ?? undefined });
    calibStreamRef.current = null; // the hook owns it now (stopped at stop())
    t0Ref.current = t0;
    streamRef.current = stream; // kept for the error-retry path
    if (speech.supported && stream) speech.start(t0, stream);
  };

  const endSession = async () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    if (speech.supported) await speech.stop();
    streamRef.current = null;

    // Timestamped final segments for waveform alignment. If the user finishes
    // mid-thought, the trailing interim text isn't in any segment yet — append
    // it so the annotated transcript covers everything that was said.
    const speechSegments = speech.supported ? speech.getSegments().slice() : [];
    const joined = speechSegments.map((s) => s.text).join(" ").trim();
    const full = speech.supported ? speech.getFullTranscript() : speech.fullTranscript;
    const leftover = full.length > joined.length ? full.slice(joined.length).trim() : "";
    if (leftover) speechSegments.push({ text: leftover, endedAt: elapsed });

    onFinish({
        transcript: full,
        durationSeconds: elapsed,
        keywordsRevealed: revealedCount,
        audioSamples: audio.stop(),
        speechSegments,
        strippedFillers: speech.supported ? { ...speech.getStrippedFillers() } : {},
        // Measured noise floor from the mic check (null = adaptive fallback).
        micFloorDb: micFloorRef.current,
      });
  };

  const revealKeywords = () => setRevealedCount((c) => Math.min(c + REVEAL_BATCH, topic.keywords.length));

  return (
    <div className="session-screen">
      <div className="session-head">
        <p className="label-xs">your topic</p>
        <h2 className="session-title">{topic.title}</h2>
        <p className="session-prompt">{topic.prompt}</p>
      </div>

      <TimerRing elapsedSeconds={elapsed} targetSeconds={targetSeconds} listening={running} />

      {!running ? (
        <>
          <button onClick={beginSession} className="btn-primary session-start">
            {speech.supported ? "🎙️ Start talking" : "▶ Start timer"}
          </button>

          {audio.supported && (
            <div className="mic-check">
              {!micCheck && (
                <button onClick={runMicCheck} className="btn-ghost mic-check-btn">
                  check mic first
                </button>
              )}
              {micCheck && !micCheck.done && (
                <>
                  <div className="mic-meter-track">
                    <div
                      className="mic-meter-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, ((micLevel + 60) / 55) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mic-check-note">
                    {micCheck.phase === "quiet"
                      ? "stay quiet… measuring room noise"
                      : "now say something"}
                  </p>
                </>
              )}
              {micCheck?.done && !micCheck.error && (
                <>
                  <p className="mic-check-note">{micVerdict(micCheck)}</p>
                  <p className="mic-check-note">Level readings depend on your microphone and distance; this check is a rough calibration.</p>
                  <button onClick={runMicCheck} className="btn-ghost mic-check-btn">
                    re-check
                  </button>
                </>
              )}
              {micCheck?.error && (
                <p className="mic-check-note">
                  Mic blocked — allow access via the address-bar icon, or just start and the
                  browser will ask.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="session-running">
          {speech.supported && (
            <div className="transcript-live">
              <span className="transcript-final">{speech.finalTranscript}</span>
              <span className="transcript-interim">{speech.interimTranscript}</span>
              {!speech.error && !speech.finalTranscript && !speech.interimTranscript && (
                <span className="transcript-waiting">{transcriptionStatus(speech.connectionState)}</span>
              )}
              <span className="engine-badge">Browser speech recognition</span>
            </div>
          )}

          {speech.error && (
            <p className="session-error">
              {friendlySpeechError(speech.error)}{" "}
              <button
                className="session-error-retry"
                onClick={() => {
                  speech.prepare();
                  speech.start(t0Ref.current, streamRef.current);
                }}
              >
                retry
              </button>
            </p>
          )}

          <KeywordHelper keywords={topic.keywords} revealedCount={revealedCount} onReveal={revealKeywords} />

          <button onClick={endSession} className="btn-ghost session-finish">
            ■ Finish & see stats
          </button>
        </div>
      )}

      {!speech.supported && (
        <p className="session-note">
          This browser does not support speech recognition. The timer and keyword prompts still work here.
        </p>
      )}

      <button onClick={onExit} className="session-exit">
        exit session
      </button>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";

const MODEL = "gemini-3.5-transcribe-live";
const LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

function pcm16Base64(floatSamples, inputRate) {
  const outputRate = 16_000;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(floatSamples.length / ratio);
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < outputLength; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(Math.floor((i + 1) * ratio), floatSamples.length);
    let sum = 0;
    for (let j = from; j < to; j++) sum += floatSamples[j];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  const stride = 0x8000;
  for (let i = 0; i < bytes.length; i += stride) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + stride, bytes.length)));
  }
  return btoa(binary);
}

export function useSpeechRecognition() {
  const [supported] = useState(
    typeof window !== "undefined" &&
      typeof WebSocket !== "undefined" &&
      !!(window.AudioContext || window.webkitAudioContext) &&
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  );
  const [listening, setListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const gainRef = useRef(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const segmentsRef = useRef([]);
  const t0Ref = useRef(0);
  const activeRef = useRef(false);
  const drainTimerRef = useRef(null);

  const teardownAudio = useCallback(() => {
    if (processorRef.current) processorRef.current.onaudioprocess = null;
    try { processorRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { sourceRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { gainRef.current?.disconnect(); } catch { /* already disconnected */ }
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
  }, []);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }, []);

  useEffect(() => () => {
    activeRef.current = false;
    clearTimeout(drainTimerRef.current);
    teardownAudio();
    closeSocket();
  }, [closeSocket, teardownAudio]);

  const startAudio = useCallback((stream, socket) => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const context = new Ctx();
    contextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const gain = context.createGain();
    gain.gain.value = 0;
    sourceRef.current = source;
    processorRef.current = processor;
    gainRef.current = gain;
    processor.onaudioprocess = (event) => {
      if (!activeRef.current || socket.readyState !== WebSocket.OPEN) return;
      const data = pcm16Base64(event.inputBuffer.getChannelData(0), context.sampleRate);
      socket.send(JSON.stringify({
        realtimeInput: { audio: { data, mimeType: "audio/pcm;rate=16000" } },
      }));
    };
    source.connect(processor);
    processor.connect(gain);
    gain.connect(context.destination);
    context.resume().catch(() => {});
  }, []);

  const start = useCallback(async (startTime, stream) => {
    if (!supported || !stream) {
      setError("audio-unavailable");
      return;
    }
    clearTimeout(drainTimerRef.current);
    teardownAudio();
    closeSocket();
    activeRef.current = true;
    t0Ref.current = startTime ?? performance.now();
    finalRef.current = "";
    interimRef.current = "";
    segmentsRef.current = [];
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);

    try {
      const { data } = await supabase?.auth.getSession() ?? { data: null };
      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error("sign-in-required");

      const tokenResponse = await fetch("/api/transcription-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const credentials = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || !credentials?.token) {
        throw new Error(credentials?.error || "token-request-failed");
      }

      const socket = new WebSocket(`${LIVE_URL}?access_token=${encodeURIComponent(credentials.token)}`);
      socketRef.current = socket;
      socket.onopen = () => {
        if (!activeRef.current) return socket.close();
        socket.send(JSON.stringify({
          setup: {
            model: `models/${MODEL}`,
            generationConfig: { responseModalities: ["TEXT"] },
            inputAudioTranscription: { languageCodes: [], mode: "VERBATIM" },
          },
        }));
      };
      socket.onmessage = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.setupComplete) {
          try {
            startAudio(stream, socket);
            setListening(true);
          } catch {
            activeRef.current = false;
            setError("audio-unavailable");
            setListening(false);
            closeSocket();
          }
          return;
        }
        const content = message.serverContent;
        if (typeof content?.interimInputTranscription?.text === "string") {
          interimRef.current = content.interimInputTranscription.text;
          setInterimTranscript(interimRef.current);
        }
        if (typeof content?.inputTranscription?.text === "string") {
          const text = content.inputTranscription.text.trim();
          if (text) {
            finalRef.current = `${finalRef.current} ${text}`.trim();
            segmentsRef.current.push({
              text,
              endedAt: (performance.now() - t0Ref.current) / 1000,
            });
            setFinalTranscript(finalRef.current);
          }
          interimRef.current = "";
          setInterimTranscript("");
        }
      };
      socket.onerror = () => {
        if (!activeRef.current) return;
        activeRef.current = false;
        teardownAudio();
        setListening(false);
        setError("model-unavailable");
      };
      socket.onclose = () => {
        if (!activeRef.current) return;
        activeRef.current = false;
        teardownAudio();
        setListening(false);
        setError("connection-closed");
      };
    } catch (err) {
      activeRef.current = false;
      teardownAudio();
      closeSocket();
      setListening(false);
      setError(err?.message || "model-unavailable");
    }
  }, [closeSocket, startAudio, supported, teardownAudio]);

  const stop = useCallback(() => {
    activeRef.current = false;
    teardownAudio();
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = setTimeout(() => {
        closeSocket();
        setListening(false);
      }, 900);
    } else {
      closeSocket();
      setListening(false);
    }
    return new Promise((resolve) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return resolve();
      const timer = setTimeout(resolve, 1100);
      const previous = socket.onmessage;
      socket.onmessage = (event) => {
        previous?.(event);
        let message;
        try { message = JSON.parse(event.data || "{}"); } catch { return; }
        if (message?.serverContent?.turnComplete) {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  }, [closeSocket, teardownAudio]);

  const reset = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    segmentsRef.current = [];
    setFinalTranscript("");
    setInterimTranscript("");
  }, []);

  const getSegments = useCallback(() => segmentsRef.current, []);
  const getStrippedFillers = useCallback(() => ({}), []);
  const getFullTranscript = useCallback(
    () => `${finalRef.current} ${interimRef.current}`.trim(),
    []
  );

  return {
    supported,
    listening,
    finalTranscript,
    interimTranscript,
    fullTranscript: (finalTranscript + " " + interimTranscript).trim(),
    error,
    start,
    stop,
    reset,
    getSegments,
    getStrippedFillers,
    getFullTranscript,
  };
}

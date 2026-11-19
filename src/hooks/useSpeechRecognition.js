import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechRecognition() {
  const [supported] = useState(
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const segmentsRef = useRef([]);
  const startedAtRef = useRef(0);

  const start = useCallback((startTime) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    startedAtRef.current = startTime ?? performance.now();
    segmentsRef.current = [];
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript?.trim();
        if (!text) continue;
        if (item.isFinal) {
          segmentsRef.current.push({
            text,
            endedAt: (performance.now() - startedAtRef.current) / 1000,
          });
          setFinalTranscript(segmentsRef.current.map((part) => part.text).join(" "));
        } else interim += `${text} `;
      }
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") setError(event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("recognition-start-failed");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    return Promise.resolve();
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const reset = useCallback(() => {
    segmentsRef.current = [];
    setFinalTranscript("");
    setInterimTranscript("");
  }, []);
  const getSegments = useCallback(() => segmentsRef.current, []);
  const getStrippedFillers = useCallback(() => ({}), []);
  const getFullTranscript = useCallback(() => `${finalTranscript} ${interimTranscript}`.trim(), [finalTranscript, interimTranscript]);

  return {
    supported, listening, finalTranscript, interimTranscript,
    fullTranscript: `${finalTranscript} ${interimTranscript}`.trim(),
    error, connectionState: listening ? "receiving-audio" : "idle",
    prepare: () => {}, start, stop, reset, getSegments, getStrippedFillers, getFullTranscript,
  };
}

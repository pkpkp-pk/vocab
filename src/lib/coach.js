const ERROR_MESSAGES = {
  sign_in_required: "Sign in to get AI feedback for this session.",
  model_not_configured: "AI feedback is not configured yet. Add GEMINI_API_KEY to Vercel and redeploy.",
  supabase_server_config_missing: "The coaching service cannot verify your account. Check the Supabase Vercel integration settings.",
  supabase_unavailable: "Supabase could not verify your account right now. Try again shortly.",
  coaching_quota_not_configured: "Update the Supabase schema to enable the coaching request limit, then try again.",
  invalid_session_details: "The selected topic or difficulty could not be sent. Try again.",
  daily_limit_reached: "You have used today's 5 AI feedback requests. Try again tomorrow.",
  model_rate_limited: "Gemini is busy or its request quota has been reached. Try again later.",
  model_key_invalid: "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel settings.",
  transcript_too_long: "This transcript is too long to score in one request.",
  model_unavailable: "Gemini could not be reached. Try again in a moment.",
};

export async function evaluateTranscript({ supabase, transcript, topic, topicPrompt, difficulty, geminiApiKey }) {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error || !accessToken) throw new Error(ERROR_MESSAGES.sign_in_required);

  let response;
  try {
    response = await fetch("/api/evaluate-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(geminiApiKey ? { "X-Gemini-Api-Key": geminiApiKey } : {}),
      },
      body: JSON.stringify({ transcript, topic, topicPrompt, difficulty }),
    });
  } catch {
    throw new Error("Could not reach the coaching function. On your computer, run the project with Vercel Dev to use its API route.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(ERROR_MESSAGES[payload.error] || "AI feedback could not be created. Try again later.");
  }
  if (!Number.isFinite(payload.score) || !Array.isArray(payload.suggestions)) {
    throw new Error("Gemini returned an incomplete evaluation. Try again.");
  }
  return {
    score: Math.max(0, Math.min(100, Math.round(payload.score))),
    suggestions: payload.suggestions.filter((item) => typeof item === "string").slice(0, 3),
  };
}

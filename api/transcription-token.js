import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-3.5-transcribe-live";

function reply(res, status, payload) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "method_not_allowed" });
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return reply(res, 401, { error: "sign_in_required" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!supabaseUrl || !supabaseKey) return reply(res, 503, { error: "auth_not_configured" });
  if (!geminiKey) return reply(res, 503, { error: "model_not_configured" });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  let user;
  try {
    ({ data: { user } } = await supabase.auth.getUser(token));
  } catch {
    return reply(res, 503, { error: "supabase_unavailable" });
  }
  if (!user) return reply(res, 401, { error: "sign_in_required" });

  let quota;
  let quotaError;
  try {
    ({ data: quota, error: quotaError } = await supabase.rpc("claim_gemini_transcription_token"));
  } catch {
    return reply(res, 503, { error: "transcription_quota_not_configured" });
  }
  if (quotaError) return reply(res, 503, { error: "transcription_quota_not_configured" });
  if (quota === false) return reply(res, 429, { error: "transcription_daily_limit" });
  if (quota !== true) return reply(res, 503, { error: "transcription_quota_not_configured" });

  let providerResponse;
  try {
    const now = Date.now();
    providerResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 20 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: `models/${MODEL}`,
          config: {
            responseModalities: ["TEXT"],
            inputAudioTranscription: { languageCodes: [], mode: "VERBATIM" },
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return reply(res, 502, { error: "model_unavailable" });
  }

  if (!providerResponse.ok) {
    const errorPayload = await providerResponse.json().catch(() => null);
    const detail = String(errorPayload?.error?.message || "").slice(0, 180);
    return reply(res, 502, {
      error: providerResponse.status === 401 || providerResponse.status === 403
        ? "model_key_invalid"
        : "token_request_failed",
      ...(detail ? { detail } : {}),
    });
  }
  const payload = await providerResponse.json().catch(() => null);
  if (!payload?.name) return reply(res, 502, { error: "token_request_failed" });
  return reply(res, 200, { token: payload.name, model: MODEL });
}

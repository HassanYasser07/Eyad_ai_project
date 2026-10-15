import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearer(req: Request) {
  const value = req.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = getBearer(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !publishableKey) return json({ error: "BACKEND_AUTH_CONFIG_ERROR" }, 500);
  if (!openAiKey) return json({ error: "OPENAI_API_KEY_MISSING" }, 503);

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "INVALID_SESSION" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }

  const audioBase64 = String(body?.audio_base64 || "");
  if (!audioBase64) return json({ error: "AUDIO_REQUIRED" }, 400);
  if (audioBase64.length > 14_000_000) return json({ error: "AUDIO_TOO_LARGE", max_base64_chars: 14000000 }, 413);

  const mimeType = String(body?.mime_type || "audio/webm").split(";")[0].trim() || "audio/webm";
  const extension = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("wav") ? "wav"
    : mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3"
    : "webm";

  let binary = "";
  try { binary = atob(audioBase64); } catch { return json({ error: "INVALID_AUDIO_BASE64" }, 400); }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], `eyad-recording.${extension}`, { type: mimeType });

  const form = new FormData();
  form.append("file", file);
  form.append("response_format", "json");
  if (body?.language === "ar" || body?.language === "en") form.append("language", body.language);
  // NOTE: The `prompt` field was intentionally removed. Sending instructional
  // text ("Transcribe the user's Arabic speech accurately…") in the prompt
  // parameter caused the model to echo those instructions or produce garbled
  // output instead of the actual speech. Do NOT re-add it.

  // Try the current OpenAI transcribe model first. If this Project does not
  // have that model enabled, fall back automatically to Whisper instead of
  // showing the provider-access error to the user.
  const models = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"];
  let lastError = null;
  for (const model of models) {
    const requestForm = new FormData();
    for (const [key, value] of form.entries()) requestForm.append(key, value);
    requestForm.set("model", model);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: requestForm,
    });

    if (!response.ok) {
      const raw = await response.text();
      let detail = raw.slice(0, 700);
      try { detail = JSON.parse(raw)?.error?.message || detail; } catch {}
      lastError = { status: response.status, detail };
      if (response.status === 401 || response.status === 429) break;
      continue;
    }

    const result = await response.json();
    const text = String(result?.text || "").trim();
    if (!text) {
      lastError = { status: 422, detail: "TRANSCRIPT_EMPTY" };
      continue;
    }
    return json({ ok: true, text, model });
  }

  return json({
    error: "OPENAI_TRANSCRIBE_ERROR",
    status: lastError?.status || 502,
    detail: lastError?.detail || "No transcription model is available for this Project.",
  }, 502);
});
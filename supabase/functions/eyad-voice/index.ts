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

  const text = String(body?.text || "").trim();
  if (!text) return json({ error: "VOICE_TEXT_REQUIRED" }, 400);

  const language = body?.language === "en" ? "en" : "ar";
  const voice = String(body?.voice || "alloy");
  const speed = Number.isFinite(body?.speed) ? Math.min(4, Math.max(0.25, body.speed)) : 1.0;
  const instructions = String(body?.instructions || "").slice(0, 1024);
  const wantStream = Boolean(body?.stream);

  const ttsBody: Record<string, unknown> = {
    model: "gpt-4o-mini-tts",
    input: text.slice(0, 4096),
    voice,
    response_format: "mp3",
    speed,
  };
  if (instructions) ttsBody.instructions = instructions;

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ttsBody),
    });

    if (!openaiResponse.ok) {
      const raw = await openaiResponse.text();
      let detail = raw.slice(0, 700);
      try { detail = JSON.parse(raw)?.error?.message || detail; } catch {}
      console.error("[eyad-voice] OpenAI TTS failed", {
        status: openaiResponse.status,
        detail,
        textLength: text.length,
        language,
        voice,
        hasInstructions: Boolean(instructions),
      });
      return json({
        error: "OPENAI_TTS_ERROR",
        status: openaiResponse.status,
        detail,
      }, 502);
    }

    // Non-streaming: return base64 mp3 so the browser can decode via AudioContext.
    if (!wantStream) {
      const audioBytes = new Uint8Array(await openaiResponse.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < audioBytes.length; i += chunkSize) {
        binary += String.fromCharCode(...audioBytes.subarray(i, i + chunkSize));
      }
      const audioBase64 = btoa(binary);
      return json({ ok: true, audio: audioBase64, format: "mp3", language, voice });
    }

    // Streaming: pass the mp3 stream through directly.
    return new Response(openaiResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[eyad-voice] unexpected error", {
      name: error?.name,
      message: error?.message,
      textLength: text.length,
      language,
    });
    return json({
      error: "OPENAI_TTS_ERROR",
      status: 502,
      detail: String(error?.message || "Unexpected TTS failure"),
    }, 502);
  }
});
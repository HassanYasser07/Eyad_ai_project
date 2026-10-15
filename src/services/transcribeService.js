import { supabase } from "@/lib/supabase";

export async function transcribeEyadAudio({ audioBase64, mimeType, language = "ar", durationMs }) {
  if (!audioBase64) throw new Error("AUDIO_REQUIRED");

  let { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData?.session?.access_token;

  // Guest-first fallback: create an anonymous session if none exists yet,
  // matching the same pattern used by the EYAD engine service.
  if (!accessToken) {
    const { data: anonymousData, error: anonymousError } =
      await supabase.auth.signInAnonymously();
    if (anonymousError || !anonymousData?.session?.access_token) {
      throw new Error("AUTH_LOGIN_REQUIRED");
    }
    accessToken = anonymousData.session.access_token;
  }

  const { data, error } = await supabase.functions.invoke("eyad-transcribe", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      audio_base64: audioBase64,
      mime_type: mimeType || "audio/webm",
      language,
      duration_ms: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
    },
  });

  if (error) {
    let detail = error.message || "EYAD_TRANSCRIBE_FAILED";
    try {
      const body = await error.context?.json?.();
      detail = body?.detail || body?.error || detail;
    } catch {}
    throw new Error(detail);
  }

  if (!data?.text) throw new Error("TRANSCRIPT_EMPTY");
  return data;
}

export default transcribeEyadAudio;
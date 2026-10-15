import { supabase, SUPABASE_URL } from "@/lib/supabase";

const EGYPTIAN_MARKERS = [
  "عايز","عاوز","إيه","ليه","كده","دلوقتي","لسه","مش","مفيش","أهو","بص","شوف","خلاص","تمام يا","ازاي","إزاي","بتاع","بتاعت","احنا","إحنا","عشان","علشان","هعمل","نعمل"
];

const GULF_MARKERS = [
  "أبغى","ابغى","أبي","ابي","وش","شلون","الحين","الحين","الحين","مو","مب","ما أبي","أبيك","أبغاك","خلنا","خلّنا","زين","حلو","مره","مرة","هلا","يعطيك العافية","مشكور","الله يعطيك العافية","عطني","سوّي","سوي","تسوي","تقدر"
];

function countMarkers(text, markers) {
  const value = String(text || "");
  return markers.reduce((count, marker) => count + (value.includes(marker) ? 1 : 0), 0);
}

export function detectArabicDialect(text = "") {
  const egyptian = countMarkers(text, EGYPTIAN_MARKERS);
  const gulf = countMarkers(text, GULF_MARKERS);
  if (egyptian === 0 && gulf === 0) return "neutral";
  return gulf > egyptian ? "gulf" : "egyptian";
}

export function detectVoiceEmotion(text = "") {
  const value = String(text || "").toLowerCase();
  if (/[!！]/.test(value) || /(ممتاز|رائع|جميل جدًا|حلو جدًا|أبدعت|مبروك|مبروك عليك|great|excellent|amazing|perfect|congrat)/i.test(value)) {
    return "positive and excited";
  }
  if (/(آسف|عذر|للأسف|مشكلة|خطأ|ما قدرت|تعذر|sorry|unfortunately|issue|error|couldn't)/i.test(value)) {
    return "empathetic and reassuring";
  }
  if (/(ممكن|هل|تقدر|وش رايك|إيش رأيك|what do you think|can you|would you)/i.test(value)) {
    return "curious and conversational";
  }
  if (/(فكرة|اقتراح|تصميم|شعار|هوية|إبداع|creative|idea|design|logo|brand)/i.test(value)) {
    return "inspired and confident";
  }
  return "calm, warm and confident";
}

export function buildEyadVoiceInstructions({ text = "", language = "ar", userSpeech = "" } = {}) {
  if (language === "en") {
    return "Speak as EYAD, a premium creative assistant. Natural conversational English, warm and confident. Match the emotional meaning of the sentence naturally. Use subtle human emphasis and pauses; do not sound like an announcer or a voice-over.";
  }

  const dialect = detectArabicDialect(userSpeech);
  const emotion = detectVoiceEmotion(text);

  const dialectRule = dialect === "egyptian"
    ? "Use Egyptian Arabic pronunciation and phrasing consistently for the entire response. Do not switch to Gulf, Levantine, or Modern Standard Arabic pronunciation unless a technical/proper name requires it."
    : dialect === "gulf"
      ? "Use Gulf Arabic pronunciation and phrasing consistently for the entire response. Keep it natural and broadly Gulf-friendly; do not switch to Egyptian, Levantine, or formal MSA pronunciation."
      : "Use natural neutral Arabic with a light Gulf-friendly pronunciation. Do not force a regional dialect when the user's dialect is unclear.";

  return [
    "Speak as EYAD, a premium creative assistant.",
    dialectRule,
    `Emotional direction: ${emotion}.`,
    "Let the emotion be heard through natural pitch, rhythm, emphasis and short pauses, without exaggeration or theatrical acting.",
    "Sound human, warm and conversational, not like an announcer.",
    "Keep the exact words unchanged. Do not add, remove, translate, or paraphrase the sentence.",
  ].join(" ");
}

/** @param {{text?: string, language?: string, voice?: string, speed?: number, instructions?: string}} options */
export async function synthesizeEyadVoice({
  text,
  language = "ar",
  voice = "marin",
  speed = 1.15,
  instructions = "",
} = {}) {
  const value = String(text || "").trim();
  if (!value) throw new Error("VOICE_TEXT_REQUIRED");

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("AUTH_SESSION_MISSING");

  const { data, error } = await supabase.functions.invoke("eyad-voice", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      text: value.slice(0, 4096),
      language: language === "en" ? "en" : "ar",
      voice,
      speed,
      instructions,
    },
  });

  if (error) {
    let detail = error.message || "EYAD_VOICE_FAILED";
    try {
      const context = error.context;
      if (context?.json) {
        const payload = await context.clone().json();
        detail = payload?.detail || payload?.error || payload?.message || detail;
      }
    } catch {}
    throw new Error(detail);
  }

  if (data?.error) throw new Error(data.detail || data.error);
  if (!data?.audio) throw new Error("VOICE_AUDIO_MISSING");
  return data;
}

/** @param {{text?: string, language?: string, voice?: string, speed?: number, instructions?: string}} options */
export async function streamEyadVoice({
  text, language = "ar", voice = "alloy", speed = 1.25, instructions = "",
} = {}) {
  const value = String(text || "").trim();
  if (!value) throw new Error("VOICE_TEXT_REQUIRED");
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("AUTH_SESSION_MISSING");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/eyad-voice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: value.slice(0, 4096), language: language === "en" ? "en" : "ar", voice, speed, instructions, stream: true }),
  });
  if (!response.ok || !response.body) {
    let detail = `VOICE_STREAM_FAILED_${response.status}`;
    try { const payload = await response.clone().json(); detail = payload?.detail || payload?.error || detail; } catch {}
    throw new Error(detail);
  }
  return response;
}

export default synthesizeEyadVoice;

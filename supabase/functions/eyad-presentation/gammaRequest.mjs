/**
 * Pure logic (no network, no Deno APIs) that converts the Eyad presentation form
 * into a request body for Gamma's Generate API.
 *
 * The form now has exactly these inputs (see src/pages/PresentationsStudio.jsx):
 *   topic text, optional attached file (its extracted text), detail level ("Standard" menu),
 *   pages, language, and an optional template picked from the Supabase templates gallery.
 *
 * Two Gamma endpoints are produced:
 *   POST /v1.0/generations                -> normal generation
 *       inputText, textMode, format, themeId, numCards, cardSplit,
 *       additionalInstructions, textOptions{amount, language}, cardOptions{dimensions}
 *   POST /v1.0/generations/from-template  -> when the chosen template has a Gamma template (gammaId)
 *       gammaId, prompt, themeId
 * Source: https://developers.gamma.app/docs/generate-api-parameters-explained
 *
 * Kept as .mjs so the same file is used by the Edge Function (Deno) and by the
 * Node test-suite.
 */

export const GAMMA_LIMITS = {
  inputTextMax: 100000, // Gamma: ~100k tokens; we cap characters far below that
  additionalInstructionsMax: 5000, // Gamma: 1-5000 chars
};

export const FORM_LIMITS = {
  topicMax: 50000,
  fileTextMax: 50000,
  fileNameMax: 200,
};

export const SLIDE_COUNTS = [5, 10, 15, 20, 25, 30];
// UI "Standard" menu -> Gamma textOptions.amount
export const DETAIL_LEVELS = { brief: "brief", standard: "medium", detailed: "detailed", extensive: "extensive" };
export const DEFAULT_DETAIL = "standard";

/* ------------------------------ language ------------------------------ */

// Output-language keys documented by Gamma (textOptions.language).
const GAMMA_LANGUAGES = {
  af: "Afrikaans", sq: "Albanian", ar: "Arabic", "ar-sa": "Arabic (Saudi Arabia)", bn: "Bengali",
  bs: "Bosnian", bg: "Bulgarian", ca: "Catalan", hr: "Croatian", cs: "Czech", da: "Danish",
  nl: "Dutch", "en-in": "English (India)", "en-gb": "English (UK)", en: "English (US)",
  et: "Estonian", fi: "Finnish", fr: "French", de: "German", el: "Greek", gu: "Gujarati",
  ha: "Hausa", he: "Hebrew", hi: "Hindi", hu: "Hungarian", is: "Icelandic", id: "Indonesian",
  it: "Italian", ja: "Japanese", "ja-da": "Japanese (da/dearu)", kn: "Kannada", kk: "Kazakh",
  ko: "Korean", lv: "Latvian", lt: "Lithuanian", mk: "Macedonian", ms: "Malay", ml: "Malayalam",
  mr: "Marathi", nb: "Norwegian", fa: "Persian", pl: "Polish", "pt-br": "Portuguese (Brazil)",
  "pt-pt": "Portuguese (Portugal)", ro: "Romanian", ru: "Russian", sr: "Serbian",
  "zh-cn": "Simplified Chinese", sl: "Slovenian", es: "Spanish", "es-419": "Spanish (Latin America)",
  "es-mx": "Spanish (Mexico)", "es-es": "Spanish (Spain)", sw: "Swahili", sv: "Swedish",
  tl: "Tagalog", ta: "Tamil", te: "Telugu", th: "Thai", "zh-tw": "Traditional Chinese",
  tr: "Turkish", uk: "Ukrainian", ur: "Urdu", uz: "Uzbek", vi: "Vietnamese", cy: "Welsh", yo: "Yoruba",
};

// Extra aliases (English short names + Arabic names) -> Gamma key.
const LANGUAGE_ALIASES = {
  english: "en", arabic: "ar", french: "fr", german: "de", spanish: "es", italian: "it",
  portuguese: "pt-br", chinese: "zh-cn", mandarin: "zh-cn", japanese: "ja", korean: "ko",
  turkish: "tr", russian: "ru", hindi: "hi", urdu: "ur", persian: "fa", farsi: "fa",
  hebrew: "he", dutch: "nl", greek: "el", polish: "pl", swedish: "sv", norwegian: "nb",
  indonesian: "id", thai: "th", vietnamese: "vi", ukrainian: "uk", romanian: "ro",
  czech: "cs", danish: "da", finnish: "fi", hungarian: "hu", bengali: "bn", swahili: "sw",
  "الانجليزيه": "en", "الانجليزية": "en", "الانكليزيه": "en", "العربيه": "ar", "الفرنسيه": "fr",
  "الالمانيه": "de", "الاسبانيه": "es", "الايطاليه": "it", "البرتغاليه": "pt-br",
  "الصينيه": "zh-cn", "اليابانيه": "ja", "الكوريه": "ko", "التركيه": "tr", "الروسيه": "ru",
  "الهنديه": "hi", "الاورديه": "ur", "الاردو": "ur", "الفارسيه": "fa", "العبريه": "he",
  "الهولنديه": "nl", "اليونانيه": "el", "البولنديه": "pl", "السويديه": "sv",
  "الاندونيسيه": "id", "التايلانديه": "th", "الفيتناميه": "vi", "الاوكرانيه": "uk",
  "الرومانيه": "ro", "التشيكيه": "cs", "الدنماركيه": "da", "الفنلنديه": "fi", "المجريه": "hu",
  "البنغاليه": "bn", "السواحيليه": "sw",
};

function normalizeLanguageName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // Arabic diacritics + tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

/** Returns a Gamma `textOptions.language` key, or null when the name is not supported. */
export function resolveLanguageCode(input) {
  const normalized = normalizeLanguageName(input);
  if (!normalized) return null;
  if (Object.prototype.hasOwnProperty.call(GAMMA_LANGUAGES, normalized)) return normalized;
  for (const [code, name] of Object.entries(GAMMA_LANGUAGES)) {
    if (normalizeLanguageName(name) === normalized) return code;
  }
  if (Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, normalized)) return LANGUAGE_ALIASES[normalized];
  return null;
}


/* ------------------------- automatic language detection ------------------------- */

const SCRIPT_RULES = [
  ["ar", /[؀-ۿݐ-ݿ]/g],
  ["he", /[֐-׿]/g],
  ["ru", /[Ѐ-ӿ]/g],
  ["ko", /[가-힯]/g],
  ["ja", /[぀-ヿ]/g],
  ["zh-cn", /[一-鿿]/g],
  ["th", /[฀-๿]/g],
  ["hi", /[ऀ-ॿ]/g],
];

/** Language key for the dominant non-Latin script of `text`, or null (Latin / unknown). */
export function detectLanguageCode(text) {
  const sample = String(text || "").slice(0, 4000);
  const letters = sample.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters.length) return null;
  let best = null;
  let bestCount = 0;
  for (const [code, pattern] of SCRIPT_RULES) {
    const count = (sample.match(pattern) || []).length;
    if (count > bestCount) { best = code; bestCount = count; }
  }
  return bestCount / letters.length >= 0.3 ? best : null;
}

/* ------------------------------- builder ------------------------------- */

function asString(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** The text sent to Gamma: the topic, then the attached file's text (clearly delimited). */
export function composeInputText({ topic, fileText, fileName }) {
  const parts = [];
  if (topic) parts.push(topic);
  if (fileText) parts.push(`--- Source material from the attached file${fileName ? ` "${fileName}"` : ""} ---\n${fileText}`);
  return parts.join("\n\n").slice(0, GAMMA_LIMITS.inputTextMax);
}

/*
 * input:   topic, fileText?, fileName?, detail, slideCount, language
 * options: template - optional row loaded server-side from presentation_templates:
 *            { gamma_template_id?, gamma_theme_id?, style_prompt?, slide_count? }
 * returns: { ok: true, endpoint, request, meta } or { ok: false, errors } keyed by form field
 */
export function buildGammaRequest(input, options = {}) {
  const errors = {};
  const topic = asString(input?.topic).trim();
  const fileText = asString(input?.fileText).trim();
  const fileName = asString(input?.fileName).replace(/[\r\n]+/g, " ").trim();
  const detailInput = asString(input?.detail || DEFAULT_DETAIL).trim();
  const slideCountInput = asString(input?.slideCount || "auto").trim();
  const languageInput = asString(input?.language || "auto").trim();
  const template = options?.template || null;

  if (!topic && !fileText) errors.topic = "REQUIRED";
  if (topic.length > FORM_LIMITS.topicMax) errors.topic = "TOO_LONG";
  if (fileText.length > FORM_LIMITS.fileTextMax) errors.file = "TOO_LONG";
  if (fileName.length > FORM_LIMITS.fileNameMax) errors.file = "INVALID";

  if (!Object.prototype.hasOwnProperty.call(DETAIL_LEVELS, detailInput)) errors.detail = "INVALID";

  let numCards = null;
  if (slideCountInput !== "auto") {
    const n = Number(slideCountInput);
    if (!SLIDE_COUNTS.includes(n)) errors.slideCount = "INVALID";
    else numCards = n;
  }

  let languageCode = null;
  let languageSource = "user";
  if (languageInput === "auto") {
    languageCode = detectLanguageCode(`${topic}\n${fileText}`);
    languageSource = languageCode ? "detected" : "same-as-input";
  } else {
    languageCode = resolveLanguageCode(languageInput);
    if (!languageCode) errors.language = "UNSUPPORTED_LANGUAGE";
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const inputText = composeInputText({ topic, fileText, fileName });
  const languageNote = languageCode
    ? `Write the whole presentation in ${GAMMA_LANGUAGES[languageCode]}.`
    : "Write the whole presentation in the same language as the user's input text.";
  const stylePrompt = asString(template?.style_prompt).trim();
  const themeId = asString(template?.gamma_theme_id).trim();
  const gammaTemplateId = asString(template?.gamma_template_id).trim();

  const meta = {
    detail: detailInput,
    languageCode,
    languageSource,
    slideCount: numCards || "auto",
    // "auto" is not a Gamma value: numCards is omitted and Gamma applies its own default (10).
    slideCountNote: numCards ? "explicit" : gammaTemplateId ? "template" : "gamma-default",
    hasFile: Boolean(fileText),
    templateId: template?.id || null,
    templateMode: gammaTemplateId ? "gamma-template" : template ? "theme-or-style" : "none",
    themeIdUsed: themeId || null,
  };

  /* ---- template with a Gamma template: create-from-template endpoint ---- */
  if (gammaTemplateId) {
    const hints = [languageNote];
    if (numCards) hints.push(`Aim for about ${numCards} slides.`);
    hints.push(`Level of detail: ${detailInput}.`);
    if (stylePrompt) hints.push(stylePrompt);
    const prompt = `${inputText}\n\n${hints.join(" ")}`.slice(0, GAMMA_LIMITS.inputTextMax);
    const request = { gammaId: gammaTemplateId, prompt };
    if (themeId) request.themeId = themeId;
    return { ok: true, endpoint: "/generations/from-template", request, meta };
  }

  /* ---- normal generation ---- */
  const instructionParts = [languageNote];
  if (stylePrompt) instructionParts.push(`Design direction: ${stylePrompt}`);
  const textOptions = { amount: DETAIL_LEVELS[detailInput] };
  if (languageCode) textOptions.language = languageCode;

  const request = {
    inputText,
    textMode: "generate",
    format: "presentation",
    additionalInstructions: instructionParts.join("\n\n").slice(0, GAMMA_LIMITS.additionalInstructionsMax),
    textOptions,
    cardOptions: { dimensions: "16x9" },
  };
  if (numCards) { request.numCards = numCards; request.cardSplit = "auto"; }
  if (themeId) request.themeId = themeId;
  return { ok: true, endpoint: "/generations", request, meta };
}

/** Same request without the themeId (used for a single retry if Gamma rejects the theme). */
export function withoutTheme(request) {
  const next = { ...request };
  delete next.themeId;
  return next;
}

/* ------------------------- Gamma response helpers ------------------------- */

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Normalizes GET /v1.0/generations/{id} into a small, safe shape. */
export function normalizeGammaStatus(body) {
  const status = body?.status === "completed" ? "completed" : body?.status === "failed" ? "failed" : "pending";
  const gammaUrl = status === "completed" ? safeHttpsUrl(body?.gammaUrl) : null;
  const exportUrl = status === "completed" ? safeHttpsUrl(body?.exportUrl) : null;
  const errorMessage = status === "failed"
    ? String(body?.error?.message || (typeof body?.error === "string" ? body.error : "") || "Gamma could not finish this presentation.").slice(0, 400)
    : null;
  // A "completed" response without a usable link is NOT treated as success.
  if (status === "completed" && !gammaUrl) {
    return { status: "failed", gammaUrl: null, exportUrl: null, errorMessage: "Gamma reported completion but returned no presentation link." };
  }
  return { status, gammaUrl, exportUrl, errorMessage };
}

/** Maps a Gamma HTTP error status to a stable app error code (never echoes secrets). */
export function mapGammaHttpError(status) {
  if (status === 401 || status === 403) return { code: "GAMMA_AUTH_FAILED", http: 502 };
  if (status === 400 || status === 422) return { code: "GAMMA_REJECTED_REQUEST", http: 422 };
  if (status === 402) return { code: "GAMMA_CREDITS_EXHAUSTED", http: 503 };
  if (status === 429) return { code: "GAMMA_RATE_LIMITED", http: 429 };
  return { code: "GAMMA_UNAVAILABLE", http: 502 };
}

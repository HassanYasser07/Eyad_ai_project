/**
 * Pure logic (no network, no Deno APIs) that converts the Eyad presentation form
 * into a request body for Gamma's Generate API: POST /v1.0/generations.
 *
 * Only parameters documented by Gamma are produced:
 *   inputText, textMode, format, themeId, numCards, cardSplit,
 *   additionalInstructions, textOptions{tone, audience, language}, cardOptions{dimensions}
 * Source: https://developers.gamma.app/docs/generate-api-parameters-explained
 *
 * Kept as .mjs so the same file is used by the Edge Function (Deno) and by the
 * Node test-suite.
 */

export const GAMMA_LIMITS = {
  inputTextMax: 100000, // Gamma: ~100k tokens; the form is far smaller
  additionalInstructionsMax: 5000, // Gamma: 1-5000 chars
  toneMax: 500,
  audienceMax: 500,
};

export const FORM_LIMITS = {
  topicMax: 6000,
  customAudienceMax: 300,
  otherLanguageMax: 60,
  userInstructionsMax: 2000,
};

export const SLIDE_COUNTS = [5, 10, 15, 20];
const HEX = /^#[0-9A-Fa-f]{6}$/;

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

/* --------------------------- purpose / audience --------------------------- */

const PURPOSE_META = {
  educational: { label: "educational", tone: "clear, educational, engaging", audience: "students" },
  business_proposal: { label: "business proposal", tone: "professional, persuasive, confident", audience: "executives and decision makers" },
  business_report: { label: "business report", tone: "professional, analytical, concise", audience: "executives and senior managers" },
  pitch_deck: { label: "investor pitch deck", tone: "persuasive, confident, inspiring", audience: "investors" },
  marketing: { label: "marketing presentation", tone: "energetic, persuasive, creative", audience: "general audience and potential customers" },
  training: { label: "training session", tone: "practical, friendly, instructive", audience: "professionals and trainees" },
  research: { label: "academic / scientific research presentation", tone: "academic, precise, objective", audience: "academics and specialists" },
  other: { label: "general presentation", tone: "professional, clear", audience: "general audience" },
};

const AUDIENCE_LABELS = {
  students: "students",
  beginners: "beginners with no prior knowledge",
  professionals: "professionals and specialists",
  executives: "executives and senior managers",
  investors: "investors",
  general: "general audience",
};

// Ordered: the first matching rule wins. Arabic has no \b, so plain substrings are used.
const PURPOSE_RULES = [
  ["pitch_deck", /مستثمر|استثمار|تمويل|جولة تمويل|investor|pitch|funding|seed round|series [abc]\b|fundrais/i],
  ["training", /تدريب|ورشة عمل|ورشه عمل|دورة|workshop|training|onboarding|bootcamp/i],
  ["research", /بحث علمي|دراسة|أكاديمي|اكاديمي|رسالة ماجستير|رسالة دكتوراه|thesis|research|academic|literature review/i],
  ["marketing", /تسويق|حملة|إعلان|اعلان|علامة تجارية|marketing|campaign|go-to-market|advertis|brand awareness/i],
  ["business_report", /تقرير|ربع سنوي|نتائج الاعمال|نتائج الأعمال|report|quarterly|annual review|kpi|performance review/i],
  ["business_proposal", /مقترح|خطة عمل|عرض سعر|دراسة جدوى|proposal|business plan|feasibility/i],
  ["educational", /شرح|تعليم|درس|مقدمة في|تعريف ب|مبتدئ|learn|tutorial|lesson|introduction to|explain|educat/i],
];

/** Deterministic purpose inference from the topic text. Returns a purpose key or null. */
export function inferPurpose(topic) {
  const text = String(topic || "");
  for (const [purpose, pattern] of PURPOSE_RULES) {
    if (pattern.test(text)) return purpose;
  }
  return null;
}

/* ------------------------------ color notes ------------------------------ */

function colorGuidance(colorPackage) {
  const [primary, secondary, accent, background] = colorPackage.colors.map((c) => c.toUpperCase());
  return (
    `Color palette (use consistently across the whole deck): primary/dark ${primary}, secondary ${secondary}, ` +
    `accent ${accent}, light background ${background}. Use these colors for backgrounds, headings, shapes and charts, ` +
    `and keep text readable against them.`
  );
}

/* ------------------------------- builder ------------------------------- */

function asString(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/*
 * input:   topic, purpose, audience, customAudience, slideCount, language, otherLanguage,
 *          colorPackage (id, name, colors[4]), additionalInstructions
 * options: themeIds - optional map of color-package id -> Gamma themeId (server secret)
 * returns: { ok: true, request, meta } or { ok: false, errors } keyed by form field
 */
export function buildGammaRequest(input, options = {}) {
  const errors = {};
  const topic = asString(input?.topic).trim();
  const purposeInput = asString(input?.purpose).trim();
  const audienceInput = asString(input?.audience).trim();
  const customAudience = asString(input?.customAudience).trim();
  const slideCountInput = asString(input?.slideCount || "auto").trim();
  const languageInput = asString(input?.language).trim();
  const otherLanguage = asString(input?.otherLanguage).trim();
  const userInstructions = asString(input?.additionalInstructions).trim();
  const colorPackage = input?.colorPackage;

  if (!topic) errors.topic = "REQUIRED";
  else if (topic.length > FORM_LIMITS.topicMax) errors.topic = "TOO_LONG";

  if (!purposeInput) errors.purpose = "REQUIRED";
  else if (purposeInput !== "auto" && !PURPOSE_META[purposeInput]) errors.purpose = "INVALID";

  if (!audienceInput) errors.audience = "REQUIRED";
  else if (audienceInput !== "auto" && audienceInput !== "custom" && !AUDIENCE_LABELS[audienceInput]) errors.audience = "INVALID";
  if (audienceInput === "custom") {
    if (!customAudience) errors.customAudience = "REQUIRED";
    else if (customAudience.length > FORM_LIMITS.customAudienceMax) errors.customAudience = "TOO_LONG";
  }

  let numCards = null;
  if (slideCountInput !== "auto") {
    const n = Number(slideCountInput);
    if (!SLIDE_COUNTS.includes(n)) errors.slideCount = "INVALID";
    else numCards = n;
  }

  let languageCode = null;
  if (!languageInput) errors.language = "REQUIRED";
  else if (languageInput === "other") {
    if (!otherLanguage) errors.otherLanguage = "REQUIRED";
    else if (otherLanguage.length > FORM_LIMITS.otherLanguageMax) errors.otherLanguage = "TOO_LONG";
    else {
      languageCode = resolveLanguageCode(otherLanguage);
      if (!languageCode) errors.otherLanguage = "UNSUPPORTED_LANGUAGE";
    }
  } else {
    languageCode = resolveLanguageCode(languageInput);
    if (!languageCode) errors.language = "UNSUPPORTED_LANGUAGE";
  }

  if (userInstructions.length > FORM_LIMITS.userInstructionsMax) errors.additionalInstructions = "TOO_LONG";

  const validPackage =
    colorPackage &&
    typeof colorPackage.id === "string" && /^[a-z0-9-]{1,40}$/.test(colorPackage.id) &&
    Array.isArray(colorPackage.colors) && colorPackage.colors.length === 4 &&
    colorPackage.colors.every((c) => typeof c === "string" && HEX.test(c));
  if (!validPackage) errors.colorPackage = "INVALID";

  if (Object.keys(errors).length) return { ok: false, errors };

  /* ---- purpose / audience resolution ---- */
  let purpose = purposeInput;
  let purposeSource = "user";
  if (purposeInput === "auto") {
    const inferred = inferPurpose(topic);
    purpose = inferred;
    purposeSource = inferred ? "inferred-from-topic" : "delegated-to-gamma";
  }
  const purposeMeta = purpose ? PURPOSE_META[purpose] : null;

  let audienceText = null;
  let audienceSource = "user";
  if (audienceInput === "custom") audienceText = customAudience;
  else if (audienceInput === "auto") {
    if (purposeMeta) { audienceText = purposeMeta.audience; audienceSource = "inferred-from-purpose"; }
    else audienceSource = "delegated-to-gamma";
  } else audienceText = AUDIENCE_LABELS[audienceInput];

  /* ---- Gamma request ---- */
  const themeId = options?.themeIds && typeof options.themeIds[colorPackage.id] === "string"
    ? options.themeIds[colorPackage.id].trim()
    : "";

  const instructionParts = [];
  if (purposeMeta) instructionParts.push(`Presentation purpose: ${purposeMeta.label}. Structure the deck accordingly.`);
  else instructionParts.push("Infer the most suitable purpose and audience for this presentation from its topic, and structure the deck accordingly.");
  if (!themeId) instructionParts.push(colorGuidance(colorPackage));
  if (userInstructions) instructionParts.push(`Additional requirements from the user:\n${userInstructions}`);
  const additionalInstructions = instructionParts.join("\n\n").slice(0, GAMMA_LIMITS.additionalInstructionsMax);

  const textOptions = { language: languageCode };
  if (purposeMeta) textOptions.tone = purposeMeta.tone.slice(0, GAMMA_LIMITS.toneMax);
  if (audienceText) textOptions.audience = audienceText.slice(0, GAMMA_LIMITS.audienceMax);

  const request = {
    inputText: topic,
    textMode: "generate",
    format: "presentation",
    additionalInstructions,
    textOptions,
    cardOptions: { dimensions: "16x9" },
  };
  if (numCards) { request.numCards = numCards; request.cardSplit = "auto"; }
  if (themeId) request.themeId = themeId;

  return {
    ok: true,
    request,
    meta: {
      purpose: purpose || "auto",
      purposeSource,
      audienceSource,
      languageCode,
      slideCount: numCards || "auto",
      // "auto" is not a Gamma value: numCards is omitted and Gamma applies its own default (10).
      slideCountNote: numCards ? "explicit" : "gamma-default",
      colorPackageId: colorPackage.id,
      colorApplication: themeId ? "theme" : "instructions",
      themeIdUsed: themeId || null,
    },
  };
}

/** Same request, without the themeId (used for a single retry if Gamma rejects the theme). */
export function withoutTheme(request, colorPackage) {
  const next = { ...request };
  delete next.themeId;
  const note = colorGuidance(colorPackage);
  const base = String(next.additionalInstructions || "");
  next.additionalInstructions = (base.includes(note) ? base : `${base}\n\n${note}`).trim().slice(0, GAMMA_LIMITS.additionalInstructionsMax);
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

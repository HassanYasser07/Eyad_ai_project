/**
 * Central option lists for the AI presentation prompt box.
 * The form has exactly: topic text, Add File, detail level ("Standard" menu), Pages, Language
 * (+ an optional template chosen from the gallery below the box).
 * `value` is what is stored in the generation settings and sent to the backend.
 */
export const AUTO = "auto";

// First menu in the toolbar (shown as "Standard"). Backend maps it to Gamma textOptions.amount.
export const DEFAULT_DETAIL = "standard";
export const DETAIL_OPTIONS = [
  { value: "brief", ar: "مختصر", en: "Brief" },
  { value: "standard", ar: "قياسي", en: "Standard" },
  { value: "detailed", ar: "مفصّل", en: "Detailed" },
  { value: "extensive", ar: "موسّع", en: "Extensive" },
];

export const SLIDE_COUNT_OPTIONS = [
  { value: AUTO, ar: "تلقائي", en: "Auto" },
  { value: "5", ar: "5", en: "5" },
  { value: "10", ar: "10", en: "10" },
  { value: "15", ar: "15", en: "15" },
  { value: "20", ar: "20", en: "20" },
];

// `value` is a Gamma textOptions.language key (see supabase/functions/eyad-presentation/gammaRequest.mjs).
export const PRESENTATION_LANGUAGES = [
  { value: AUTO, ar: "تلقائي", en: "Auto" },
  { value: "ar", ar: "العربية", en: "Arabic" },
  { value: "en", ar: "الإنجليزية", en: "English" },
  { value: "fr", ar: "الفرنسية", en: "French" },
  { value: "de", ar: "الألمانية", en: "German" },
  { value: "es", ar: "الإسبانية", en: "Spanish" },
  { value: "it", ar: "الإيطالية", en: "Italian" },
  { value: "pt-br", ar: "البرتغالية", en: "Portuguese" },
  { value: "tr", ar: "التركية", en: "Turkish" },
  { value: "ru", ar: "الروسية", en: "Russian" },
  { value: "fa", ar: "الفارسية", en: "Persian" },
  { value: "ur", ar: "الأردية", en: "Urdu" },
  { value: "hi", ar: "الهندية", en: "Hindi" },
  { value: "zh-cn", ar: "الصينية", en: "Chinese" },
  { value: "ja", ar: "اليابانية", en: "Japanese" },
  { value: "ko", ar: "الكورية", en: "Korean" },
];

export const TOPIC_EXAMPLES = [
  { ar: "خطة تسويق لإطلاق منتج جديد في السوق المصري", en: "A go-to-market plan for launching a new product" },
  { ar: "مقدمة في الذكاء الاصطناعي للمبتدئين", en: "An introduction to AI for beginners" },
  { ar: "عرض استثماري لشركة ناشئة في مجال التقنية المالية", en: "An investor pitch for a fintech startup" },
  { ar: "أساسيات إدارة الوقت لفريق العمل", en: "Time-management essentials for teams" },
];

export const DEFAULT_PRESENTATION_SETTINGS = {
  topic: "",
  detail: DEFAULT_DETAIL,
  slideCount: AUTO,
  language: AUTO,
};

export const LIMITS = {
  topicMax: 50000, // the "0/50000" counter in the prompt box
  fileTextMax: 50000, // text extracted from the attached file (longer files are truncated)
  fileBytesMax: 10 * 1024 * 1024,
};

// Attach-file support: text is extracted in the browser, so only these formats are accepted.
export const ACCEPTED_FILE_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".json", ".docx", ".pptx"];
export const FILE_ACCEPT_ATTR = ACCEPTED_FILE_EXTENSIONS.join(",");

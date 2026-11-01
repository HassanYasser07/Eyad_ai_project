/**
 * Central option lists for the AI presentation form.
 * `value` is what is stored in the generation settings and sent to the backend;
 * the backend maps these to the Gamma API fields that are actually supported.
 */
export const AUTO = "auto";

export const PRESENTATION_PURPOSES = [
  { value: "educational", ar: "تعليمي", en: "Educational" },
  { value: "business_proposal", ar: "مقترح عمل أو مشروع", en: "Business Proposal" },
  { value: "business_report", ar: "تقرير أعمال", en: "Business Report" },
  { value: "pitch_deck", ar: "عرض للمستثمرين", en: "Pitch Deck" },
  { value: "marketing", ar: "تسويق", en: "Marketing" },
  { value: "training", ar: "تدريب", en: "Training" },
  { value: "research", ar: "بحث علمي أو أكاديمي", en: "Research" },
  { value: "other", ar: "أخرى", en: "Other" },
  { value: AUTO, ar: "تحديد تلقائي بالذكاء الاصطناعي", en: "Auto-detect" },
];

export const PRESENTATION_AUDIENCES = [
  { value: "students", ar: "الطلاب", en: "Students" },
  { value: "beginners", ar: "المبتدئون", en: "Beginners" },
  { value: "professionals", ar: "المحترفون والمتخصصون", en: "Professionals" },
  { value: "executives", ar: "المديرون والإدارة التنفيذية", en: "Executives / Managers" },
  { value: "investors", ar: "المستثمرون", en: "Investors" },
  { value: "general", ar: "الجمهور العام", en: "General Audience" },
  { value: "custom", ar: "جمهور مخصص", en: "Custom" },
  { value: AUTO, ar: "تحديد تلقائي بالذكاء الاصطناعي", en: "Auto-detect" },
];

export const SLIDE_COUNT_OPTIONS = [
  { value: AUTO, ar: "تلقائي", en: "Auto" },
  { value: "5", ar: "5 شرائح", en: "5 slides" },
  { value: "10", ar: "10 شرائح", en: "10 slides" },
  { value: "15", ar: "15 شريحة", en: "15 slides" },
  { value: "20", ar: "20 شريحة", en: "20 slides" },
];

export const PRESENTATION_LANGUAGES = [
  { value: "en", ar: "الإنجليزية", en: "English" },
  { value: "ar", ar: "العربية", en: "Arabic" },
  { value: "fr", ar: "الفرنسية", en: "French" },
  { value: "de", ar: "الألمانية", en: "German" },
  { value: "es", ar: "الإسبانية", en: "Spanish" },
  { value: "other", ar: "لغة أخرى", en: "Other" },
];

export const TOPIC_EXAMPLES = [
  { ar: "خطة تسويق لإطلاق منتج جديد في السوق المصري", en: "A go-to-market plan for launching a new product" },
  { ar: "مقدمة في الذكاء الاصطناعي للمبتدئين", en: "An introduction to AI for beginners" },
  { ar: "عرض استثماري لشركة ناشئة في مجال التقنية المالية", en: "An investor pitch for a fintech startup" },
  { ar: "أساسيات إدارة الوقت لفريق العمل", en: "Time-management essentials for teams" },
];

export const DEFAULT_PRESENTATION_SETTINGS = {
  topic: "",
  purpose: "",
  audience: "",
  customAudience: "",
  slideCount: AUTO,
  language: "",
  otherLanguage: "",
  colorPackageId: "ocean-blue",
  additionalInstructions: "",
};

export const LIMITS = {
  topicMax: 6000,
  customAudienceMax: 300,
  otherLanguageMax: 60,
  additionalInstructionsMax: 2000,
};

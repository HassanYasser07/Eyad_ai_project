/** Strings for background generation. Kept separate from the large translations.js on purpose. */
export const generationTranslations = {
  ar: {
    "gen.running": "جاري التوليد…",
    "gen.runningCount": "{count} عمليات جارية",
    "gen.continuingBackground": "التوليد مستمر في الخلفية، تقدر تخرج من الصفحة وترجع.",
    "gen.reconnecting": "الاتصال ضعيف مؤقتًا، التوليد مستمر وبنتابعه تلقائيًا.",
    "gen.ready": "جاهز",
    "gen.open": "فتح",
    "gen.dismiss": "إغلاق",
    "gen.longerThanExpected": "التوليد أخذ وقتًا أطول من المعتاد، لسه شغال في الخلفية.",
    "gen.failed": "تعذر إكمال التوليد",
    "gen.retry": "إعادة التوليد",
    "gen.readyToast": "{kind} جاهز",
    "gen.failedToast": "تعذر إكمال {kind}",
    "gen.sheetTitle": "عمليات التوليد",
    "gen.kind.mockup": "الموك أب",
    "gen.kind.logo": "الشعار",
    "gen.kind.image": "الصورة",
    "gen.kind.template": "التصميم",
    "gen.kind.brand-package": "باقة الهوية",
    "gen.kind.company-profile": "الملف التعريفي",
    "gen.kind.presentation": "العرض التقديمي",
    "gen.kind.video": "الفيديو",
    "gen.kind.chat": "الطلب",
  },
  en: {
    "gen.running": "Generating…",
    "gen.runningCount": "{count} running",
    "gen.continuingBackground": "Generation keeps running in the background. You can leave and come back.",
    "gen.reconnecting": "Weak connection for a moment. Generation is still running and we keep checking.",
    "gen.ready": "Ready",
    "gen.open": "Open",
    "gen.dismiss": "Dismiss",
    "gen.longerThanExpected": "This is taking longer than usual, but it is still running in the background.",
    "gen.failed": "Generation could not be completed",
    "gen.retry": "Regenerate",
    "gen.readyToast": "Your {kind} is ready",
    "gen.failedToast": "{kind} could not be completed",
    "gen.sheetTitle": "Generations",
    "gen.kind.mockup": "mockup",
    "gen.kind.logo": "logo",
    "gen.kind.image": "image",
    "gen.kind.template": "design",
    "gen.kind.brand-package": "brand package",
    "gen.kind.company-profile": "company profile",
    "gen.kind.presentation": "presentation",
    "gen.kind.video": "video",
    "gen.kind.chat": "request",
  },
};

export function genText(language, key, vars) {
  const dict = generationTranslations[language === "en" ? "en" : "ar"];
  let value = dict[key] ?? generationTranslations.en[key] ?? key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { value = value.replace(`{${k}}`, String(v)); });
  return value;
}

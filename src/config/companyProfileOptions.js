/**
 * Company Profile (inside Visual Identity Studio) — form schema and presentation options.
 * Every field except `companyName` and `description` is optional: the more the user fills in,
 * the more specific (and the less generic) the generated profile deck becomes.
 * Add / rename / remove a field here only; the form, the saved project data and the prompt builder all read this file.
 */
export const PROFILE_SLIDE_MIN = 5;
export const PROFILE_SLIDE_MAX = 30;
export const PROFILE_SLIDE_DEFAULT = 12;
export const PROFILE_SLIDE_PRESETS = [8, 12, 16, 20];

export const PROFILE_LANGUAGES = [
  { value: "ar", ar: "العربية", en: "Arabic" },
  { value: "en", ar: "الإنجليزية", en: "English" },
  { value: "bilingual", ar: "ثنائي اللغة (عربي + إنجليزي)", en: "Bilingual (Arabic + English)" },
];

export const PROFILE_TONES = [
  { value: "corporate", ar: "رسمي واحترافي", en: "Corporate & professional" },
  { value: "modern", ar: "عصري وجريء", en: "Modern & bold" },
  { value: "luxury", ar: "فاخر وأنيق", en: "Premium & elegant" },
  { value: "technical", ar: "هندسي وتقني", en: "Technical & engineering-led" },
  { value: "friendly", ar: "ودّي وقريب", en: "Friendly & approachable" },
];

export const PROFILE_AUDIENCES = [
  { value: "clients", ar: "العملاء", en: "Clients & customers" },
  { value: "tenders", ar: "مناقصات وجهات حكومية", en: "Tenders & government entities" },
  { value: "investors", ar: "المستثمرون", en: "Investors & partners" },
  { value: "talent", ar: "الكفاءات والموظفون", en: "Talent & recruitment" },
];

export const PROFILE_DETAILS = [
  { value: "brief", ar: "مختصر", en: "Brief" },
  { value: "standard", ar: "قياسي", en: "Standard" },
  { value: "detailed", ar: "مفصّل", en: "Detailed" },
];

/**
 * type: "text" | "textarea" | "tel" | "email" | "url"
 * hint (optional) is shown under the label and as the placeholder example.
 */
export const PROFILE_GROUPS = [
  {
    id: "basics",
    required: true,
    ar: "المعلومات الأساسية", en: "Company basics",
    hintAr: "الحد الأدنى للبدء", hintEn: "The minimum to start",
    fields: [
      { key: "companyName", type: "text", required: true, ar: "اسم الشركة", en: "Company name" },
      { key: "tagline", type: "text", ar: "الشعار التعريفي", en: "Tagline / slogan", exAr: "نبني بثقة ونسلّم بجودة", exEn: "Building with confidence, delivering with quality" },
      { key: "industry", type: "text", ar: "المجال / النشاط الرئيسي", en: "Industry / main activity", exAr: "استشارات هندسية وإدارة مشاريع", exEn: "Engineering consultancy & project management" },
      { key: "foundedYear", type: "text", ar: "سنة التأسيس", en: "Year founded", exAr: "2012", exEn: "2012" },
      { key: "teamSize", type: "text", ar: "حجم الفريق", en: "Team size", exAr: "+120 موظفًا", exEn: "120+ professionals" },
      { key: "headquarters", type: "text", ar: "المقر الرئيسي", en: "Headquarters", exAr: "الرياض، المملكة العربية السعودية", exEn: "Riyadh, Saudi Arabia" },
      { key: "description", type: "textarea", required: true, rows: 5, ar: "نبذة عن الشركة", en: "Company description", exAr: "ما الذي تفعله الشركة، ولمن، وما الذي يميّزها؟", exEn: "What the company does, for whom, and what makes it different." },
    ],
  },
  {
    id: "story",
    ar: "القصة والرؤية والقيم", en: "Story, vision & values",
    hintAr: "تُستخدم لشرائح من نحن والرؤية والرسالة", hintEn: "Feeds the About, Vision, Mission & Values slides",
    fields: [
      { key: "story", type: "textarea", rows: 4, ar: "قصة الشركة ومحطاتها", en: "Company story & milestones", exAr: "كل محطة في سطر: 2012 — التأسيس…", exEn: "One milestone per line: 2012 — Founded…" },
      { key: "vision", type: "textarea", rows: 2, ar: "الرؤية", en: "Vision" },
      { key: "mission", type: "textarea", rows: 2, ar: "الرسالة", en: "Mission" },
      { key: "values", type: "textarea", rows: 3, ar: "القيم", en: "Core values", exAr: "قيمة في كل سطر", exEn: "One value per line" },
      { key: "differentiators", type: "textarea", rows: 4, ar: "لماذا نحن؟ (نقاط التميّز)", en: "Why choose us (differentiators)", exAr: "نقطة تميّز في كل سطر", exEn: "One differentiator per line" },
    ],
  },
  {
    id: "services",
    ar: "الخدمات والقطاعات", en: "Services & sectors",
    hintAr: "كل خدمة قد تحصل على شريحة مستقلة", hintEn: "Each service can get its own slide",
    fields: [
      { key: "services", type: "textarea", rows: 5, ar: "الخدمات الرئيسية", en: "Main services", exAr: "خدمة في كل سطر. يمكنك كتابة تفاصيلها بعد النقطتين ':'", exEn: "One per line. Add details after a colon ':'" },
      { key: "products", type: "textarea", rows: 3, ar: "المنتجات / الحلول", en: "Products / solutions" },
      { key: "sectors", type: "textarea", rows: 3, ar: "القطاعات التي تخدمها", en: "Sectors you serve", exAr: "سكني، تجاري، صحي، تعليمي…", exEn: "Residential, commercial, healthcare, education…" },
      { key: "process", type: "textarea", rows: 3, ar: "منهجية العمل / مراحل التنفيذ", en: "Work methodology / process", exAr: "خطوة في كل سطر", exEn: "One step per line" },
      { key: "technology", type: "textarea", rows: 2, ar: "الأدوات والتقنيات والبرامج", en: "Tools, technology & software" },
    ],
  },
  {
    id: "credibility",
    ar: "الإنجازات والمصداقية", en: "Track record & credibility",
    hintAr: "أرقام وأسماء حقيقية تجعل العرض مقنعًا", hintEn: "Real numbers and names make the deck convincing",
    fields: [
      { key: "stats", type: "textarea", rows: 4, ar: "أرقام وإحصائيات", en: "Key numbers & stats", exAr: "المسمى: القيمة — مثل: مشاريع منفّذة: 250+", exEn: "Label: value — e.g. Projects delivered: 250+" },
      { key: "projects", type: "textarea", rows: 4, ar: "أبرز المشاريع", en: "Notable projects", exAr: "مشروع في كل سطر (الاسم — الموقع — الوصف)", exEn: "One per line (name — location — short description)" },
      { key: "clients", type: "textarea", rows: 2, ar: "العملاء", en: "Clients" },
      { key: "partners", type: "textarea", rows: 2, ar: "الشركاء", en: "Partners" },
      { key: "certifications", type: "textarea", rows: 2, ar: "الشهادات والتراخيص والاعتمادات", en: "Certifications, licences & accreditations", exAr: "ISO 9001، تصنيف المقاولين…", exEn: "ISO 9001, contractor classification…" },
      { key: "awards", type: "textarea", rows: 2, ar: "الجوائز والتكريمات", en: "Awards & recognition" },
      { key: "team", type: "textarea", rows: 3, ar: "الإدارة وفريق القيادة", en: "Leadership team", exAr: "الاسم — المنصب", exEn: "Name — role" },
      { key: "testimonials", type: "textarea", rows: 2, ar: "آراء العملاء", en: "Client testimonials" },
    ],
  },
  {
    id: "contact",
    ar: "التواصل والحضور", en: "Contact & presence",
    hintAr: "تظهر في شريحة التواصل الختامية", hintEn: "Shown on the closing contact slide",
    fields: [
      { key: "phone", type: "tel", ar: "الهاتف", en: "Phone", dir: "ltr" },
      { key: "email", type: "email", ar: "البريد الإلكتروني", en: "Email", dir: "ltr" },
      { key: "website", type: "url", ar: "الموقع الإلكتروني", en: "Website", dir: "ltr" },
      { key: "address", type: "text", ar: "العنوان", en: "Address" },
      { key: "offices", type: "textarea", rows: 2, ar: "الفروع والمكاتب الأخرى", en: "Other offices / branches" },
      { key: "linkedin", type: "text", ar: "لينكدإن", en: "LinkedIn", dir: "ltr" },
      { key: "instagram", type: "text", ar: "إنستغرام", en: "Instagram", dir: "ltr" },
      { key: "facebook", type: "text", ar: "فيسبوك", en: "Facebook", dir: "ltr" },
      { key: "x", type: "text", ar: "X (تويتر)", en: "X (Twitter)", dir: "ltr" },
    ],
  },
  {
    id: "extra",
    ar: "ملاحظات وتعليمات إضافية", en: "Extra notes & instructions",
    hintAr: "أي شيء آخر تريد أن يظهر أو يُتجنّب", hintEn: "Anything else to include or avoid",
    fields: [
      { key: "mustInclude", type: "textarea", rows: 3, ar: "يجب تضمينه", en: "Must include", exAr: "مواضيع أو رسائل لا بد أن تظهر", exEn: "Topics or messages that have to appear" },
      { key: "avoid", type: "textarea", rows: 2, ar: "يجب تجنّبه", en: "Avoid", exAr: "مواضيع أو عبارات لا تريدها", exEn: "Topics or wording you do not want" },
      { key: "extraInstructions", type: "textarea", rows: 3, ar: "تعليمات حرة للمصمم", en: "Free-form instructions", exAr: "مثال: ابدأ بشريحة أرقام قوية، واجعل الأسلوب أقرب لعرض مناقصات", exEn: "e.g. Open with a strong numbers slide and keep a tender-submission feel" },
    ],
  },
];

export const PROFILE_FIELD_KEYS = PROFILE_GROUPS.flatMap((group) => group.fields.map((field) => field.key));

export const EMPTY_PROFILE = {
  ...Object.fromEntries(PROFILE_FIELD_KEYS.map((key) => [key, ""])),
  slideCount: PROFILE_SLIDE_DEFAULT,
  language: "ar",
  tone: "corporate",
  audience: "clients",
  detail: "detailed",
  useBrand: true,
  includeContactSlide: true,
};

export const clampSlideCount = (value) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return PROFILE_SLIDE_DEFAULT;
  return Math.min(PROFILE_SLIDE_MAX, Math.max(PROFILE_SLIDE_MIN, n));
};

/** Number of optional fields filled in (drives the "completeness" meter). */
export function profileCompleteness(form = {}) {
  const optional = PROFILE_GROUPS.flatMap((group) => group.fields.filter((field) => !field.required));
  const filled = optional.filter((field) => String(form[field.key] || "").trim()).length;
  return { filled, total: optional.length, ratio: optional.length ? filled / optional.length : 0 };
}

/** Group-level fill counts for the accordion badges. */
export function groupFill(form = {}, group) {
  const filled = group.fields.filter((field) => String(form[field.key] || "").trim()).length;
  return { filled, total: group.fields.length };
}

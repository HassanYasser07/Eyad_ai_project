/**
 * EYAD AI — Brand Profile data helpers.
 *
 * Pure functions (no DOM) used by the Brand Package PDF generator:
 * colour maths, colour naming, sector detection and bilingual copy.
 * The sector profile is what makes every generated brand book feel written
 * for the user's own business instead of being a generic template.
 */

/* ------------------------------------------------------------------ colour */

export function normalizeHex(value, fallback = "#1f2937") {
  let hex = String(value || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(hex) ? "#" + hex.toUpperCase() : fallback.toUpperCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return ("#" + c(r) + c(g) + c(b)).toUpperCase();
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

export function rgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Best readable text colour (near-white or near-black tinted by `ink`) on `bg`. */
export function readableOn(bg, light = "#FFFFFF", dark = "#111111") {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

export function rgbToCmyk(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}

export function rgbToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
    else if (max === gg) h = ((bb - rr) / d + 2) * 60;
    else h = ((rr - gg) / d + 4) * 60;
  }
  return { h, s, l };
}

const NAMED_COLORS = [
  ["111111", "Black", "أسود"], ["36454F", "Charcoal", "فحمي"], ["4A4F57", "Graphite", "جرافيت"],
  ["808080", "Grey", "رمادي"], ["C4CAD2", "Silver", "فضي"], ["F4F6F8", "Mist", "ضبابي"], ["FFFFFF", "White", "أبيض"],
  ["FFF5E2", "Cream", "كريمي"], ["FFFFF0", "Ivory", "عاجي"], ["D9C7A3", "Beige", "بيج"], ["E5D3BB", "Sand", "رملي"],
  ["AFA065", "Khaki", "كاكي"], ["6B7B2A", "Olive", "زيتوني"], ["52651D", "Olive Green", "أخضر زيتوني"],
  ["47380D", "Olive Brown", "بني زيتوني"], ["231B08", "Dark Brown", "بني داكن"], ["70451F", "Brown", "بني"],
  ["B8894E", "Tan", "بني فاتح"], ["C08B3D", "Caramel", "كراميل"], ["D3A53A", "Gold", "ذهبي"], ["E1AD01", "Mustard", "خردلي"],
  ["FFD13B", "Sun Yellow", "أصفر مشمس"], ["FF7A21", "Orange", "برتقالي"], ["F44B22", "Orange Red", "أحمر برتقالي"],
  ["E77C6F", "Coral", "مرجاني"], ["D71920", "Red", "أحمر"], ["9B1B30", "Crimson", "قرمزي"], ["6D1A2B", "Burgundy", "عنابي"],
  ["F4A6C0", "Blush Pink", "وردي"], ["C33D79", "Magenta", "فوشيا"], ["7A1748", "Berry", "توتي"],
  ["6A2BC8", "Purple", "بنفسجي"], ["D9C7FF", "Lavender", "لافندر"], ["3F3FA0", "Indigo", "نيلي"],
  ["123B82", "Navy", "كحلي"], ["2B5FDB", "Royal Blue", "أزرق ملكي"], ["2B78F6", "Blue", "أزرق"], ["8DC7FF", "Sky Blue", "سماوي"],
  ["00C7EE", "Cyan", "سيان"], ["087DAA", "Ocean", "أزرق محيطي"], ["11A6A0", "Teal", "تركوازي"], ["006B68", "Deep Teal", "تركوازي داكن"],
  ["BCEFD8", "Mint", "نعناعي"], ["087A50", "Emerald", "زمردي"], ["18B96B", "Green", "أخضر"], ["9AE36B", "Lime", "ليموني"],
  ["1F4D2B", "Forest", "أخضر غابي"],
];

export function colorName(hex, ar) {
  const { r, g, b } = hexToRgb(hex);
  let best = NAMED_COLORS[0];
  let bestD = Infinity;
  for (const entry of NAMED_COLORS) {
    const c = hexToRgb("#" + entry[0]);
    const rm = (r + c.r) / 2;
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) { bestD = d; best = entry; }
  }
  return ar ? best[2] : best[1];
}

/* --------------------------------------------------------- sector profiles */

const P = (en, ar, dEn, dAr) => ({ en, ar, dEn, dAr });

export const SECTORS = [
  {
    id: "food",
    match: /(cafe|café|coffee|restaurant|bakery|food|kitchen|pastry|dessert|catering|juice|burger|pizza|roast|مطعم|قهوة|كافيه|مقهى|مخبز|حلويات|طعام|مأكولات|عصير|كوفي)/i,
    motif: "rings",
    scene: "warm artisanal food and beverage scene, steam, textured table, natural window light, shallow depth of field, appetizing, editorial",
    essence: { en: "Made with care. Served with character.", ar: "صُنع بعناية. يُقدَّم بشخصية." },
    sector: { en: "Food & Beverage", ar: "الأغذية والمشروبات" },
    pillars: [
      P("Craft", "الحرفة", "Every detail is considered, from the first ingredient to the last impression.", "كل تفصيلة مدروسة، من أول مكوّن حتى آخر انطباع."),
      P("Warmth", "الدفء", "A welcoming tone that makes every guest feel at home.", "نبرة ترحيبية تجعل كل ضيف يشعر أنه في بيته."),
      P("Memory", "الذاكرة", "A flavour and a look people recognise and come back for.", "نكهة ومظهر يتعرف عليهما الناس ويعودون من أجلهما."),
    ],
    typeNote: { en: "A friendly, highly legible voice that reads well on menus, packaging and signage.", ar: "صوت ودود وواضح جدًا يُقرأ بسهولة على القوائم والتغليف واللافتات." },
  },
  {
    id: "tech",
    match: /(tech|software|saas|app\b|application|startup|ai\b|artificial|digital|platform|it\b|cloud|data|cyber|برمج|تقني|تقنية|تطبيق|ذكاء|رقمي|منصة|سحابي|نظم)/i,
    motif: "grid",
    scene: "modern minimal technology workspace, soft light on glass and metal, abstract digital depth, clean futuristic atmosphere",
    essence: { en: "Clear thinking. Built to scale.", ar: "تفكير واضح. مبني للنمو." },
    sector: { en: "Technology", ar: "التقنية" },
    pillars: [
      P("Clarity", "الوضوح", "Complex ideas expressed in simple, confident visuals.", "أفكار معقدة تُقدَّم بصريًا ببساطة وثقة."),
      P("Precision", "الدقة", "A disciplined system where every element has a purpose.", "نظام منضبط لكل عنصر فيه وظيفة."),
      P("Momentum", "الزخم", "A forward-looking identity that signals progress.", "هوية تتطلع للأمام وتعكس التقدّم."),
    ],
    typeNote: { en: "A crisp, neutral voice optimised for interfaces, dashboards and documentation.", ar: "صوت واضح ومحايد مناسب للواجهات ولوحات البيانات والوثائق." },
  },
  {
    id: "beauty",
    match: /(fashion|beauty|salon|cosmetic|makeup|boutique|clothing|apparel|jewel|spa|perfume|skincare|أزياء|تجميل|صالون|مكياج|ملابس|بوتيك|مجوهرات|عطور|عناية|سبا|موضة)/i,
    motif: "waves",
    scene: "soft luxurious editorial beauty still life, silk textures, delicate highlights, refined and elegant, high-end magazine look",
    essence: { en: "Refined. Personal. Unmistakable.", ar: "راقٍ. شخصي. لا يُنسى." },
    sector: { en: "Fashion & Beauty", ar: "الأزياء والجمال" },
    pillars: [
      P("Elegance", "الأناقة", "Restraint and polish in every composition.", "رقيّ وإتقان في كل تكوين."),
      P("Confidence", "الثقة", "A voice that celebrates individuality.", "صوت يحتفي بالتميّز الشخصي."),
      P("Desire", "الجاذبية", "Imagery and materials that create longing.", "صور وخامات تصنع الرغبة والانجذاب."),
    ],
    typeNote: { en: "An expressive yet refined voice suited to campaigns, lookbooks and packaging.", ar: "صوت معبّر وراقٍ يناسب الحملات والكتالوجات والتغليف." },
  },
  {
    id: "construction",
    match: /(construction|architect|engineering|real estate|property|interior|contracting|building|developer|decor|مقاول|عمار|هندس|عقار|ديكور|تشييد|بناء|مباني|تطوير عقاري|تصميم داخلي)/i,
    motif: "lines",
    scene: "dramatic architectural photography, clean geometric lines, concrete and glass, golden hour light, strong perspective",
    essence: { en: "Built on trust. Designed to last.", ar: "مبنيّ على الثقة. مصمَّم ليدوم." },
    sector: { en: "Architecture & Construction", ar: "العمارة والإنشاءات" },
    pillars: [
      P("Strength", "القوة", "A solid, grounded presence that inspires confidence.", "حضور راسخ يبعث على الاطمئنان."),
      P("Precision", "الإتقان", "Exact proportions and structured layouts.", "نسب دقيقة وتخطيط منظّم."),
      P("Vision", "الرؤية", "Spaces and ideas shaped with long-term thinking.", "مساحات وأفكار تُصاغ برؤية بعيدة المدى."),
    ],
    typeNote: { en: "A strong, structured voice that works on plans, proposals and site signage.", ar: "صوت قوي ومنظّم يعمل بوضوح على المخططات والعروض واللافتات." },
  },
  {
    id: "finance",
    match: /(finance|financial|account|bank|consult|insurance|invest|audit|tax|law|legal|محاسب|مالي|مالية|بنك|استشار|تأمين|استثمار|تدقيق|ضرائب|محام|قانون)/i,
    motif: "lines",
    scene: "calm premium corporate environment, subtle city skyline at dusk, polished surfaces, trust and stability, soft depth",
    essence: { en: "Insight you can rely on.", ar: "رؤية يمكنك الاعتماد عليها." },
    sector: { en: "Finance & Advisory", ar: "المال والاستشارات" },
    pillars: [
      P("Trust", "الثقة", "A calm, credible look that reassures clients.", "مظهر هادئ وموثوق يطمئن العملاء."),
      P("Expertise", "الخبرة", "Authority expressed through clarity, not noise.", "سلطة معرفية تُعبَّر عنها بالوضوح لا بالضجيج."),
      P("Growth", "النمو", "A confident focus on progress and results.", "تركيز واثق على التقدّم والنتائج."),
    ],
    typeNote: { en: "An authoritative, legible voice for reports, statements and presentations.", ar: "صوت موثوق ومقروء للتقارير والبيانات والعروض." },
  },
  {
    id: "health",
    match: /(health|clinic|medical|dental|pharmacy|hospital|care|wellness|therapy|nutrition|صح|عياد|طب|أسنان|صيدل|مستشفى|رعاية|علاج|تغذية)/i,
    motif: "dots",
    scene: "bright clean healthcare and wellness environment, soft natural light, calm and reassuring, human and caring",
    essence: { en: "Care that feels human.", ar: "رعاية بإحساس إنساني." },
    sector: { en: "Health & Wellness", ar: "الصحة والعافية" },
    pillars: [
      P("Care", "الرعاية", "A compassionate tone in every touchpoint.", "نبرة متعاطفة في كل نقطة تواصل."),
      P("Trust", "الأمان", "Clean, calm visuals that build confidence.", "عناصر نقية وهادئة تبني الطمأنينة."),
      P("Wellbeing", "العافية", "A fresh, optimistic outlook on health.", "نظرة منعشة ومتفائلة للصحة."),
    ],
    typeNote: { en: "A soft, highly readable voice for patient information and signage.", ar: "صوت ناعم وعالي المقروئية لمعلومات المرضى واللافتات." },
  },
  {
    id: "education",
    match: /(education|school|academy|training|course|university|learning|kids|nursery|تعليم|مدرس|أكاديم|تدريب|دورة|جامعة|تعلم|حضانة|أطفال)/i,
    motif: "dots",
    scene: "inspiring bright learning environment, books and creative tools, natural light, curiosity and growth, friendly and modern",
    essence: { en: "Curiosity, shaped into growth.", ar: "فضولٌ يتحوّل إلى نموّ." },
    sector: { en: "Education & Training", ar: "التعليم والتدريب" },
    pillars: [
      P("Curiosity", "الفضول", "An open, inviting look that encourages questions.", "مظهر مفتوح ومحفّز يشجّع على السؤال."),
      P("Clarity", "الوضوح", "Knowledge presented simply and memorably.", "معرفة تُقدَّم ببساطة وبشكل لا يُنسى."),
      P("Progress", "التقدّم", "Visible steps that celebrate every achievement.", "خطوات ملموسة تحتفي بكل إنجاز."),
    ],
    typeNote: { en: "A friendly, structured voice that supports reading and learning.", ar: "صوت ودود ومنظّم يدعم القراءة والتعلّم." },
  },
  {
    id: "travel",
    match: /(travel|tourism|hotel|resort|trip|hospitality|airline|safari|سفر|سياح|فندق|منتجع|رحلات|ضيافة|طيران)/i,
    motif: "waves",
    scene: "cinematic travel landscape at golden hour, sense of discovery and horizon, rich natural colour, inviting and aspirational",
    essence: { en: "Every journey, beautifully remembered.", ar: "كل رحلة، بذكرى جميلة." },
    sector: { en: "Travel & Hospitality", ar: "السفر والضيافة" },
    pillars: [
      P("Discovery", "الاكتشاف", "An adventurous spirit that invites exploration.", "روح مغامرة تدعو إلى الاستكشاف."),
      P("Hospitality", "الضيافة", "Warm, generous and genuinely welcoming.", "دافئة وكريمة وترحيبها صادق."),
      P("Memory", "الذكرى", "Moments designed to be remembered and shared.", "لحظات مصمَّمة لتُذكَر وتُشارَك."),
    ],
    typeNote: { en: "An inviting voice suited to itineraries, brochures and digital campaigns.", ar: "صوت جذّاب يناسب البرامج والكتيبات والحملات الرقمية." },
  },
  {
    id: "sports",
    match: /(sport|fitness|gym|run|training club|athlet|yoga|football|cycling|رياض|لياقة|جيم|جري|نادي|كرة|يوغا|دراج)/i,
    motif: "lines",
    scene: "dynamic outdoor sport in motion, motion blur, natural light, energetic and authentic, cinematic documentary style",
    essence: { en: "Move with purpose. Keep your rhythm.", ar: "تحرّك بهدف. حافظ على إيقاعك." },
    sector: { en: "Sports & Fitness", ar: "الرياضة واللياقة" },
    pillars: [
      P("Energy", "الطاقة", "A kinetic look that feels alive and in motion.", "مظهر حركي ينبض بالحياة."),
      P("Consistency", "الاستمرارية", "Progress built one step at a time.", "تقدّم يُبنى خطوة بعد خطوة."),
      P("Community", "المجتمع", "A shared pace that brings people together.", "إيقاع مشترك يجمع الناس."),
    ],
    typeNote: { en: "A bold, energetic voice that stays legible in motion and at a distance.", ar: "صوت جريء ونشِط يبقى واضحًا في الحركة ومن بعيد." },
  },
  {
    id: "creative",
    match: /(agency|marketing|design|media|advertis|studio|brand|photograph|production|creative|وكالة|تسويق|تصميم|إعلام|دعاية|إعلان|استوديو|تصوير|إنتاج|إبداع)/i,
    motif: "grid",
    scene: "creative studio mood, layered textures, bold colour light, craft tools and inspiration, expressive contemporary editorial look",
    essence: { en: "Ideas with a point of view.", ar: "أفكار لها وجهة نظر." },
    sector: { en: "Creative & Marketing", ar: "الإبداع والتسويق" },
    pillars: [
      P("Originality", "الأصالة", "A distinctive look that never feels templated.", "مظهر مميّز لا يبدو كقالب جاهز."),
      P("Craft", "الإتقان", "Considered details that reward a second look.", "تفاصيل مدروسة تستحق نظرة ثانية."),
      P("Impact", "الأثر", "Ideas designed to be noticed and remembered.", "أفكار مصمَّمة لتُلاحَظ وتُتذكَّر."),
    ],
    typeNote: { en: "An expressive, flexible voice for campaigns, decks and social content.", ar: "صوت معبّر ومرن للحملات والعروض والمحتوى الاجتماعي." },
  },
  {
    id: "retail",
    match: /(shop|store|retail|ecommerce|e-commerce|market|trading|wholesale|supermarket|متجر|محل|تجارة|تجزئة|سوق|جملة|بيع)/i,
    motif: "dots",
    scene: "stylish modern retail display, curated products, soft studio light, inviting and organised, premium shopping atmosphere",
    essence: { en: "Curated for the way you live.", ar: "مُنتقى بما يناسب أسلوب حياتك." },
    sector: { en: "Retail & Commerce", ar: "التجزئة والتجارة" },
    pillars: [
      P("Selection", "الاختيار", "A carefully curated, easy-to-navigate offer.", "عرض منتقى بعناية وسهل التصفح."),
      P("Value", "القيمة", "Quality and fairness communicated clearly.", "جودة وعدالة في السعر تُعرض بوضوح."),
      P("Service", "الخدمة", "A friendly experience from shelf to doorstep.", "تجربة ودودة من الرف حتى الباب."),
    ],
    typeNote: { en: "A clear, approachable voice for price tags, packaging and campaigns.", ar: "صوت واضح وقريب يناسب بطاقات الأسعار والتغليف والحملات." },
  },
];

export const DEFAULT_SECTOR = {
  id: "general",
  motif: "rings",
  scene: "refined modern business atmosphere, soft cinematic light, abstract texture, premium and welcoming, editorial photography",
  essence: { en: "A consistent identity, everywhere you appear.", ar: "هوية متسقة في كل مكان تظهر فيه." },
  sector: { en: "Business", ar: "الأعمال" },
  pillars: [
    P("Consistency", "الاتساق", "One recognisable look across every touchpoint.", "مظهر واحد يمكن التعرف عليه في كل نقطة تواصل."),
    P("Quality", "الجودة", "Considered details that signal professionalism.", "تفاصيل مدروسة تعكس الاحترافية."),
    P("Trust", "الثقة", "A confident presence customers remember.", "حضور واثق يتذكره العملاء."),
  ],
  typeNote: { en: "A clear, balanced voice that works on screen and in print.", ar: "صوت واضح ومتوازن يعمل على الشاشة وفي المطبوعات." },
};

export function detectSector(...sources) {
  const haystack = sources.filter(Boolean).join(" ");
  if (!haystack.trim()) return DEFAULT_SECTOR;
  return SECTORS.find((s) => s.match.test(haystack)) || DEFAULT_SECTOR;
}

/* ------------------------------------------------------------- palette tone */

export function describeTone(primary, secondary, ar) {
  const { h, s, l } = rgbToHsl(primary);
  const sec = rgbToHsl(secondary);
  let temp;
  if (s < 0.12) temp = { en: "neutral", ar: "محايدة" };
  else if (h < 70 || h >= 330) temp = { en: "warm", ar: "دافئة" };
  else if (h >= 70 && h < 170) temp = { en: "natural", ar: "طبيعية" };
  else if (h >= 170 && h < 280) temp = { en: "cool", ar: "باردة" };
  else temp = { en: "expressive", ar: "تعبيرية" };
  const depth = l < 0.3 ? { en: "deep", ar: "عميقة" } : l > 0.6 ? { en: "light", ar: "فاتحة" } : { en: "balanced", ar: "متوازنة" };
  const energy = Math.max(s, sec.s) > 0.65 ? { en: "vibrant", ar: "نابضة" } : { en: "composed", ar: "هادئة" };
  return ar
    ? `ألوان ${temp.ar} ${depth.ar} ${energy.ar}`
    : `${depth.en}, ${temp.en} and ${energy.en}`;
}

export function pickFontCategory(font) {
  const fam = String(font?.family || "");
  return /serif/i.test(fam) && !/sans-serif/i.test(fam) ? "serif" : "sans";
}

export function firstFamily(font, fallback) {
  const raw = String(font?.family || "");
  const m = raw.match(/^\s*['"]?([^'",]+)['"]?/);
  return (m && m[1].trim()) || fallback;
}

/* ------------------------------------------------------------------- copy */

export function buildCopy({ ar, name, activity, sector, tone, enFont, arFont }) {
  const act = String(activity || "").trim();
  const enCat = pickFontCategory(enFont) === "serif" ? "serif" : "sans-serif";
  if (ar) {
    return {
      guidelines: "دليل الهوية البصرية",
      story: "قصة العلامة",
      storyTitle: name,
      storyBody: [
        act
          ? `${name} علامة تعمل في مجال ${act}، وقد صُمّمت هويتها لتعبّر عن هذا النشاط بصريًا بوضوح وثقة.`
          : `${name} علامة بُنيت هويتها البصرية لتقدّم حضورًا واضحًا واحترافيًا في كل نقطة تواصل.`,
        `تعتمد الهوية على لوحة ألوان ${tone}، ونظام خطوط ثنائي اللغة، وشعار موحّد يظهر بنفس الشخصية على المنصات الرقمية والمطبوعات.`,
      ],
      industry: "القطاع",
      activityLabel: "النشاط",
      toneLabel: "طابع الألوان",
      pillarsTitle: "ركائز العلامة",
      logo: "الشعار",
      logoSub: "إنشاء الشعار ومساحة الأمان",
      clearSpace: "مساحة الأمان",
      clearSpaceText: "اترك حول الشعار مساحة فارغة لا تقل عن ارتفاع رمزه مقسومًا على أربعة، ولا تضع فيها نصوصًا أو عناصر أخرى.",
      versions: "نسخ الشعار",
      onLight: "على خلفية فاتحة",
      onDark: "على خلفية داكنة",
      onAccent: "على اللون المميز",
      colors: "نظام الألوان",
      colorsSub: "القيم المعتمدة للطباعة والشاشة",
      colorNote: "قيم CMYK تقريبية للمرجعية؛ اعتمد عينة مطبوعة قبل الإنتاج.",
      ratio: "نسبة الاستخدام المقترحة",
      roles: ["الرئيسي", "الثانوي", "المميّز", "السطح", "الحبر"],
      roleDerived: "مشتق",
      typography: "الخطوط",
      typeLatin: "الخط اللاتيني",
      typeArabic: "الخط العربي",
      typeDesc: `تم اختيار ${enFont?.name || "خط"} للنصوص اللاتينية و${arFont?.name || "خط"} للنصوص العربية. ${sector.typeNote.ar}`,
      typeHierarchy: "التسلسل الهرمي",
      heading: "عنوان رئيسي",
      subheading: "عنوان فرعي",
      body: "نص أساسي يُقرأ بسهولة على الشاشة والمطبوعات.",
      weights: ["عادي", "متوسط", "شبه عريض", "عريض", "عريض جدًا"],
      applications: "التطبيقات",
      applicationsSub: "الهوية في الاستخدام الفعلي",
      appFallback: ["بطاقة الأعمال", "منشور اجتماعي", "المراسلات"],
      rules: "قواعد الاستخدام",
      rulesSub: "حافظ على سلامة الشعار",
      dont: ["لا تمدّد الشعار", "لا تُدِره", "لا تضف تأثيرات", "لا تضعه على خلفية ضعيفة التباين"],
      doTitle: ["استخدم الشعار المعتمد", "احمِ مساحة الأمان", "التزم بالألوان المعتمدة"],
      doText: [
        "ابدأ دائمًا من ملف الشعار الأصلي المعتمد دون إعادة رسم.",
        "حافظ على فراغ كافٍ حول الشعار في كل تطبيق.",
        "استخدم قيم HEX المعتمدة بدلًا من ألوان تقريبية من لقطات الشاشة.",
      ],
      closing: "الاتساق يصنع التعرّف",
      closingSub: "كل تفصيلة تظهر بها العلامة هي فرصة لتأكيد هويتها.",
      contact: "للتواصل",
      generated: "أُنشئ بواسطة EYAD AI",
      essence: sector.essence.ar,
      fontSerifNote: "",
      cat: enCat,
    };
  }
  return {
    guidelines: "Brand Guidelines",
    story: "Brand Story",
    storyTitle: name,
    storyBody: [
      act
        ? `${name} is a ${act} brand. Its visual identity was designed to express that craft clearly, confidently and consistently.`
        : `${name} is built on a visual identity designed to deliver a clear, professional presence at every touchpoint.`,
      `The identity combines ${tone} colours, a bilingual type system and a single logo that carries the same personality across digital platforms and print.`,
    ],
    industry: "Sector",
    activityLabel: "Activity",
    toneLabel: "Colour mood",
    pillarsTitle: "Brand Pillars",
    logo: "Logo",
    logoSub: "Construction & clear space",
    clearSpace: "Clear space",
    clearSpaceText: "Keep a free zone around the logo equal to one quarter of the mark's height. Never place text or graphics inside it.",
    versions: "Logo versions",
    onLight: "On light",
    onDark: "On dark",
    onAccent: "On accent",
    colors: "Color Palette",
    colorsSub: "Approved values for screen and print",
    colorNote: "CMYK values are approximate references; always proof a printed sample before production.",
    ratio: "Suggested usage ratio",
    roles: ["Primary", "Secondary", "Accent", "Surface", "Ink"],
    roleDerived: "derived",
    typography: "Typography",
    typeLatin: "Latin typeface",
    typeArabic: "Arabic typeface",
    typeDesc: `${enFont?.name || "The selected typeface"} (${enCat}) leads Latin text and ${arFont?.name || "the selected typeface"} leads Arabic text. ${sector.typeNote.en}`,
    typeHierarchy: "Hierarchy",
    heading: "Heading",
    subheading: "Subheading",
    body: "Body copy that stays easy to read on screen and in print.",
    weights: ["Regular", "Medium", "Semi Bold", "Bold", "Extra Bold"],
    applications: "Applications",
    applicationsSub: "The identity in real use",
    appFallback: ["Business card", "Social post", "Stationery"],
    rules: "Usage Rules",
    rulesSub: "Protect the integrity of the logo",
    dont: ["Don't stretch", "Don't rotate", "Don't add effects", "Don't use low contrast"],
    doTitle: ["Use approved artwork", "Protect clear space", "Stay on palette"],
    doText: [
      "Always start from the approved logo file and never redraw it.",
      "Keep generous breathing room around the logo in every application.",
      "Use the documented HEX values instead of colours sampled from screenshots.",
    ],
    closing: "Consistency builds recognition",
    closingSub: "Every appearance of the brand is a chance to reinforce who it is.",
    contact: "Contact",
    generated: "Generated with EYAD AI",
    essence: sector.essence.en,
    fontSerifNote: "",
    cat: enCat,
  };
}

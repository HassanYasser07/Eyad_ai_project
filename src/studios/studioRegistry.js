/**
 * EYAD AI — Studio Registry
 * The seven primary product sections shown in the intro and shared by the app.
 */
export const studioRegistry = [
  {
    id: "logo",
    name: { en: "Logo Studio", ar: "ستوديو الشعارات" },
    description: { en: "Design and refine brand logos.", ar: "تصميم وتطوير شعارات العلامات." },
    icon: "Shapes",
    accent: "#2563eb",
    status: "active",
    route: "/studios/logo",
  },
  {
    id: "brand-kit",
    name: { en: "Visual Identity Studio", ar: "ستوديو الهوية البصرية" },
    description: { en: "Build a complete visual identity.", ar: "إنشاء هوية بصرية متكاملة." },
    icon: "Palette",
    accent: "#8b5cf6",
    status: "active",
    route: "/studios/brand-kit",
  },
  {
    id: "company-profile",
    name: { en: "Company Profile Studio", ar: "ستوديو بروفايل الشركة" },
    description: { en: "Create polished company profiles.", ar: "إنشاء بروفايل احترافي للشركة." },
    icon: "BriefcaseBusiness",
    accent: "#0ea5e9",
    status: "placeholder",
    route: "/studios/company-profile",
  },
  {
    id: "ai-images",
    name: { en: "AI Images Studio", ar: "ستوديو الصور" },
    description: { en: "Create images from your ideas.", ar: "إنشاء صور من أفكارك." },
    icon: "Image",
    accent: "#14b8a6",
    status: "active",
    route: "/studios/ai-images",
  },
  {
    id: "video",
    name: { en: "Video Studio", ar: "ستوديو الفيديو" },
    description: { en: "Create and edit video content.", ar: "إنشاء وتحرير محتوى الفيديو." },
    icon: "Video",
    accent: "#f97316",
    status: "active",
    route: "/studios/video",
  },
  {
    id: "presentations",
    name: { en: "Presentation Studio", ar: "ستوديو العروض التقديمية" },
    description: { en: "Build presentation decks with AI.", ar: "إنشاء عروض تقديمية بالذكاء الاصطناعي." },
    icon: "Presentation",
    accent: "#6366f1",
    status: "placeholder",
    route: "/studios/presentations",
  },
  {
    id: "templates",
    name: { en: "Templates Studio", ar: "ستوديو القوالب" },
    description: { en: "Create AI templates, use ready templates, and manage your own templates.", ar: "إنشاء قوالب بالذكاء الاصطناعي واستخدام القوالب الجاهزة وإدارة قوالبك." },
    icon: "LayoutTemplate",
    accent: "#0ea5e9",
    status: "active",
    route: "/studios/templates",
  },
  {
    id: "marketplace",
    name: { en: "Marketplace", ar: "السوق" },
    description: { en: "Discover and share creative assets.", ar: "اكتشاف ومشاركة الأصول الإبداعية." },
    icon: "Store",
    accent: "#ec4899",
    status: "placeholder",
    route: "/studios/marketplace",
  },
];

// The chat router (an LLM) may answer with a loose id such as "presentation" or "powerpoint". Map those to the real
// studio id so the user never lands on "Studio not found".
const STUDIO_ALIASES = {
  presentation: "presentations", presentations: "presentations", "presentation-studio": "presentations", presentation_studio: "presentations",
  slides: "presentations", deck: "presentations", pptx: "presentations", powerpoint: "presentations", ppt: "presentations",
  logos: "logo", "logo-studio": "logo", logo_studio: "logo",
  brand: "brand-kit", "brand-identity": "brand-kit", brand_identity: "brand-kit", "visual-identity": "brand-kit", visual_identity: "brand-kit", brandkit: "brand-kit", brand_kit: "brand-kit", identity: "brand-kit",
  "company_profile": "company-profile", companyprofile: "company-profile", profile: "company-profile",
  image: "ai-images", images: "ai-images", ai_images: "ai-images", "ai-image": "ai-images", aiimages: "ai-images",
  videos: "video", "video-studio": "video",
  template: "templates", "template-studio": "templates",
};

export const resolveStudioId = (id) => {
  const key = String(id ?? "").trim().toLowerCase();
  if (!key) return null;
  return STUDIO_ALIASES[key] || key;
};

export const getStudioById = (id) => {
  const resolved = resolveStudioId(id);
  return studioRegistry.find((studio) => studio.id === resolved);
};

export default studioRegistry;
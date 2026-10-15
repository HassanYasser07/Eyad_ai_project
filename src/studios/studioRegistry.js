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

export const getStudioById = (id) =>
  studioRegistry.find((studio) => studio.id === id);

export default studioRegistry;
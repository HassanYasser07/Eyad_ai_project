import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon, MessageSquare, LayoutGrid, Folder, Search, User, Mic,
  MoreHorizontal, Crown, Plus, Languages, Bell, LifeBuoy, ChevronDown,
  ChevronLeft, Sparkles, FileText, Palette, Wand2, HeartPulse, Building2,
  Gem, Dumbbell, ShoppingBag, Utensils, Cpu, Store, MoreVertical, Check,
  ArrowRight, Download, Layers3, CircleCheck, Clock3, BadgeCheck, Lightbulb,
  Workflow, FileCheck2, Boxes, FileCode2, Minus, Landmark, Zap, PenTool, Shapes, Hourglass
} from "lucide-react";
import Logo from "@/components/Logo";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import "./logoStudioDesktop.css";

const PRIMARY_NAV = [
  { to: "/home", key: "nav.home", icon: HomeIcon },
  { to: "/chat", key: "nav.chat", icon: MessageSquare },
  { to: "/studios", key: "nav.studios", icon: LayoutGrid },
  { to: "/projects", key: "nav.myprojects", icon: Folder },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/account", key: "nav.myaccount", icon: User },
];
const SECONDARY_NAV = [
  { to: "/chat", key: "nav.voice", icon: Mic },
  { to: "/studios", key: "nav.more", icon: MoreHorizontal },
];

const HERO_VISUAL = "/images/studios/logo-studio.png";
const HERO_BANNER_RTL = "/images/logo-studio/hero-banner-rtl.png";
const HERO_BANNER_LTR = "/images/logo-studio/hero-banner-ltr.png";

const INDUSTRIES = [
  ["tech", "تقنية", Cpu],
  ["food", "مطاعم ومقاهي", Utensils],
  ["ecommerce", "متاجر إلكترونية", ShoppingBag],
  ["retail", "تجزئة", Store],
  ["fitness", "رياضة ولياقة", Dumbbell],
  ["beauty", "تجميل وأزياء", Gem],
  ["realestate", "عقار", Building2],
  ["health", "صحة وطب", HeartPulse],
  ["other", "أخرى", MoreVertical],
];

const FEATURES = [
  ["ai", "تعديلات بالذكاء الاصطناعي", "تطوير وتحسين مستمر", Sparkles],
  ["print", "ملفات جاهزة للطباعة", "PNG, SVG, PDF, AI", FileText],
  ["colors", "ألوان وخطوط مخصصة", "بما يناسب هويتك التجارية", Palette],
  ["styles", "شعارات متعددة الأنماط", "حديث، كلاسيكي، إبداعي والمزيد", Wand2],
];

const TEMPLATE_LOGOS = [
  ["Leafy", "COFFEE SHOP", "leafy"],
  ["NUR", "BEAUTY", "nur"],
  ["TechFlow", "SOLUTIONS", "techflow"],
  ["URBAN", "REAL ESTATE", "urban"],
  ["VITAL", "HEALTH CARE", "vital"],
];

const MODERN_LOGOS = [
  ["AROMA", "COFFEE", "aroma"],
  ["PulseFit", "", "pulse"],
  ["Bloom", "BEAUTY CARE", "bloom"],
  ["NEXUS", "TECHNOLOGY", "nexus"],
  ["SkyBuild", "CONSTRUCTION", "sky"],
];

const INDUSTRY_EXAMPLES = [
  ["Roasto", "Cafe & Restaurant", "aroma"],
  ["LUNA", "Fashion & Beauty", "bloom"],
  ["NEXUS", "Technology", "nexus"],
  ["SKYLINE", "Real Estate", "sky"],
  ["PulseFit", "Fitness & Sports", "pulse"],
  ["VITAL", "Health & Medical", "vital"],
];

function LogoMock({ item, interactive = false }) {
  const [name, sub, type] = item;
  return (
    <div className={"logo-reference-card logo-ref-" + type + (interactive ? " is-interactive" : "")}>
      <div className="logo-reference-mark">
        {type === "leafy" && <span className="leaf-mark">◆</span>}
        {type === "nur" && <span className="arabic-mark">نور</span>}
        {type === "techflow" && <span className="tf-mark">T</span>}
        {type === "urban" && <span className="urban-mark">⌂</span>}
        {type === "vital" && <span className="vital-mark">✦</span>}
        {type === "aroma" && <span className="aroma-mark">☕</span>}
        {type === "pulse" && <span className="pulse-mark">◈</span>}
        {type === "bloom" && <span className="bloom-mark">✿</span>}
        {type === "nexus" && <span className="nexus-mark">N</span>}
        {type === "sky" && <span className="sky-mark">⌂</span>}
      </div>
      <strong>{name}</strong>
      {sub && <small>{sub}</small>}
      {interactive && <span className="logo-card-arrow"><ArrowRight/></span>}
    </div>
  );
}

// Parses prompts like "logo for Faragany for chicken" into { brandName, activity }.
function parseBrief(value = "") {
  const text = String(value).trim();
  if (!text) return { brandName: "", activity: "" };
  const match = text
    .replace(/^(?:من فضلك\s+)?(?:عايز|عاوز|أريد|اريد|صمم|تصميم)\s+/i, "")
    .replace(/^(?:اعمل|إنشاء|انشاء)\s+/i, "")
    .replace(/^(?:شعار|لوجو|logo)\s+/i, "")
    .trim()
    .match(/^(.+?)\s+(?:لـ|ل|for)\s*(.+)$/i);
  if (!match || !match[1].trim() || !match[2].trim()) return { brandName: "", activity: "" };
  const brandName = match[1].trim().replace(/[،,.!?؟]+$/, "");
  let activity = match[2].trim().replace(/[،,.!?؟]+$/, "");
  if (!/^ال/.test(activity) && /^ل/.test(activity)) activity = "ال" + activity.slice(1);
  return { brandName, activity };
}

const STYLE_CARDS = [
  { id: "modern", ar: "حديث وعصري", en: "Modern", descAr: "متوازن ومعاصر", descEn: "Clean & current", Icon: Sparkles, color: "blue" },
  { id: "minimal", ar: "بسيط", en: "Minimal", descAr: "أقل عناصر وأكثر وضوحًا", descEn: "Simple & clear", Icon: Minus, color: "slate" },
  { id: "luxury", ar: "فاخر", en: "Luxury", descAr: "أناقة وتفاصيل راقية", descEn: "Elegant & premium", Icon: Crown, color: "gold" },
  { id: "classic", ar: "كلاسيكي", en: "Classic", descAr: "ثابت وخالد", descEn: "Timeless", Icon: Landmark, color: "navy" },
  { id: "bold", ar: "جريء", en: "Bold", descAr: "قوي ولافت", descEn: "Strong & striking", Icon: Zap, color: "red" },
  { id: "creative", ar: "إبداعي", en: "Creative", descAr: "حر ومختلف", descEn: "Expressive", Icon: Palette, color: "purple" },
  { id: "hand-drawn", ar: "مرسوم يدويًا", en: "Hand-drawn", descAr: "لمسة بشرية", descEn: "Personal touch", Icon: PenTool, color: "teal" },
  { id: "geometric", ar: "هندسي", en: "Geometric", descAr: "أشكال دقيقة", descEn: "Structured forms", Icon: Shapes, color: "cyan" },
  { id: "vintage", ar: "ريترو", en: "Vintage", descAr: "روح كلاسيكية", descEn: "Heritage feel", Icon: Hourglass, color: "brown" },
  { id: "eyad-decides", ar: "اختيار إياد", en: "AI Decides", descAr: "أفضل اتجاه لفكرتك", descEn: "Best fit for your idea", Icon: Wand2, color: "gradient" },
];

const PALETTE_CARDS = [
  { id: "blue", ar: "أزرق احترافي", en: "Professional Blue", noteAr: "ثقة واستقرار", noteEn: "Trust & stability", swatches: ["#0866C6", "#2798F2", "#B5DAFF"] },
  { id: "green", ar: "أخضر طبيعي", en: "Natural Green", noteAr: "نمو وحيوية", noteEn: "Growth & vitality", swatches: ["#087A50", "#18B96B", "#B6E7CF"] },
  { id: "purple", ar: "بنفسجي إبداعي", en: "Creative Purple", noteAr: "ابتكار وتميز", noteEn: "Innovation", swatches: ["#4C16C8", "#8A55F5", "#DCCBFF"] },
  { id: "sunset", ar: "أحمر قوي", en: "Power Red", noteAr: "طاقة وشغف", noteEn: "Energy & passion", swatches: ["#D71920", "#F45D63", "#FFC4C6"] },
  { id: "orange", ar: "برتقالي دافئ", en: "Warm Orange", noteAr: "حماس وإيجابية", noteEn: "Warm & positive", swatches: ["#F47716", "#FFAA45", "#FFE0B9"] },
  { id: "gold", ar: "ذهبي فاخر", en: "Luxury Gold", noteAr: "فخامة ورقي", noteEn: "Premium & refined", swatches: ["#D99A08", "#F6C84B", "#FFF0B9"] },
  { id: "pink", ar: "وردي عصري", en: "Modern Pink", noteAr: "أنوثة وأناقة", noteEn: "Soft & stylish", swatches: ["#D81B72", "#F45BA4", "#FFD0E5"] },
  { id: "earth", ar: "ترابي طبيعي", en: "Natural Earth", noteAr: "استدامة ودفء", noteEn: "Warm & grounded", swatches: ["#8A6247", "#B99A83", "#E9D9CB"] },
  { id: "mono", ar: "رمادي متوازن", en: "Balanced Gray", noteAr: "احترافية وحيادية", noteEn: "Neutral & pro", swatches: ["#292D32", "#8B929B", "#E3E6EA"] },
  { id: "vibrant", ar: "متعدد الألوان", en: "Vibrant Mix", noteAr: "إبداع بلا حدود", noteEn: "Playful & bold", swatches: ["#7C3AED", "#0EA5E9", "#10B981", "#F59E0B"] },
];

export default function LogoStudioDesktop({
  step, setStep, name, setName, activity, setActivity, selections, updateSelection,
  generate, loading, canGenerate, isAnonymous, images, selectedImage, selectedIndex, setSelectedImage,
  approve, approved, error, back, onSelectImage, onOpenSvgEditor, approvedActions,
}) {
  const { t, direction, toggleLanguage } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ar = direction === "rtl";
  // When Chat routes a desktop user here, prefill the exact prompt they entered.
  // This state is isolated to the desktop studio component; mobile is unchanged.
  const [brief, setBrief] = React.useState(() => new URLSearchParams(location.search).get("brief") || "");
  const [industry, setIndustry] = React.useState("");
  const [formError, setFormError] = React.useState("");
  // Typing "logo for X for Y" in the brief auto-fills the brand name and activity.
  React.useEffect(() => {
    if (!brief.trim()) return;
    const parsed = parseBrief(brief);
    if (!name.trim() && parsed.brandName) setName(parsed.brandName);
    if (!activity.trim() && parsed.activity) setActivity(parsed.activity);
  }, [brief, name, activity, setName, setActivity]);
  const [showMoreColors, setShowMoreColors] = React.useState(false);

  const chooseIndustry = (value) => {
    setIndustry(value);
    setActivity(value);
  };

  const chooseColor = (value) => updateSelection("colors", value);
  const styleOptions = [
    ["modern", ar ? "حديث وعصري" : "Modern"],
    ["minimal", ar ? "بسيط (مينيمال)" : "Minimal"],
    ["luxury", ar ? "فاخر" : "Luxury"],
    ["classic", ar ? "كلاسيكي" : "Classic"],
    ["bold", ar ? "جريء" : "Bold"],
    ["eyad-decides", ar ? "إياد يقرر" : "EYAD decides"],
  ];
  const extraColorOptions = [
    ["mono", ar ? "أحادي" : "Monochrome", ["#27303A", "#7D8792", "#F4F6F8"]],
    ["earth", ar ? "ترابي" : "Earth", ["#70451F", "#B8894E", "#F1D3A2"]],
    ["cyan", ar ? "سماوي" : "Cyan", ["#087DAA", "#00C7EE", "#8BE9FF"]],
    ["navy-gold", ar ? "كحلي وذهبي" : "Navy & Gold", ["#123B82", "#D3A53A", "#F5D99B"]],
  ];

  const startNow = () => {
    window.setTimeout(() => document.getElementById("logo-desktop-brief")?.focus(), 0);
  };

  const createFromBrief = () => {
    setFormError("");
    const text = brief.trim();
    const parsed = parseBrief(text);
    const finalName = name.trim() || parsed.brandName;
    const finalActivity = activity.trim() || industry || parsed.activity || text;
    if (!finalName) {
      setFormError(ar ? "اكتب اسم الشركة أو العلامة التجارية أولًا." : "Enter the company or brand name first.");
      document.getElementById("logo-desktop-brand-name")?.focus();
      return;
    }
    if (!finalActivity) {
      setFormError(ar ? "اكتب نشاط الشركة أولًا." : "Enter the business activity first.");
      document.getElementById("logo-desktop-activity")?.focus();
      return;
    }
    const finalSelections = {
      ...selections,
      style: selections.style || "modern",
      colors: selections.colors || "blue",
      logo_type: selections.logo_type || "symbol-wordmark",
    };
    setName(finalName);
    setActivity(finalActivity);
    setStep("choices");
    generate({ name: finalName, activity: finalActivity, selections: finalSelections });
  };

  return (
    <div className="logo-desktop-shell" dir="ltr">
      <aside className="logo-desktop-sidebar" dir={direction}>
        <Link to="/home" className="logo-desktop-brand"><Logo variant="full" className="logo-desktop-brand-img" /></Link>
        <nav className="logo-desktop-nav">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} to={item.to} className={"logo-desktop-nav-item " + (location.pathname === item.to || (item.to === "/studios" && location.pathname.startsWith("/studios")) ? "is-active" : "")}><Icon/><span>{t(item.key)}</span></Link>;
          })}
        </nav>
        <div className="logo-desktop-divider"/>
        <div className="logo-desktop-label">{ar ? "أدوات إضافية" : "EXTRA TOOLS"}</div>
        <nav className="logo-desktop-nav">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} to={item.to} className="logo-desktop-nav-item"><Icon/><span>{t(item.key)}</span></Link>;
          })}
        </nav>
        <Link to="/account" className="logo-desktop-credits">
          <div><Crown/><span>{t("nav.credits")}</span></div>
          <strong>320 <span><Plus/></span></strong>
        </Link>
        <div className="logo-desktop-support"><LifeBuoy/><span>{t("nav.support")}</span></div>
      </aside>

      <div className="logo-desktop-main" dir={direction}>
        <header className="logo-desktop-header">
          <button className="logo-desktop-search" onClick={() => navigate("/search")}><Search/><span>{ar ? "ابحث في الاستوديوهات، المشاريع، القوالب..." : "Search studios, projects, templates..."}</span></button>
          <div className="logo-desktop-actions">
            <button className="logo-desktop-lang" onClick={toggleLanguage}><Languages/><b>{ar ? "AR" : "EN"}</b><ChevronDown/></button>
            <button className="logo-desktop-icon" aria-label="Notifications"><Bell/><i/></button>
            <Link to="/account" className="logo-desktop-user"><span>{(user?.full_name || user?.email || "A").charAt(0).toUpperCase()}</span><b>{user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "EYAD"}</b><ChevronDown/></Link>
          </div>
        </header>

        <main className="logo-desktop-content">
          <div className="logo-desktop-breadcrumb"><Link to="/studios">{ar ? "الاستوديوهات" : "Studios"}</Link><ChevronLeft/><strong>{ar ? "استوديو الشعارات" : "Logo Studio"}</strong></div>

          <section className="logo-desktop-hero logo-desktop-hero-unified">
            <div className="logo-desktop-hero-image"><img src={ar ? HERO_BANNER_RTL : HERO_BANNER_LTR} alt="" /></div>
            <div className="logo-desktop-hero-copy">
              <span className="logo-desktop-pill">{ar ? "استوديو الشعارات" : "Logo Studio"}</span>
              <h1>{ar ? "صمم شعاراً احترافياً لهويتك" : "Design a professional logo for your brand"}</h1>
              <p>{ar ? "حوّل فكرتك إلى شعار مميز يعبر عن علامتك التجارية بالذكاء الاصطناعي." : "Turn your idea into a distinctive logo that represents your brand with AI."}</p>
              <button className="logo-desktop-primary" onClick={startNow}><Wand2/>{ar ? "ابدأ تصميم الشعار" : "Start designing"}</button>
            </div>
          </section>

          <section className="logo-desktop-quick logo-desktop-quick-first">
            <div className="logo-desktop-section-title">
              <div>
                <h2>{ar ? "ابدأ بفكرة سريعة" : "Start with a quick idea"}</h2>
                <p>{ar ? "اختر نوع النشاط أو المجال، وسيساعدك الذكاء الاصطناعي في إنشاء اتجاه قوي." : "Pick an industry and let AI help you create a strong direction."}</p>
              </div>
            </div>
            <div className="logo-desktop-industries">
              {INDUSTRIES.map(([id,label,Icon]) => <button key={id} className={industry === label ? "selected" : ""} onClick={() => chooseIndustry(label)}><Icon/><b>{ar ? label : ({tech:"Technology",food:"Restaurants & Cafes",ecommerce:"Online Stores",retail:"Retail",fitness:"Sports & Fitness",beauty:"Beauty & Fashion",realestate:"Real Estate",health:"Health & Medical",other:"More"}[id])}</b></button>)}
            </div>
          </section>

          <section className="logo-desktop-prompt card">
            <div className="logo-desktop-prompt-head">
              <h2>{ar ? "أو اكتب فكرتك بنفسك" : "Or write your idea"}</h2>
              <span>{brief.length}</span>
            </div>
            <p className="logo-desktop-prompt-sub">{ar ? "راجع بيانات العلامة وعدّلها قبل إنشاء الشعار." : "Review your brand details and edit them before generating the logo."}</p>
            <div className="logo-desktop-brand-fields" dir={direction}>
              <label className="logo-desktop-brand-field" htmlFor="logo-desktop-brand-name">
                <span>{ar ? "اسم الشركة / العلامة التجارية" : "Company / brand name"}</span>
                <input id="logo-desktop-brand-name" value={name} onChange={e => { setName(e.target.value); setFormError(""); }} placeholder={ar ? "مثال: فرجاني" : "e.g. Faragany"} autoComplete="organization"/>
              </label>
              <label className="logo-desktop-brand-field" htmlFor="logo-desktop-activity">
                <span>{ar ? "نشاط الشركة" : "Business activity"}</span>
                <input id="logo-desktop-activity" value={activity} onChange={e => { setActivity(e.target.value); setIndustry(""); setFormError(""); }} placeholder={ar ? "مثال: الدجاج والوجبات" : "e.g. Chicken & food"}/>
              </label>
            </div>
            <p className="logo-desktop-prompt-sub">{ar ? "وصف إضافي للتصميم (اختياري)" : "Additional design brief (optional)"}</p>
            <textarea id="logo-desktop-brief" value={brief} onChange={e => { setBrief(e.target.value); setFormError(""); }} placeholder={ar ? "مثال: شعار عصري واضح، مناسب للواجهة والتغليف..." : "Example: A clean modern logo for storefront and packaging..."}/>

            <section className="logo-desktop-choice-section" aria-labelledby="logo-desktop-styles-heading">
              <div className="logo-desktop-choice-heading">
                <div>
                  <span className="logo-desktop-choice-kicker">{ar ? "اختر الاتجاه البصري" : "PICK YOUR DIRECTION"}</span>
                  <h3 id="logo-desktop-styles-heading">{ar ? "أسلوب التصميم" : "Design style"}</h3>
                  <p>{ar ? "10 أساليب مميزة — اختر الشكل الأقرب لشخصية علامتك." : "10 distinctive styles — choose the direction that fits your brand."}</p>
                </div>
                <span className="logo-desktop-choice-count">10 {ar ? "أساليب" : "styles"}</span>
              </div>
              <div className="logo-desktop-style-cards">
                {STYLE_CARDS.map(({ id, ar: labelAr, en, descAr, descEn, Icon, color }) => (
                  <button type="button" key={id} className={`logo-desktop-style-card tone-${color} ${selections.style === id ? "is-selected" : ""}`} aria-pressed={selections.style === id} onClick={() => updateSelection("style", id)}>
                    <span className="logo-desktop-style-icon"><Icon/></span>
                    <strong>{ar ? labelAr : en}</strong>
                    <small>{ar ? descAr : descEn}</small>
                    {selections.style === id && <span className="logo-desktop-selected-check"><Check/></span>}
                  </button>
                ))}
              </div>
            </section>

            <section className="logo-desktop-choice-section logo-desktop-palette-section" aria-labelledby="logo-desktop-palettes-heading">
              <div className="logo-desktop-choice-heading">
                <div>
                  <span className="logo-desktop-choice-kicker">{ar ? "ألوان تعكس هوية علامتك" : "COLORS THAT DEFINE YOUR BRAND"}</span>
                  <h3 id="logo-desktop-palettes-heading">{ar ? "الألوان المفضلة" : "Preferred colors"}</h3>
                  <p>{ar ? "اختر مجموعة لونية متناسقة لتوجيه تصميم الشعار." : "Choose a coordinated palette to guide your logo design."}</p>
                </div>
                <span className="logo-desktop-choice-count">10 {ar ? "مجموعات" : "palettes"}</span>
              </div>
              <div className="logo-desktop-palette-cards">
                {PALETTE_CARDS.map(({ id, ar: labelAr, en, noteAr, noteEn, swatches }) => (
                  <button type="button" key={id} className={`logo-desktop-palette-card ${selections.colors === id ? "is-selected" : ""}`} aria-pressed={selections.colors === id} onClick={() => chooseColor(id)}>
                    <span className="logo-desktop-palette-swatches">{swatches.map((color, i) => <i key={`${color}-${i}`} style={{ backgroundColor: color }}/>)}</span>
                    <strong>{ar ? labelAr : en}</strong>
                    <small>{ar ? noteAr : noteEn}</small>
                    {selections.colors === id && <span className="logo-desktop-selected-check"><Check/></span>}
                  </button>
                ))}
              </div>
            </section>

            <div className="logo-desktop-prompt-controls logo-desktop-prompt-controls-final" dir="ltr">
              <button type="button" className={`logo-desktop-generate logo-desktop-prompt-cta ${loading ? "is-generating" : ""}`} disabled={loading} aria-busy={loading} onClick={createFromBrief}>
                <Sparkles/>{loading ? (ar ? "جاري إنشاء الشعار..." : "Generating logos...") : (ar ? "إنشاء الشعارات" : "Create logos")}
              </button>
              <div className="logo-desktop-selected-summary" dir={direction}>
                <span>{ar ? "اختياراتك" : "Your selections"}</span>
                <strong>{ar ? (STYLE_CARDS.find(i => i.id === selections.style)?.ar || "حديث وعصري") : (STYLE_CARDS.find(i => i.id === selections.style)?.en || "Modern")}</strong>
                <em>{ar ? (PALETTE_CARDS.find(i => i.id === selections.colors)?.ar || "أزرق احترافي") : (PALETTE_CARDS.find(i => i.id === selections.colors)?.en || "Professional Blue")}</em>
              </div>
            </div>
            {(formError || error) && <div className="logo-desktop-error" role="alert">{formError || error}</div>}
            <div className="logo-desktop-svg-test-row">
              <div><FileCode2 aria-hidden="true"/><span>{t("svgEditor.entryHint")}</span></div>
              <button type="button" onClick={onOpenSvgEditor}><FileCode2 aria-hidden="true"/>{t("svgEditor.testEnvironment")}</button>
            </div>
            {isAnonymous && <small className="logo-desktop-note">{ar ? "سيطلب منك تسجيل الدخول عند بدء التوليد." : "Sign in will be required when generation starts."}</small>}
          </section>

          <section className="logo-desktop-templates">
            <div className="logo-desktop-gallery-head">
              <div><h2>{ar ? "قوالب مقترحة" : "Suggested templates"}</h2><p>{ar ? "ابدأ من قالب وعدّل عليه ليناسب هويتك." : "Start from a template and customize it for your brand."}</p></div>
              <button type="button">{ar ? "عرض الكل" : "View all"} <ChevronLeft/></button>
            </div>
            <div className="logo-desktop-logo-row logo-desktop-template-row">{TEMPLATE_LOGOS.map(item=><LogoMock key={item[0]} item={item} interactive/>)}</div>
          </section>

          {(step === "choices" || step === "generating" || step === "results") && (
            <section className="logo-desktop-advanced card">
              <div className="logo-desktop-advanced-head"><div><b>{ar ? "مسار التصميم المتقدم" : "Advanced logo workflow"}</b><span>{name} · {activity}</span></div><button onClick={back}>{ar ? "رجوع" : "Back"}</button></div>
              {step === "choices" && <div className="logo-desktop-advanced-actions"><button onClick={generate} disabled={!canGenerate || loading}><Sparkles/>{ar ? "توليد الآن" : "Generate now"}</button><span>{canGenerate ? "✓" : ""}</span></div>}
              {step === "generating" && <div className="logo-desktop-status"><Sparkles/><b>{ar ? "إياد يصمم الشعار الآن..." : "EYAD is designing your logo..."}</b></div>}
              {step === "results" && <div className="logo-desktop-results">{images.slice(0,2).map((image,index)=>{const id="concept-"+index; const selected=selectedIndex===index; const selectConcept=()=>{const selectHandler=typeof setSelectedImage==="function"?setSelectedImage:onSelectImage; if(typeof selectHandler==="function") selectHandler(index);}; return <button type="button" key={String(id)} aria-pressed={selected} aria-label={ar?`اختيار الشعار ${index+1}`:`Select logo ${index+1}`} className={"logo-desktop-result "+(selected?"selected":"")} onClick={selectConcept}><img src={image.data_url||image.url} alt={ar?`الشعار المقترح ${index+1}`:`Generated logo ${index+1}`} draggable="false"/><span aria-hidden="true">{selected?"✓":""}</span><strong>{ar?`الشعار ${index+1}`:`Logo ${index+1}`}</strong></button>})}{!approved && <div className="logo-desktop-result-actions"><button type="button" className="logo-desktop-regenerate" disabled={loading} onClick={generate}><Sparkles/>{loading?(ar?"جاري التوليد...":"Generating..."):(ar?"توليد مرة أخرى":"Generate again")}</button><button type="button" className="logo-desktop-approve logo-desktop-approve-gradient" disabled={!selectedImage||loading} onClick={approve}>{ar?"اعتماد الشعار":"Approve logo"}</button></div>}{approved && <div style={{gridColumn:"1 / -1"}}><button type="button" className="logo-desktop-approve" disabled style={{width:"100%",marginBottom:12}}>{ar?"تم اعتماد الشعار":"Logo approved"}</button>{approvedActions}</div>}</div>}
            </section>
          )}

          <section className="logo-desktop-story logo-desktop-story-process">
            <div className="logo-desktop-story-heading"><span className="logo-desktop-eyebrow">{ar ? "كيف يعمل إياد؟" : "HOW EYAD WORKS"}</span><h2>{ar ? "من الفكرة إلى شعار احترافي في دقائق" : "From idea to a professional logo in minutes"}</h2><p>{ar ? "عملية واضحة وبسيطة تساعدك على تحويل فكرتك إلى هوية بصرية قابلة للاستخدام." : "A simple workflow that turns your idea into a visual identity you can actually use."}</p></div>
            <div className="logo-desktop-process-grid">
              <article><span>1</span><Lightbulb/><h3>{ar ? "شارك فكرتك" : "Share your idea"}</h3><p>{ar ? "أخبر إياد عن نشاطك، جمهورك، والأسلوب الذي تريده." : "Tell EYAD about your business, audience, and preferred direction."}</p></article>
              <article><span>2</span><Sparkles/><h3>{ar ? "إياد يولد الأفكار" : "AI generates concepts"}</h3><p>{ar ? "عدة اتجاهات بصرية مختلفة لتختار منها الأقرب لهويتك." : "Multiple visual directions give you strong options to choose from."}</p></article>
              <article><span>3</span><Workflow/><h3>{ar ? "عدّل وخصص" : "Refine & customize"}</h3><p>{ar ? "اختر المفضل واطلب التعديلات حتى تصل للنتيجة المناسبة." : "Pick your favorite and refine it until it feels right."}</p></article>
              <article><span>4</span><Download/><h3>{ar ? "استخدم النتيجة" : "Download & use"}</h3><p>{ar ? "احصل على مخرجات عالية الجودة جاهزة للاستخدام التجاري." : "Get high-quality outputs ready for your business and marketing."}</p></article>
            </div>
          </section>

          <section className="logo-desktop-benefits">
            <div className="logo-desktop-story-heading centered">
              <span className="logo-desktop-eyebrow">{ar ? "كل ما تحتاجه" : "EVERYTHING YOU NEED"}</span>
              <h2>{ar ? "إياد ينجز شغلك وأنت مرتاح" : "EYAD handles the work while you stay focused"}</h2>
              <p>{ar ? "من الفكرة والتصميم إلى الملفات الجاهزة للاستخدام، في مكان واحد." : "From the first idea to polished, usable files — all in one place."}</p>
            </div>
            <div className="logo-desktop-benefit-grid">
              {[
                [Layers3, ar ? "تنويعات متعددة" : "Multiple variations", ar ? "أفكار واتجاهات متنوعة بدل البدء من الصفر." : "Explore multiple directions instead of starting from zero."],
                [FileCheck2, ar ? "ملفات جاهزة" : "Ready files", ar ? "مخرجات مناسبة للاستخدام الرقمي والطباعة." : "Outputs prepared for digital use and print workflows."],
                [Palette, ar ? "ألوان وخطوط" : "Colors & fonts", ar ? "اقتراحات متناسقة مع شخصية علامتك." : "Coordinated suggestions that match your brand personality."],
                [CircleCheck, ar ? "تعديلات مستمرة" : "Easy revisions", ar ? "استمر في التطوير حتى تصل للنتيجة التي ترضيك." : "Keep refining until the direction feels right."],
                [BadgeCheck, ar ? "جودة احترافية" : "Professional quality", ar ? "نتيجة مصممة لتكون قابلة للاستخدام الفعلي." : "Designed to become a practical business asset."],
              ].map(([Icon,title,desc]) => <article key={title}><span><Icon/></span><h3>{title}</h3><p>{desc}</p></article>)}
            </div>
          </section>

          <section className="logo-desktop-industry-showcase">
            <div className="logo-desktop-gallery-head">
              <div><h2>{ar ? "أمثلة شعارات حسب المجال" : "Logo examples by industry"}</h2><p>{ar ? "أفكار بصرية متنوعة تساعدك على تخيل ما يمكن أن يصنعه إياد." : "Explore visual directions across different business categories."}</p></div>
              <button type="button">{ar ? "عرض الكل" : "View all"} <ChevronLeft/></button>
            </div>
            <div className="logo-desktop-industry-row">
              {INDUSTRY_EXAMPLES.map(item => <LogoMock key={item[0]} item={item} interactive/>)}
            </div>
          </section>

          <section className="logo-desktop-why">
            <div className="logo-desktop-why-image"><img src={HERO_VISUAL} alt="" /></div>
            <div className="logo-desktop-why-copy">
              <span className="logo-desktop-eyebrow">{ar ? "أكثر من مجرد شعار" : "MORE THAN A LOGO"}</span>
              <h2>{ar ? "ابنِ علامتك التجارية بدون تعقيد" : "Build your brand without the complexity"}</h2>
              <p>{ar ? "إياد يساعدك على تحويل الفكرة الأولية إلى اتجاه بصري متكامل، ويوفر عليك الوقت بين الفكرة والتنفيذ." : "EYAD helps turn a rough idea into a clear visual direction, saving the time between thinking, designing, and producing."}</p>
              <div className="logo-desktop-why-points">
                <div><Check/> {ar ? "جودة احترافية" : "Professional quality"}</div>
                <div><Clock3/> {ar ? "توفير الوقت والتكلفة" : "Save time and cost"}</div>
                <div><BadgeCheck/> {ar ? "مناسب لنشاطك" : "Made for your business"}</div>
              </div>
              <button className="logo-desktop-why-cta" onClick={startNow}><Wand2/>{ar ? "ابدأ الآن" : "Start now"}</button>
            </div>
          </section>

          <section className="logo-desktop-final-cta">
            <div><span className="logo-desktop-eyebrow">{ar ? "جاهز تبدأ؟" : "READY TO START?"}</span><h2>{ar ? "فكرتك تستحق شعاراً احترافياً." : "Your idea deserves a professional logo."}</h2><p>{ar ? "ابدأ بفكرة بسيطة، واترك الباقي لإياد." : "Start with a simple idea and let EYAD handle the heavy lifting."}</p></div>
            <button onClick={startNow}><Wand2/>{ar ? "ابدأ تصميم الشعار" : "Start designing"}</button>
          </section>

          {error && <div className="logo-desktop-error">{error}</div>}
        </main>
      </div>
    </div>
  );
}
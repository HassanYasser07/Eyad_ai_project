import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon, MessageSquare, LayoutGrid, Folder, Search, User, Mic,
  MoreHorizontal, Crown, Plus, Languages, Bell, LifeBuoy, ChevronDown,
  ChevronLeft, Sparkles, FileText, Palette, Wand2, HeartPulse, Building2,
  Gem, Dumbbell, ShoppingBag, Utensils, Cpu, Store, MoreVertical, Check,
  ArrowRight, Download, Layers3, CircleCheck, Clock3, BadgeCheck, Lightbulb,
  Workflow, FileCheck2, Boxes, FileCode2
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

const HERO_VISUAL = "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/17181d05c_lOGOSTUDIO.png";
const HERO_BANNER_RTL = "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/9f2db0a91_image4.png";
const HERO_BANNER_LTR = "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/28eb9cd30_generated_image.png";

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

export default function LogoStudioDesktop({
  step, setStep, name, setName, activity, setActivity, selections, updateSelection,
  generate, loading, canGenerate, isAnonymous, images, selectedImage, setSelectedImage,
  approve, approved, error, back, onSelectImage, onOpenSvgEditor,
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
    const idea = brief.trim();
    const selectedIndustry = industry || activity.trim();
    const nextActivity = idea && selectedIndustry && idea !== selectedIndustry
      ? `${idea} (Industry: ${selectedIndustry})`
      : idea || selectedIndustry;
    const nextName = name.trim() || "Brand";
    if (!nextActivity) {
      document.getElementById("logo-desktop-brief")?.focus();
      return;
    }
    setName(nextName);
    setActivity(nextActivity);
    // Provide valid desktop defaults so this CTA always advances into a usable workflow.
    if (!selections.style) updateSelection("style", "modern");
    if (!selections.colors) updateSelection("colors", "blue");
    if (!selections.logo_type) updateSelection("logo_type", "symbol-wordmark");
    setStep("choices");
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
            <p className="logo-desktop-prompt-sub">{ar ? "اكتب نشاطك أو أسلوبك أو أي فكرة تريد أن يظهر بها شعارك." : "Describe your business, style, or any idea you have for your logo."}</p>
            <textarea id="logo-desktop-brief" value={brief} onChange={e=>setBrief(e.target.value)} placeholder={ar ? "مثال: أريد شعاراً لمقهى متخصص في القهوة المختصة، بطابع عصري وحديث..." : "Example: I want a modern logo for a specialty coffee shop..."}/>
            <div className="logo-desktop-prompt-controls">
              <label className="logo-desktop-color-control">
                <span>{ar ? "الألوان المفضلة" : "Preferred colors"}</span>
                <div className="logo-desktop-color-options">
                  <button type="button" aria-label="Blue" title={ar ? "أزرق" : "Blue"} aria-pressed={selections.colors === "blue"} className={`color-dot blue ${selections.colors === "blue" ? "is-selected" : ""}`} onClick={() => chooseColor("blue")}/>
                  <button type="button" aria-label="Purple" title={ar ? "بنفسجي" : "Purple"} aria-pressed={selections.colors === "purple"} className={`color-dot purple ${selections.colors === "purple" ? "is-selected" : ""}`} onClick={() => chooseColor("purple")}/>
                  <button type="button" aria-label="Pink" title={ar ? "وردي" : "Pink"} aria-pressed={selections.colors === "pink"} className={`color-dot pink ${selections.colors === "pink" ? "is-selected" : ""}`} onClick={() => chooseColor("pink")}/>
                  <button type="button" aria-label="Orange" title={ar ? "غروب" : "Sunset"} aria-pressed={selections.colors === "sunset"} className={`color-dot orange ${selections.colors === "sunset" ? "is-selected" : ""}`} onClick={() => chooseColor("sunset")}/>
                  <button type="button" aria-label="Yellow" title={ar ? "ذهبي" : "Gold"} aria-pressed={selections.colors === "navy-gold"} className={`color-dot yellow ${selections.colors === "navy-gold" ? "is-selected" : ""}`} onClick={() => chooseColor("navy-gold")}/>
                  <button type="button" aria-label="Teal" title={ar ? "أخضر" : "Green"} aria-pressed={selections.colors === "green"} className={`color-dot teal ${selections.colors === "green" ? "is-selected" : ""}`} onClick={() => chooseColor("green")}/>
                  <button type="button" aria-label="More colors" aria-expanded={showMoreColors} className={`color-plus ${showMoreColors ? "is-open" : ""}`} onClick={() => setShowMoreColors(value => !value)}>+</button>
                </div>
                {showMoreColors && <div className="logo-desktop-extra-colors">{extraColorOptions.map(([id, label, swatches]) => <button type="button" key={id} className={`logo-desktop-extra-color ${selections.colors === id ? "is-selected" : ""}`} onClick={() => chooseColor(id)} aria-pressed={selections.colors === id}><span>{swatches.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span><b>{label}</b></button>)}</div>}
              </label>
              <label className="logo-desktop-style-control">
                <span>{ar ? "أسلوب التصميم" : "Design style"}</span>
                <div className="logo-desktop-style-select-wrap"><select aria-label={ar ? "أسلوب التصميم" : "Design style"} className="logo-desktop-style-select" value={selections.style || "modern"} onChange={event => updateSelection("style", event.target.value)}>{styleOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><ChevronDown aria-hidden="true"/></div>
              </label>
              <button className="logo-desktop-generate logo-desktop-prompt-cta" disabled={loading} onClick={createFromBrief}><Sparkles/>{ar ? "إنشاء الشعارات" : "Create logos"}</button>
            </div>
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
              {step === "results" && <div className="logo-desktop-results">{images.slice(0,2).map((image,index)=>{const id=image.asset_id||image.id||"variant-"+(index+1); const selected=selectedImage===id; return <button key={id} className={"logo-desktop-result "+(selected?"selected":"")} onClick={()=>onSelectImage(id)}><img src={image.data_url||image.url} alt=""/><span>{selected?"✓":""}</span></button>})}{!approved && <div className="logo-desktop-result-actions"><button className="logo-desktop-regenerate" disabled={loading} onClick={generate}><Sparkles/>{loading?(ar?"جاري التوليد...":"Generating..."):(ar?"توليد مرة أخرى":"Generate again")}</button><button className="logo-desktop-approve logo-desktop-approve-gradient" disabled={!selectedImage||loading} onClick={approve}>{ar?"اعتماد الشعار":"Approve logo"}</button></div>}{approved && <button className="logo-desktop-approve" disabled>{ar?"تم اعتماد الشعار":"Logo approved"}</button>}</div>}
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
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Upload, LayoutTemplate, Wand2, ImagePlus, Download, Check, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { getBrandIdentity } from "@/services/brandService";
import { projectService } from "@/services/projectService";
import { saveStudioOutput } from "@/services/projectContextService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import { supabase } from "@/lib/supabase";
import "./templatesStudio.css";

const READY_TEMPLATES = [
  { id: "business-card", ar: "كارت شخصي", en: "Business Card", type: "Business Card", ratio: "1:1" },
  { id: "social-post", ar: "منشور سوشيال", en: "Social Post", type: "Social Media", ratio: "1:1" },
  { id: "flyer", ar: "فلاير", en: "Flyer", type: "Flyer", ratio: "4:5" },
  { id: "brochure", ar: "بروشور", en: "Brochure", type: "Brochure", ratio: "4:5" },
  { id: "menu", ar: "منيو", en: "Menu", type: "Restaurant Menu", ratio: "4:5" },
  { id: "letterhead", ar: "ليتر هيد", en: "Letterhead", type: "Letterhead", ratio: "4:5" },
];

const TEMPLATE_TYPES = [
  ["social", "سوشيال", "Social"],
  ["flyer", "فلاير", "Flyer"],
  ["brochure", "بروشور", "Brochure"],
  ["menu", "منيو", "Menu"],
];

const TEMPLATE_RATIOS = ["1:1", "4:5", "16:9"];

const READY_CATEGORIES = [
  { id: "business-card", ar: "بزنس كارد", en: "Business Card", type: "Business Card", ratio: "1:1" },
  { id: "social-post", ar: "منشور سوشيال", en: "Social Media", type: "Social Media", ratio: "1:1" },
  { id: "flyer", ar: "فلاير", en: "Flyer", type: "Flyer", ratio: "4:5" },
  { id: "brochure", ar: "بروشور", en: "Brochure", type: "Brochure", ratio: "4:5" },
  { id: "menu", ar: "منيو", en: "Menu", type: "Restaurant Menu", ratio: "4:5" },
  { id: "letterhead", ar: "ليتر هيد", en: "Letterhead", type: "Letterhead", ratio: "4:5" },
];

const READY_VARIANTS = [
  ["Minimal","Classic","Editorial","Bold","Luxury","Monogram","Split","Diagonal","Frame","Dark","Soft","Geometric","Elegant","Modern","Corporate","Creative","Premium","Clean","Studio","Signature"],
  ["Launch","Sale","Offer","Quote","Product","Event","Food","Fashion","Fitness","Real Estate","Tech","Beauty","Coffee","Restaurant","Promo","Announcement","Story","Review","Seasonal","Brand"],
  ["Luxury","Opening","Corporate","Event","Sale","Product","Restaurant","Real Estate","Fitness","Beauty","Fashion","Tech","Minimal","Editorial","Bold","Classic","Premium","Geometric","Modern","Signature"],
  ["Tri Fold","Clean","Editorial","Luxury","Corporate","Product","Services","Restaurant","Real Estate","Tech","Creative","Minimal","Bold","Premium","Modern","Geometric","Photo","Catalog","Agency","Signature"],
  ["Fine Dining","Modern","Classic","Luxury","Cafe","Italian","Arabic","Healthy","Dark","Minimal","Premium","Dessert","Seafood","Breakfast","Brunch","Fast Casual","Bakery","Coffee","Chef","Signature"],
  ["Classic","Minimal","Corporate","Executive","Creative","Modern","Luxury","Bold","Elegant","Clean","Blue","Dark","Soft","Geometric","Agency","Consulting","Legal","Real Estate","Tech","Signature"],
];

const READY_TEMPLATE_DESIGNS = Array.from({ length: 20 }, (_, index) => ({
  index: index + 1,
  variant: index + 1,
  name: READY_VARIANTS[0][index],
}));

const buildReadyTemplates = (category) => {
  const names = READY_VARIANTS[READY_CATEGORIES.findIndex((x) => x.id === category.id)] || READY_VARIANTS[0];
  return names.map((name, index) => ({
    id: category.id + "-" + String(index + 1).padStart(2, "0"),
    number: index + 1,
    name,
    category,
  }));
};

export default function TemplatesStudio() {
  const { loc, direction } = useI18n();
  const { isAnonymous, requireAccount, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const [tab, setTab] = React.useState("ai");
  const [readyCategory, setReadyCategory] = React.useState(null);
  const [selectedReadyTemplate, setSelectedReadyTemplate] = React.useState(null);
  const [customizingReadyTemplate, setCustomizingReadyTemplate] = React.useState(null);
  const [brand, setBrand] = React.useState(null);
  const [businessInfo, setBusinessInfo] = React.useState({ companyName: "", phone: "", email: "", website: "", address: "", description: "" });
  const [prompt, setPrompt] = React.useState("");
  const [type, setType] = React.useState("social");
  const [ratio, setRatio] = React.useState("1:1");
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState("");
  const [myTemplates, setMyTemplates] = React.useState([]);
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    if (!projectId) return;
    getBrandIdentity(projectId).then(setBrand).catch(() => setBrand(null));
    projectService.get(projectId).then((project) => {
      const info = project?.project_data?.mockup_business_info || project?.project_data?.business_info || {};
      setBusinessInfo((current) => ({
        ...current,
        companyName: info.companyName || info.company_name || project?.project_data?.logo_brief?.name || project?.title || "",
        phone: info.phone || info.phoneNumber || "",
        email: info.email || "",
        website: info.website || info.web || "",
        address: info.address || "",
        description: info.description || info.activity || info.businessDescription || "",
      }));
      const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
      if (inheritedPrompt) setPrompt(inheritedPrompt);
    }).catch(() => {});
  }, [projectId]);

  React.useEffect(() => {
    if (!projectId || !user?.id) return;
    let active = true;
    supabase.from("assets").select("id,name,storage_path,mime_type,created_at,metadata")
      .eq("owner_id", user.id).eq("project_id", projectId).eq("kind", "template")
      .order("created_at", { ascending: false }).then(({ data }) => {
        if (!active) return;
        setMyTemplates((data || []).map((item) => ({
          ...item,
          url: item.storage_path ? supabase.storage.from("eyad-assets").getPublicUrl(item.storage_path).data.publicUrl : item.metadata?.asset_url,
        })));
      });
    return () => { active = false; };
  }, [projectId, user?.id]);

  const generate = async () => {
    if (isAnonymous) { requireAccount(); return; }
    if (!prompt.trim()) { setError(loc({ ar: "اكتب وصف القالب أولاً.", en: "Describe the template first." })); return; }
    setGenerating(true); setError(""); setResult(null);
    try {
      const data = await runEyadEngine({
        message: prompt.trim(),
        projectId,
        studioId: "templates",
        language: direction === "rtl" ? "ar" : "en",
        action: "generate",
        referenceImage: brand?.logo?.url || null,
        designOptions: {
          template_generation: true,
          template_type: type,
          aspect_ratio: ratio,
          approved_logo_url: brand?.logo?.url || null,
          brand_name: brand?.brand_name || businessInfo.companyName || "",
          business_info: businessInfo,
          selected_ready_template: customizingReadyTemplate ? { id: customizingReadyTemplate.id, number: customizingReadyTemplate.number, name: customizingReadyTemplate.name, category: customizingReadyTemplate.category?.type, ratio: customizingReadyTemplate.category?.ratio } : null,
          brand_identity: brand || null,
        },
      });
      if (data?.image?.url || data?.image?.data_url) {
        setResult(data.image);
        if (projectId) await saveStudioOutput(projectId, { studioId: "templates", asset: { id: data.image.id || null, url: data.image.url || null, data_url: data.image.data_url || null, generation_id: data.generation_id || data.job_id || null }, approved: false, metadata: { template_type: type, ratio, ready_template: customizingReadyTemplate?.id || null } });
      }
      else if (data?.images?.[0]) {
        setResult(data.images[0]);
        if (projectId) await saveStudioOutput(projectId, { studioId: "templates", asset: { id: data.images[0].id || data.images[0].asset_id || null, url: data.images[0].url || data.images[0].data_url || null, data_url: data.images[0].data_url || null, generation_id: data.generation_id || data.job_id || null }, approved: false, metadata: { template_type: type, ratio, ready_template: customizingReadyTemplate?.id || null } });
      }
      else if (data?.job_id) setError(loc({ ar: "بدأ التوليد وسيظهر عند اكتماله.", en: "Generation started and will appear when complete." }));
      else setError(data?.reply || loc({ ar: "لم يبدأ التوليد.", en: "Generation did not start." }));
    } catch (err) {
      setError(err?.message || loc({ ar: "فشل إنشاء القالب.", en: "Template generation failed." }));
    } finally {
      setGenerating(false);
    }
  };

  const uploadTemplate = async (event) => {
    if (isAnonymous) { requireAccount(); return; }
    const file = event.target.files?.[0];
    if (!file || !projectId) return;
    try {
      const id = crypto.randomUUID();
      const safeName = (file.name || "template").replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = user.id + "/" + projectId + "/templates/" + id + "-" + safeName;
      const { error: uploadError } = await supabase.storage.from("eyad-assets").upload(path, file, { contentType: file.type || "application/octet-stream", cacheControl: "31536000" });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from("eyad-assets").getPublicUrl(path).data.publicUrl;
      const { data: asset, error: assetError } = await supabase.from("assets").insert({
        id, owner_id: user.id, project_id: projectId, kind: "template", name: safeName,
        storage_path: path, mime_type: file.type || null, size_bytes: file.size || null,
        metadata: { source: "templates-studio-upload", asset_url: url },
      }).select("*").single();
      if (assetError) throw assetError;
      setMyTemplates((items) => [{ ...asset, url }, ...items]);
    } catch (err) {
      setError(err?.message || loc({ ar: "تعذر رفع القالب.", en: "Template upload failed." }));
    } finally {
      event.target.value = "";
    }
  };

  const deleteTemplate = async (item) => {
    if (!item?.id) return;
    await supabase.from("assets").delete().eq("id", item.id).eq("owner_id", user.id);
    if (item.storage_path) await supabase.storage.from("eyad-assets").remove([item.storage_path]);
    setMyTemplates((items) => items.filter((x) => x.id !== item.id));
  };

  const src = result?.data_url || result?.url || "";
  const ar = direction === "rtl";

  return (
    <div className="templates-page" dir={direction}>
      <div className="templates-head">
        <button className="templates-back" type="button" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")}>
          {ar ? <ArrowRight /> : <ArrowLeft />}
          {loc({ ar: "رجوع", en: "Back" })}
        </button>
        <span className="templates-kicker"><Sparkles /> {loc({ ar: "إياد AI", en: "EYAD AI" })}</span>
        <h1>{loc({ ar: "ستوديو القوالب", en: "Templates Studio" })}</h1>
        <p>{loc({ ar: "قوالب بالذكاء الاصطناعي، قوالب جاهزة، وقوالبك الخاصة في مكان واحد.", en: "AI-generated templates, ready-made templates, and your own uploaded templates in one place." })}</p>
      </div>

      {brand && (
        <div className="templates-brand">
          <div className="templates-brand-logo">{brand.logo?.url ? <img src={brand.logo.url} alt="" /> : <LayoutTemplate />}</div>
          <div>
            <strong>{brand.brand_name}</strong>
            <span>{loc({ ar: "Brand Source of Truth متصل", en: "Brand Source of Truth connected" })}</span>
          </div>
        </div>
      )}

      {!customizingReadyTemplate && <div className="templates-tabs">
        <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}><Wand2 /> {loc({ ar: "قوالب AI", en: "AI Templates" })}</button>
        <button className={tab === "ready" ? "active" : ""} onClick={() => setTab("ready")}><LayoutTemplate /> {loc({ ar: "قوالب جاهزة", en: "Ready Templates" })}</button>
        <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}><Upload /> {loc({ ar: "قوالبي", en: "My Templates" })}</button>
      </div>}

      {tab === "ready" && customizingReadyTemplate && (
        <section className="ready-customize">
          <div className="ready-customize-head">
            <button type="button" className="ready-back" onClick={() => setCustomizingReadyTemplate(null)}>
              {ar ? <ArrowRight /> : <ArrowLeft />}
              {loc({ ar: "العودة للقالب", en: "Back to template" })}
            </button>
            <div>
              <span>{loc({ ar: "تخصيص القالب", en: "Customize Template" })}</span>
              <strong>{ar ? readyCategory?.ar : readyCategory?.en} {customizingReadyTemplate.number} — {customizingReadyTemplate.name}</strong>
            </div>
          </div>

          <div className="ready-customize-layout">
            <div className={"ready-customize-logo-card " + (brand?.logo?.url ? "has-logo" : "")}>
              <span>{loc({ ar: "الشعار المعتمد", en: "Approved Logo" })}</span>
              <div className="ready-approved-logo">
                {brand?.logo?.url ? <img src={brand.logo.url} alt="" /> : <LayoutTemplate />}
              </div>
              <strong>{brand?.brand_name || businessInfo.companyName || loc({ ar: "اسم النشاط", en: "Business name" })}</strong>
              <small>{loc({ ar: "سيتم استخدام هذا الشعار داخل القالب.", en: "This approved logo will be used in the template." })}</small>
            </div>

            <div className="ready-business-card">
              <div className="ready-business-title">
                <div>
                  <span>{loc({ ar: "بيانات النشاط", en: "Business Details" })}</span>
                  <strong>{loc({ ar: "راجع البيانات قبل التوليد", en: "Review details before generation" })}</strong>
                </div>
                <Check />
              </div>
              <div className="ready-business-grid">
                {[
                  ["companyName","اسم النشاط","Business name"],
                  ["phone","رقم الهاتف","Phone"],
                  ["email","البريد الإلكتروني","Email"],
                  ["website","الموقع الإلكتروني","Website"],
                  ["address","العنوان","Address"],
                ].map(([key, arLabel, enLabel]) => (
                  <label key={key}>
                    <span>{loc({ ar: arLabel, en: enLabel })}</span>
                    <input value={businessInfo[key] || ""} onChange={(e) => setBusinessInfo((v) => ({ ...v, [key]: e.target.value }))} />
                  </label>
                ))}
                <label className="full">
                  <span>{loc({ ar: "وصف النشاط", en: "Business description" })}</span>
                  <textarea value={businessInfo.description || ""} onChange={(e) => setBusinessInfo((v) => ({ ...v, description: e.target.value }))} />
                </label>
              </div>

              <label className="ready-design-request">
                <span>{loc({ ar: "ملاحظات التخصيص", en: "Customization notes" })}</span>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </label>

              <button type="button" className="ready-generate-button" onClick={generate} disabled={generating}>
                {generating ? <><span className="templates-spinner" /> {loc({ ar: "جاري توليد القالب...", en: "Generating template..." })}</> : <><Sparkles /> {loc({ ar: "توليد القالب", en: "Generate Template" })}</>}
              </button>
              {error && <div className="templates-error">{error}</div>}
            </div>
          </div>

          <div className="ready-customize-preview">
            <span>{result && src ? loc({ ar: "نتيجة التوليد", en: "Generated Result" }) : loc({ ar: "معاينة القالب المختار", en: "Selected Template Preview" })}</span>
            {result && src ? (
              <>
                <img className="ready-customize-result" src={src} alt="" />
                <StudioNextActions projectId={projectId} fromStudio="templates" asset={result} />
                <div className="ready-customize-result-actions">
                  <button type="button" onClick={() => setResult(null)}><Wand2 /> {loc({ ar: "إعادة التخصيص", en: "Customize again" })}</button>
                  <button type="button" onClick={async () => {
                    const response = await fetch(src, { mode: "cors" });
                    if (!response.ok) throw new Error("DOWNLOAD_FETCH_FAILED");
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = objectUrl;
                    link.download = "eyad-template.png";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                  }}><Download /> {loc({ ar: "تنزيل", en: "Download" })}</button>
                </div>
              </>
            ) : (
              <div className={"ready-detail-preview ready-preview-" + ((customizingReadyTemplate.number - 1) % 20) + " ready-preview-" + readyCategory?.id}>
                <div className="ready-preview-top"><span>{ar ? "هوية العلامة" : "BRAND ID"}</span><b>{String(customizingReadyTemplate.number).padStart(2, "0")}</b></div>
                <div className="ready-preview-main"><strong>{ar ? readyCategory?.ar : readyCategory?.en}</strong><span>{customizingReadyTemplate.name}</span></div>
                <div className="ready-preview-footer"><i></i><i></i><i></i></div>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "ai" && !customizingReadyTemplate && (
        <section className="templates-workspace">
          <div className="templates-controls">
            <h2><Wand2 /> {loc({ ar: "أنشئ قالبًا بالذكاء الاصطناعي", en: "Create with AI" })}</h2>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={loc({ ar: "مثال: صمم منشور افتتاح فاخر لمطعم مع مساحة للسعر والعنوان...", en: "Example: Create a premium restaurant opening post with space for price and address..." })} />
            <label>{loc({ ar: "نوع القالب", en: "Template type" })}</label>
            <div className="templates-choice">
              {TEMPLATE_TYPES.map((x) => (
                <button key={x[0]} type="button" className={type === x[0] ? "active" : ""} onClick={() => setType(x[0])}>
                  {ar ? x[1] : x[2]}
                </button>
              ))}
            </div>
            <label>{loc({ ar: "المقاس", en: "Format" })}</label>
            <div className="templates-choice">
              {TEMPLATE_RATIOS.map((x) => (
                <button key={x} type="button" className={ratio === x ? "active" : ""} onClick={() => setRatio(x)}>{x}</button>
              ))}
            </div>
            <button type="button" className="templates-generate" onClick={generate} disabled={generating}>
              {generating ? <><span className="templates-spinner" /> {loc({ ar: "جاري التوليد...", en: "Generating..." })}</> : <><Sparkles /> {loc({ ar: "إنشاء القالب", en: "Generate Template" })}</>}
            </button>
            {error && <div className="templates-error">{error}</div>}
          </div>
          <div className="templates-result">
            {generating ? (
              <div className="templates-empty">
                <div className="templates-orb" />
                <strong>{loc({ ar: "إياد بيجهز القالب", en: "EYAD is creating the template" })}</strong>
              </div>
            ) : result && src ? (
              <>
                <img src={src} alt="" />
                <div className="templates-result-actions">
                  <button type="button" onClick={() => setResult(null)}><Wand2 /> {loc({ ar: "إنشاء نسخة أخرى", en: "Generate another" })}</button>
                  <button type="button" onClick={async () => {
                    const response = await fetch(src, { mode: "cors" });
                    if (!response.ok) throw new Error("DOWNLOAD_FETCH_FAILED");
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = objectUrl;
                    link.download = "eyad-template.png";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                  }}><Download /> {loc({ ar: "تنزيل", en: "Download" })}</button>
                  <span><Check /> {loc({ ar: "الهوية مطبقة", en: "Brand applied" })}</span>
                  <StudioNextActions projectId={projectId} fromStudio="templates" asset={result} />
                </div>
              </>
            ) : (
              <div className="templates-empty">
                <ImagePlus />
                <strong>{loc({ ar: "القالب الناتج سيظهر هنا", en: "Your generated template appears here" })}</strong>
                <small>{loc({ ar: "القالب البصري المولد يستخدم الهوية المعتمدة للمشروع.", en: "The generated visual template uses the project's approved brand identity." })}</small>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "ready" && !selectedReadyTemplate && (
        <>
          {!readyCategory ? (
            <section className="ready-library">
              <div className="ready-library-head">
                <div>
                  <strong>{loc({ ar: "اختر نوع القالب", en: "Choose a template type" })}</strong>
                  <span>{loc({ ar: "كل نوع يحتوي على 20 قالبًا جاهزًا مختلفًا.", en: "Each category contains 20 ready-made templates." })}</span>
                </div>
                <span className="ready-count">20 {loc({ ar: "قالب لكل نوع", en: "templates / category" })}</span>
              </div>
              <div className="ready-category-grid">
                {READY_CATEGORIES.map((item) => (
                  <button key={item.id} type="button" className="ready-category-card" onClick={() => setReadyCategory(item)}>
                    <div className={"ready-category-preview ready-cat-" + item.id}>
                      <span>{item.type}</span>
                      <b>{ar ? item.ar : item.en}</b>
                      <i>20</i>
                    </div>
                    <div className="ready-category-copy">
                      <strong>{ar ? item.ar : item.en}</strong>
                      <small>{item.ratio} · 20 {loc({ ar: "قالب", en: "templates" })}</small>
                    </div>
                    <span className="ready-category-action">{loc({ ar: "عرض القوالب", en: "View templates" })} {ar ? "←" : "→"}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="ready-library">
              <div className="ready-library-head ready-library-head-detail">
                <button type="button" className="ready-back" onClick={() => setReadyCategory(null)}>
                  {ar ? <ArrowRight /> : <ArrowLeft />}
                  {loc({ ar: "كل الأنواع", en: "All types" })}
                </button>
                <div>
                  <strong>{ar ? readyCategory.ar : readyCategory.en}</strong>
                  <span>{loc({ ar: "اختر واحدًا من 20 قالبًا جاهزًا", en: "Choose one of 20 ready-made templates" })}</span>
                </div>
                <span className="ready-count">20</span>
              </div>
              <div className="ready-template-grid">
                {buildReadyTemplates(readyCategory).map((item) => (
                  <button key={item.id} type="button" className="ready-template-card" onClick={() => setSelectedReadyTemplate(item)}>
                    <div className={"ready-template-preview ready-preview-" + ((item.number - 1) % 20) + " ready-preview-" + readyCategory.id}>
                      <div className="ready-preview-top">
                        <span>{ar ? "هوية العلامة" : "BRAND ID"}</span>
                        <b>{String(item.number).padStart(2, "0")}</b>
                      </div>
                      <div className="ready-preview-main">
                        <strong>{ar ? readyCategory.ar : readyCategory.en}</strong>
                        <span>{item.name}</span>
                      </div>
                      <div className="ready-preview-footer">
                        <i></i><i></i><i></i>
                      </div>
                    </div>
                    <div className="ready-template-meta">
                      <strong>{ar ? "قالب " + item.number : "Template " + item.number}</strong>
                      <span>{item.name} · {readyCategory.ratio}</span>
                      <em>{loc({ ar: "استخدام القالب", en: "Use Template" })}</em>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "ready" && selectedReadyTemplate && (
        <section className="ready-detail">
          <div className="ready-detail-head">
            <button type="button" className="ready-back" onClick={() => setSelectedReadyTemplate(null)}>
              {ar ? <ArrowRight /> : <ArrowLeft />}
              {loc({ ar: "العودة للقوالب", en: "Back to templates" })}
            </button>
            <div>
              <strong>{ar ? readyCategory?.ar : readyCategory?.en} — {loc({ ar: "قالب " + selectedReadyTemplate.number, en: "Template " + selectedReadyTemplate.number })}</strong>
              <span>{selectedReadyTemplate.name} · {readyCategory?.ratio}</span>
            </div>
          </div>
          <div className="ready-detail-layout">
            <div className={"ready-detail-preview ready-preview-" + ((selectedReadyTemplate.number - 1) % 20) + " ready-preview-" + readyCategory?.id}>
              <div className="ready-preview-top"><span>{ar ? "هوية العلامة" : "BRAND ID"}</span><b>{String(selectedReadyTemplate.number).padStart(2, "0")}</b></div>
              <div className="ready-preview-main"><strong>{ar ? readyCategory?.ar : readyCategory?.en}</strong><span>{selectedReadyTemplate.name}</span></div>
              <div className="ready-preview-footer"><i></i><i></i><i></i></div>
            </div>
            <div className="ready-detail-panel">
              <span className="ready-detail-kicker">{loc({ ar: "قالب جاهز", en: "Ready Template" })}</span>
              <h2>{ar ? readyCategory?.ar : readyCategory?.en} {selectedReadyTemplate.number}</h2>
              <p>{loc({ ar: "هذا هو القالب المختار. يمكنك تطبيق الهوية المعتمدة عليه ثم الانتقال للتخصيص بالذكاء الاصطناعي.", en: "This is the selected template. Apply the approved brand identity, then continue to AI customization." })}</p>
              {brand && <div className="ready-brand-chip">{brand.logo?.url && <img src={brand.logo.url} alt="" />}<span>{brand.brand_name} · {loc({ ar: "الهوية المعتمدة", en: "Approved brand" })}</span></div>}
              <button type="button" className="ready-use-button" onClick={() => {
                setType(readyCategory?.id === "menu" ? "menu" : readyCategory?.id === "flyer" ? "flyer" : readyCategory?.id === "brochure" ? "brochure" : "social");
                setRatio(readyCategory?.ratio || "1:1");
                setPrompt(loc({
                  ar: "طبّق الهوية المعتمدة على قالب " + readyCategory?.ar + " رقم " + selectedReadyTemplate.number + " باسم " + selectedReadyTemplate.name + " مع الحفاظ على توزيع العناصر.",
                  en: "Apply the approved brand identity to " + readyCategory?.en + " template " + selectedReadyTemplate.number + " (" + selectedReadyTemplate.name + ") while preserving the layout."
                }));
                setCustomizingReadyTemplate(selectedReadyTemplate);
                setSelectedReadyTemplate(null);
              }}><Wand2 /> {loc({ ar: "تخصيص القالب", en: "Customize Template" })}</button>
            </div>
          </div>
        </section>
      )}

      {tab === "mine" && (
        <section className="templates-mine">
          <div className="templates-upload">
            <Upload />
            <div>
              <strong>{loc({ ar: "ارفع قالبك", en: "Upload your template" })}</strong>
              <span>{loc({ ar: "صور، PDF، SVG أو PPTX حسب الملف المتاح.", en: "Images, PDF, SVG or PPTX depending on your source file." })}</span>
            </div>
            <button type="button" onClick={() => fileRef.current?.click()}>{loc({ ar: "رفع قالب", en: "Upload" })}</button>
            <input ref={fileRef} type="file" accept="image/*,.pdf,.svg,.ppt,.pptx" hidden onChange={uploadTemplate} />
          </div>
          {myTemplates.length ? (
            <div className="templates-grid">
              {myTemplates.map((item) => (
                <div className="template-card" key={item.id}>
                  {item.url && <img src={item.url} alt="" />}
                  <strong>{item.name}</strong>
                  <button className="template-delete" onClick={() => deleteTemplate(item)}><Trash2 /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="templates-empty">
              <Upload />
              <strong>{loc({ ar: "لسه مفيش قوالب مرفوعة", en: "No uploaded templates yet" })}</strong>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
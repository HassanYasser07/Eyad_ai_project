import React from "react";
import { ArrowLeft, Check, ChevronRight, Loader2, Sparkles, Shapes, Minus, Crown, Landmark, Zap, Type, Badge, ShieldCheck, TextCursorInput, Palette, FileCode2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { jobService } from "@/services/jobService";
import { projectService } from "@/services/projectService";
import { saveBrandIdentity } from "@/services/brandService";
import { saveStudioOutput } from "@/services/projectContextService";
import { storePendingAction, getPendingAction, clearPendingAction } from "@/services/guestUsageService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import "./logoStudio.css";
import LogoStudioDesktop from "@/pages/LogoStudioDesktop";
import SvgEditorDialog from "@/components/svgEditor/SvgEditorDialog";

const OPTIONS = {
  style: [
    { id: "modern", ar: "مودرن", en: "Modern" },
    { id: "minimal", ar: "مينيمال", en: "Minimal" },
    { id: "luxury", ar: "فاخر", en: "Luxury" },
    { id: "classic", ar: "كلاسيك", en: "Classic" },
    { id: "bold", ar: "جريء", en: "Bold" },
    { id: "eyad-decides", ar: "إياد يقرر", en: "EYAD decides" },
  ],
  colors: [
    { id: "blue", ar: "أزرق", en: "Blue", swatches: ["#123E9B","#2B78F6","#8DC7FF"] },
    { id: "purple", ar: "بنفسجي", en: "Purple", swatches: ["#4C16C8","#8A2BE2","#F28AE8"] },
    { id: "sunset", ar: "غروب", en: "Sunset", swatches: ["#D71920","#FF7A21","#FFD13B"] },
    { id: "green", ar: "أخضر", en: "Green", swatches: ["#087A50","#18B96B","#9AE36B"] },
    { id: "mono", ar: "أحادي", en: "Monochrome", swatches: ["#27303A","#7D8792","#F4F6F8"] },
    { id: "earth", ar: "ترابي", en: "Earth", swatches: ["#70451F","#B8894E","#F1D3A2"] },
    { id: "cyan", ar: "سماوي", en: "Cyan", swatches: ["#087DAA","#00C7EE","#8BE9FF"] },
    { id: "pink", ar: "وردي", en: "Pink", swatches: ["#D81B72","#F45BA4","#FFD0E5"] },
    { id: "navy-gold", ar: "كحلي وذهبي", en: "Navy & Gold", swatches: ["#123B82","#D3A53A","#F5D99B"] },
  ],
  logo_type: [
    { id: "symbol-wordmark", ar: "رمز + الاسم", en: "Symbol + wordmark" },
    { id: "lettermark", ar: "حروف", en: "Lettermark" },
    { id: "wordmark", ar: "الاسم كشعار", en: "Name as Logo" },
    { id: "emblem", ar: "شعار مميز", en: "Emblem" },
    { id: "abstract", ar: "رمز تجريدي", en: "Abstract mark" },
    { id: "eyad-decides", ar: "إياد يقرر", en: "EYAD decides" },
  ],
};

const STYLE_ICONS = {
  modern: Shapes,
  minimal: Minus,
  luxury: Crown,
  classic: Landmark,
  bold: Zap,
  "eyad-decides": Sparkles,
};

const LOGO_TYPE_ICONS = {
  "symbol-wordmark": Badge,
  lettermark: Type,
  wordmark: TextCursorInput,
  emblem: ShieldCheck,
  abstract: Shapes,
  "eyad-decides": Sparkles,
};

function ChoiceGroup({ title, items, value, onChange, ar, type }) {
  const isColors = type === "colors";
  const isStyle = type === "style";
  const SectionIcon = isColors ? Palette : isStyle ? Sparkles : Badge;
  return (
    <section className="logo-choice-section">
      <div className="logo-section-head">
        <div className="logo-section-title">
          <span className="logo-section-icon"><SectionIcon /></span>
          <h2>{title}</h2>
        </div>
        <span className="logo-section-hint">{ar ? "اختر واحد" : "Choose one"}</span>
      </div>
      <div className={isColors ? "logo-option-grid logo-color-grid" : "logo-option-grid"}>
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`logo-option-card ${selected ? "is-selected" : ""} ${isColors ? "logo-palette-card" : ""}`}
            >
              {isColors ? (
                <span className="logo-palette" aria-hidden="true">
                  {item.swatches?.map((swatch) => <i key={swatch} style={{ background: swatch }} />)}
                </span>
              ) : (
                <span className={`logo-style-mark mark-${item.id}`} aria-hidden="true">
                  {(() => {
                    const Icon = isStyle ? STYLE_ICONS[item.id] : LOGO_TYPE_ICONS[item.id];
                    return Icon ? <Icon /> : <Sparkles />;
                  })()}
                </span>
              )}
              <span className="logo-option-label">{ar ? item.ar : item.en}</span>
              {selected && <span className="logo-check"><Check className="w-4 h-4" /></span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function LogoStudio() {
  const { loc, direction, t } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  const [step, setStep] = React.useState(projectId ? "choices" : "brief");
  const [name, setName] = React.useState("");
  const [activity, setActivity] = React.useState("");
  const [selections, setSelections] = React.useState({});
  const [images, setImages] = React.useState([]);
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [project, setProject] = React.useState(null);
  const [jobId, setJobId] = React.useState(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [approved, setApproved] = React.useState(false);
  const handleSelectImage = React.useCallback((id) => {
    setSelectedImage(id);
    if (id !== selectedImage) setApproved(false);
  }, [selectedImage]);
  const [previewImage, setPreviewImage] = React.useState(null);
  const [svgEditorOpen, setSvgEditorOpen] = React.useState(false);

  const ar = direction === "rtl";

  React.useEffect(() => {
    const pending = getPendingAction();
    if (pending?.type === "logo_generation" && pending?.payload) {
      const payload = pending.payload;
      if (payload.name) setName(payload.name);
      if (payload.activity) setActivity(payload.activity);
      if (payload.selections) setSelections(payload.selections);
      // Anonymous projects belong to the anonymous session and may not be
      // accessible after login. Resume the user's brief/choices without
      // carrying a stale project id into the authenticated generation flow.
      if (projectId && !payload.projectId) {
        navigate("/studios/logo", { replace: true });
      }
      setStep(payload.step === "results" || payload.step === "generating" ? "choices" : (payload.step || "choices"));
      clearPendingAction();
    }
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    let active = true;
    projectService.get(projectId).then((data) => {
      if (!active || !data) return;
      setProject(data);
      const saved = data.project_data?.logo_selections;
      const brief = data.project_data?.logo_brief;
      const persistedBrief = brief || data.project_data?.logo_brief || null;
      if (persistedBrief?.name) setName(persistedBrief.name);
      if (persistedBrief?.activity) setActivity(persistedBrief.activity);
      if (saved) setSelections(saved);
      if (data.project_data?.approved_asset_id) setSelectedImage(data.project_data.approved_asset_id);
    }).catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  const canStart = name.trim() && activity.trim();
  const canGenerate = selections.style && selections.colors && selections.logo_type;

  const updateSelection = (key, value) => {
    setSelections((current) => ({ ...current, [key]: value }));
  };

  const beginChoices = async () => {
    if (!canStart) return;
    setError("");
    setStep("choices");
  };

  const generate = async () => {
    if (!canGenerate || loading) return;
    if (isAnonymous) {
      storePendingAction({
        type: "logo_generation",
        payload: {
          route: `/studios/logo${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`,
          // Do not carry an anonymous-session project id across login.
          // The authenticated generation flow will create/reuse the proper project.
          projectId: null,
          name: name.trim(),
          activity: activity.trim(),
          selections: { ...selections },
          step: "choices",
        },
      });
      requireAccount(`/studios/logo${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`);
      return;
    }

    setError("");
    setLoading(true);
    setPolling(false);
    setImages([]);
    setSelectedImage(null);

    const briefMessage = `صمم لوجو جديد. اسم العلامة: ${name.trim()}. النشاط: ${activity.trim()}.`;
    try {
      let data;
      try {
        data = await runEyadEngine({
          message: briefMessage,
          projectId: projectId || null,
          studioId: "logo",
          language: ar ? "ar" : "en",
          action: "generate",
          designOptions: {
            ...selections,
            // The values currently edited in this studio are the source of truth for generation.
            brand_name: name.trim(),
            activity: activity.trim(),
          },
        });
      } catch (firstError) {
        // A project id can become stale after an anonymous session/login.
        // If the backend explicitly says it cannot find that project, retry
        // once without it so the authenticated flow can provision the project.
        const message = String(firstError?.message || firstError || "");
        if (!projectId || !/PROJECT_NOT_FOUND/i.test(message)) throw firstError;
        navigate("/studios/logo", { replace: true });
        data = await runEyadEngine({
          message: briefMessage,
          projectId: null,
          studioId: "logo",
          language: ar ? "ar" : "en",
          action: "generate",
          designOptions: {
            ...selections,
            // The values currently edited in this studio are the source of truth for generation.
            brand_name: name.trim(),
            activity: activity.trim(),
          },
        });
      }

      const durableProjectId = data?.project?.id || projectId;
      if (durableProjectId && !projectId) {
        navigate(`/studios/logo?project=${encodeURIComponent(durableProjectId)}`, { replace: true });
      }

      if (data?.status === "generated") {
        const nextImages = normalizeImages(data);
        setImages(nextImages);
        setProject({ id: durableProjectId, title: name.trim() });
        setStep("results");
        setLoading(false);
        return;
      }

      if ((data?.status === "queued" || data?.status === "waiting_external" || data?.status === "processing") && data?.job_id) {
        setJobId(data.job_id);
        setPolling(true);
        setStep("generating");
        return;
      }

      throw new Error(data?.error || "GENERATION_NOT_STARTED");
    } catch (err) {
      setLoading(false);
      setPolling(false);
      setError(formatError(err));
    }
  };

  React.useEffect(() => {
    if (!jobId || !polling) return;
    let active = true;
    let attempts = 0;

    const tick = async () => {
      attempts += 1;
      try {
        const data = await jobService.pollGeneration(jobId);
        if (!active) return;
        if (data?.status === "generated") {
          const nextImages = normalizeImages(data);
          setImages(nextImages);
          setStep("results");
          setLoading(false);
          setPolling(false);
          return;
        }
        if (data?.status === "failed" || data?.error) {
          setError(formatError(new Error(data?.error || "GENERATION_FAILED")));
          setLoading(false);
          setPolling(false);
          return;
        }
      } catch {}
      if (attempts >= 90) {
        setError(ar ? "استغرق التوليد وقتًا أطول من المتوقع. يمكنك العودة للمشروع ومتابعته لاحقًا." : "Generation is taking longer than expected. You can return to the project and continue later.");
        setLoading(false);
        setPolling(false);
      }
    };

    tick();
    const timer = window.setInterval(tick, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, polling, ar]);

  const approve = async () => {
    if (!selectedImage) return;
    const currentProjectId = project?.id || projectId;
    if (!currentProjectId) return;

    setLoading(true);
    try {
      const current = await projectService.get(currentProjectId);
      const selectedAsset = images.find((image) => (image.asset_id || image.id) === selectedImage) || null;
      const existingBrand = current?.project_data?.brand_identity || {};
      const brandIdentity = {
        ...existingBrand,
        brand_name: name.trim() || existingBrand.brand_name || current?.title || "",
        logo: {
          asset_id: selectedImage,
          url: selectedAsset?.url || selectedAsset?.data_url || existingBrand?.logo?.url || null,
          name: name.trim() || existingBrand?.logo?.name || "Approved Logo",
          // A newly approved concept must never inherit the previous logo's SVG.
          // The selected asset is the new source of truth until its own vectorization completes.
          svg_url: null,
        },
      };

      await projectService.update(currentProjectId, {
        // projects.status only allows draft, in_progress, completed, archived.
        // Logo approval is stored in project_data/brand identity; the project itself is completed.
        status: "completed",
        project_data: {
          ...(current?.project_data || {}),
          logo_selections: selections,
          logo_brief: { name: name.trim(), activity: activity.trim() },
          approved_asset_id: selectedImage,
          approved_studio: "logo",
        },
      });

      // Vectorization is deliberately deferred until approval. Draft concepts
      // remain PNG-only, while the selected logo gets a real SVG production
      // master through Recraft's vectorization API.
      let vectorized = null;
      try {
        vectorized = await runEyadEngine({
          message: "Vectorize the approved logo asset into a production SVG.",
          projectId: currentProjectId,
          studioId: "logo",
          language: ar ? "ar" : "en",
          action: "vectorize_logo",
          designOptions: { selected_asset_id: selectedImage },
        });
      } catch (vectorError) {
        console.warn("[Logo Studio] approved-logo vectorization failed", vectorError);
      }

      // Never fall back to the previous approved logo. If vectorization fails,
      // the newly selected PNG remains the active logo.
      const svgUrl = vectorized?.svg_url || null;
      await saveBrandIdentity(currentProjectId, {
        ...brandIdentity,
        logo: {
          ...brandIdentity.logo,
          svg_url: svgUrl,
        },
      });
      await saveStudioOutput(currentProjectId, {
        studioId: "logo",
        asset: { id: selectedImage, url: selectedAsset?.url || selectedAsset?.data_url || null },
        approved: true,
        metadata: { name: name.trim(), activity: activity.trim(), selections, svg_url: svgUrl },
      });
      setApproved(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(formatError(err));
    }
  };

  const back = () => {
    if (step === "results" || step === "generating") {
      setImages([]);
      setStep("choices");
      setPolling(false);
      setJobId(null);
      setLoading(false);
      return;
    }
    if (step === "choices") {
      setStep("brief");
      return;
    }
    navigate("/studios");
  };

  return (
    <>
      <LogoStudioDesktop
        step={step}
        setStep={setStep}
        name={name}
        setName={setName}
        activity={activity}
        setActivity={setActivity}
        selections={selections}
        updateSelection={updateSelection}
        generate={generate}
        loading={loading}
        canGenerate={canGenerate}
        isAnonymous={isAnonymous}
        images={images}
        selectedImage={selectedImage}
        setSelectedImage={handleSelectImage}
        approve={approve}
        approved={approved}
        error={error}
        previewImage={previewImage}
        setPreviewImage={setPreviewImage}
        back={back}
        onOpenSvgEditor={() => setSvgEditorOpen(true)}
      />
      <div className="logo-lab-page min-h-[calc(100dvh-8rem)] flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          {ar ? "الاستوديوهات" : "Studios"}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSvgEditorOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white px-3 py-2 text-xs font-extrabold text-primary shadow-sm hover:bg-primary/5">
            <FileCode2 className="h-4 w-4" />
            <span>{t("svgEditor.testEnvironment")}</span>
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white/70 border border-white/90 px-3 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-extrabold text-slate-700">{ar ? "ستوديو الشعارات" : "Logo Studio"}</span>
          </div>
        </div>
      </header>

      <main className="logo-lab-main flex-1 max-w-6xl w-full mx-auto">
        {step === "brief" && (
          <div className="card-glass rounded-[28px] p-5 sm:p-8 flex flex-col gap-6">
            <div>
              <p className="text-xs font-bold text-primary mb-2">{ar ? "الخطوة 1 من 2" : "STEP 1 OF 2"}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{ar ? "ابدأ باسم العلامة ونشاطها" : "Start with the brand name and activity"}</h1>
              <p className="mt-2 text-sm text-slate-500">{ar ? "إياد يتولى الخطوط والتفاصيل البصرية لاحقًا." : "EYAD will handle typography and visual details."}</p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">{ar ? "اسم العلامة" : "Brand name"}</span>
              <span className="text-xs font-semibold text-primary/80">{ar ? "سيظهر في الشعار" : "This will appear in the logo"}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "مثال: مسار" : "e.g. Masar"} className="h-12 rounded-2xl border border-white/90 bg-white/70 px-4 outline-none focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">{ar ? "النشاط" : "Business activity"}</span>
              <span className="text-xs font-semibold text-primary/80">{ar ? "سيظهر في الشعار" : "This will appear in the logo"}</span>
              <input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder={ar ? "مثال: دعاية وإعلان" : "e.g. Advertising"} className="h-12 rounded-2xl border border-white/90 bg-white/70 px-4 outline-none focus:ring-2 focus:ring-primary/20" />
            </label>
            <button disabled={!canStart} onClick={beginChoices} className="h-12 rounded-2xl bg-primary text-white font-extrabold disabled:opacity-40 flex items-center justify-center gap-2">
              {ar ? "التالي" : "Continue"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "choices" && (
          <div className="logo-studio-panel card-glass rounded-[30px] p-4 sm:p-7 flex flex-col gap-6">
            <div>
              <p className="text-xs font-bold text-primary mb-2">{ar ? "الخطوة 2 من 2" : "STEP 2 OF 2"}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{ar ? "اختر اتجاه الشعار" : "Choose the logo direction"}</h1>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm text-slate-500 flex-1">{name} · {activity}</p>
                <button type="button" onClick={() => setStep("brief")} className="shrink-0 text-xs font-extrabold text-primary hover:underline">
                  {ar ? "تعديل" : "Edit"}
                </button>
              </div>
            </div>
            <ChoiceGroup title={ar ? "الأسلوب (ستايل)" : "Style"} items={OPTIONS.style} value={selections.style} onChange={(v) => updateSelection("style", v)} ar={ar} type="style" />
            <ChoiceGroup title={ar ? "ألوان الشعار" : "Logo colors"} items={OPTIONS.colors} value={selections.colors} onChange={(v) => updateSelection("colors", v)} ar={ar} type="colors" />
            <ChoiceGroup title={ar ? "نوع الشعار" : "Logo type"} items={OPTIONS.logo_type} value={selections.logo_type} onChange={(v) => updateSelection("logo_type", v)} ar={ar} type="logo-type" />
            <button disabled={!canGenerate || loading} onClick={generate} className="h-13 rounded-2xl bg-primary text-white font-extrabold disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {ar ? "ابدأ التصميم" : "Start Design"}
            </button>
            {isAnonymous && <p className="text-xs text-center text-slate-500">{ar ? "سيطلب منك إياد تسجيل الدخول عند بدء التوليد وحفظ العمل." : "EYAD will ask you to sign in when generation and saving begin."}</p>}
          </div>
        )}

        {step === "generating" && (
          <div className="card-glass rounded-[28px] p-8 sm:p-12 min-h-[480px] flex flex-col items-center justify-center text-center gap-6">
            <div className="logo-generation-orb"><div /><div /><div /><div /><div /><div /><div /><div /><div /></div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{ar ? "إياد يصمم الشعار الآن" : "EYAD is designing the logo"}</h1>
              <p className="mt-2 text-sm text-slate-500">{ar ? "سيتم إنشاء فكرتين مختلفتين بناءً على اختياراتك." : "Two distinct concepts are being created from your choices."}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary"><Loader2 className="w-4 h-4 animate-spin" /> {ar ? "جاري التنفيذ…" : "Generating…"}</div>
          </div>
        )}

        {step === "results" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <p className="text-xs font-bold text-primary mb-2">{ar ? "النتيجة" : "RESULTS"}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{ar ? "اختر الشعار الذي تريد اعتماده" : "Choose the logo to approve"}</h1>
              <p className="mt-2 text-sm text-slate-500">{ar ? "يمكن اعتماد تصميم واحد ثم الانتقال للهوية البصرية." : "Approve one concept and continue to Visual Identity."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {images.slice(0, 2).map((image, index) => {
                const id = image.asset_id || image.id || `variant-${index + 1}`;
                const selected = selectedImage === id;
                return (
                  <div key={id} className={`relative overflow-hidden rounded-3xl border-2 bg-white/80 p-2 sm:p-3 text-start transition-all ${selected ? "border-primary shadow-lg" : "border-white/90 hover:border-primary/30"}`}>
                    <button type="button" onClick={() => setPreviewImage(image)} className="block w-full cursor-zoom-in" aria-label={ar ? `عرض الفكرة ${index + 1} بالحجم الكامل` : `Preview concept ${index + 1} fullscreen`}>
                      <img src={image.data_url || image.url} alt={`Logo concept ${index + 1}`} className="w-full aspect-square object-contain rounded-2xl logo-transparency-grid" />
                    </button>
                    <button type="button" onClick={() => handleSelectImage(id)} aria-label={ar ? `تحديد الفكرة ${index + 1}` : `Select concept ${index + 1}`} className={`absolute top-4 ${ar ? "left-4" : "right-4"} z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "bg-primary border-primary text-white shadow-md" : "bg-white/95 border-slate-200 text-transparent"}`}>
                      <Check className="w-4 h-4" />
                    </button>
                    <span className="block mt-2 px-1 text-xs font-bold text-slate-500">{ar ? `الفكرة ${index + 1}` : `Concept ${index + 1}`}</span>
                  </div>
                );
              })}
            </div>
            {!approved && (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={loading} onClick={generate} className="h-13 rounded-2xl border-2 border-primary bg-white text-primary font-extrabold disabled:opacity-40 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {ar ? "توليد مرة أخرى" : "Generate again"}
                </button>
                <button disabled={!selectedImage || loading} onClick={approve} className="h-14 min-h-[56px] rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 text-white font-extrabold shadow-lg shadow-fuchsia-500/20 disabled:opacity-40">
                  {loading ? (ar ? "جارٍ التنفيذ…" : "Working…") : (ar ? "اعتماد الشعار" : "Approve Logo")}
                </button>
              </div>
            )}
            {approved && (
              <button type="button" className="logo-approved-success" aria-label={ar ? "تم اعتماد الشعار" : "Logo approved"}>
                <span className="logo-approved-success__shine" aria-hidden="true" />
                <Check className="logo-approved-success__icon" />
                <span>{ar ? "تم اعتماد الشعار" : "Logo Approved"}</span>
                <span className="logo-approved-success__spark" aria-hidden="true">✦</span>
              </button>
            )}
            {previewImage && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setPreviewImage(null)}>
                <button type="button" onClick={() => setPreviewImage(null)} className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/15 text-white text-2xl flex items-center justify-center backdrop-blur-sm" aria-label={ar ? "إغلاق المعاينة" : "Close preview"}>×</button>
                <img src={previewImage.data_url || previewImage.url} alt={ar ? "معاينة الشعار بالحجم الكامل" : "Full screen logo preview"} className="max-w-full max-h-full object-contain rounded-2xl logo-transparency-grid" onClick={(event) => event.stopPropagation()} />
              </div>
            )}
            {approved && <StudioNextActions projectId={project?.id || projectId} fromStudio="logo" asset={{ id: selectedImage, url: images.find((image) => (image.asset_id || image.id) === selectedImage)?.url || images.find((image) => (image.asset_id || image.id) === selectedImage)?.data_url || null }} title={loc({ ar: "تم اعتماد الشعار. ماذا تريد أن تفعل الآن؟", en: "Logo approved. What would you like to do next?" })} description={loc({ ar: "حوّل الشعار إلى هوية بصرية أو عرض تقديمي، أو نزّل الشعار.", en: "Turn the logo into a visual identity or presentation, or download the logo." })} />}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-semibold text-red-700">{error}</div>
        )}
      </main>
    </div>
      {svgEditorOpen && <SvgEditorDialog onClose={() => setSvgEditorOpen(false)} direction={direction} />}
    </>
  );
}

function normalizeImages(data) {
  const list = Array.isArray(data?.images) ? data.images : [];
  if (list.length) return list.slice(0, 2);
  if (data?.image?.data_url) return [{ data_url: data.image.data_url, asset_id: data.image.asset_id, url: data.image.data_url }];
  return [];
}

function formatError(error) {
  const code = error?.message || "";
  if (code.includes("429") || code.includes("NO_OPENAI_CREDITS")) return "OpenAI credits are required to generate the logo.";
  if (code === "AUTH_LOGIN_REQUIRED") return "Please sign in to generate and save the logo.";
  if (code === "ASSET_UPLOAD_FAILED") return "The logo was generated but could not be saved.";
  if (code === "GENERATION_FAILED") return "Logo generation failed. Please try again.";
  return code || "Something went wrong. Please try again.";
}
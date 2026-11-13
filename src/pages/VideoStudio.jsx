import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Film, Sparkles, Wand2, Download, RefreshCw, Palette, Upload, X, Clock3, ChevronDown, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { getBrandIdentity } from "@/services/brandService";
import { projectService } from "@/services/projectService";
import { getProjectContext, saveStudioOutput } from "@/services/projectContextService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import "./videoStudio.css";

const MODELS = [
  { id: "minimax-h3-turbo", name: "MiniMax H3 Max Turbo", quality: "standard", ar: "جودة عادية", en: "Standard", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durations: [5, 6, 8, 10, 12, 15], resolutions: ["480P", "768P", "1080P"], defaultResolution: "768P", maxImages: 5 },
  { id: "kling-2.5", name: "Kling 2.5 Turbo Pro", quality: "medium", ar: "جودة متوسطة", en: "Medium", ratios: ["16:9", "9:16", "1:1"], durations: [5, 10], resolutions: [], defaultResolution: "", maxImages: 1 },
  { id: "seedance-2.0", name: "Seedance 2.0", quality: "high", ar: "جودة عالية", en: "High", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolutions: ["480p", "720p", "1080p", "4k"], defaultResolution: "720p", maxImages: 5 },
];
const FORMATS = [
  { id: "16:9", en: "Landscape", ar: "أفقي" }, { id: "9:16", en: "Portrait", ar: "عمودي" },
  { id: "1:1", en: "Square", ar: "مربع" }, { id: "4:3", en: "Standard", ar: "تقليدي" },
  { id: "3:4", en: "Vertical Standard", ar: "عمودي تقليدي" }, { id: "21:9", en: "Ultra-wide", ar: "عريض سينمائي" },
];
const RESOLUTION_HINTS = {
  "480p": { en: "Fastest", ar: "الأسرع" }, "720p": { en: "Balanced", ar: "متوازن" }, "1080p": { en: "High quality", ar: "جودة عالية" }, "4k": { en: "Highest quality", ar: "أعلى جودة" },
  "480P": { en: "Fastest", ar: "الأسرع" }, "768P": { en: "Native (default)", ar: "الأصلية (الافتراضي)" }, "1080P": { en: "Refined to 1080P · slower", ar: "تحسين لـ1080P · أبطأ" },
};
const STYLES = [
  { id: "cinematic", en: "Cinematic", ar: "سينمائي" }, { id: "commercial", en: "Commercial", ar: "إعلاني" },
  { id: "social", en: "Social", ar: "سوشيال ميديا" }, { id: "minimal", en: "Minimal", ar: "مينيمال" },
  { id: "product", en: "Product", ar: "منتجات" },
];
const STYLE_GUIDANCE = {
  cinematic: "Cinematic visual language, intentional camera movement, atmospheric lighting, filmic composition.",
  commercial: "Polished commercial advertising, premium production, clear visual message and refined lighting.",
  social: "Dynamic social-media video, immediate visual hook, energetic pacing and mobile-first composition.",
  minimal: "Minimal visual composition, clean background, restrained motion, elegant negative space.",
  product: "Premium product showcase, accurate product details, studio lighting, refined camera movement and hero framing.",
};
const getVideoUrl = (data) => data?.video?.url || data?.video_url || data?.url || null;
const formatBytes = (n) => n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const DURATION_PRESETS = [5, 10, 15, 20, 30];
const MAX_DURATION = 120;
const formatDuration = (sec) => { const n = Math.max(0, Math.floor(Number(sec) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };
const nearestValue = (list, value) => list.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best), list[0]);

function PillSelect({ label, valueLabel, options, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return <div className="video-studio-pill" ref={ref}>
    <button type="button" className="video-studio-pill-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((v) => !v)}><span>{valueLabel}</span><ChevronDown /></button>
    {open && <ul className="video-studio-pill-menu" role="listbox" aria-label={label}>
      {options.map((option) => <li key={option.id}><button type="button" role="option" aria-selected={option.id === value} disabled={option.disabled} className={option.id === value ? "is-active" : ""} onClick={() => { onChange(option.id); setOpen(false); }}><span className="video-studio-pill-text"><span className="video-studio-model-name">{option.label}</span>{option.sub ? <span className="video-studio-model-quality">{option.sub}</span> : null}</span>{option.id === value ? <Check /> : null}</button></li>)}
    </ul>}
  </div>;
}

export default function VideoStudio() {
  const { loc, direction } = useI18n();
  const { isAnonymous, requireAccount, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const incomingAssetId = params.get("asset");
  const [brand, setBrand] = React.useState(null);
  const [projectContext, setProjectContext] = React.useState(null);
  const [prompt, setPrompt] = React.useState("");
  const [modelId, setModelId] = React.useState(MODELS[0].id);
  const [duration, setDuration] = React.useState(5);
  const [isCustomDuration, setIsCustomDuration] = React.useState(false);
  const [customDurationText, setCustomDurationText] = React.useState("5");
  const [aspect, setAspect] = React.useState("16:9");
  const [resolution, setResolution] = React.useState(MODELS[0].defaultResolution);
  const [style, setStyle] = React.useState("cinematic");
  const [images, setImages] = React.useState([]);
  const [generating, setGenerating] = React.useState(false);
  const [queueRequest, setQueueRequest] = React.useState(null);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [generationId, setGenerationId] = React.useState(null);
  const [error, setError] = React.useState("");
  const fileInputRef = React.useRef(null);
  const selectedModel = MODELS.find((m) => m.id === modelId) || MODELS[0];
  const promptReady = Boolean(prompt.trim());
  const durationValue = Number(duration) || 0;
  const maxClip = Math.max(...selectedModel.durations);
  let durationIssue = "";
  if (durationValue < 1) durationIssue = loc({ en: "Enter how long the video should be.", ar: "اكتب مدة الفيديو المطلوبة." });
  else if (durationValue > MAX_DURATION) durationIssue = loc({ en: "The maximum length is 2 minutes (120 seconds).", ar: "أقصى مدة للفيديو دقيقتين (120 ثانية)." });
  else if (durationValue > maxClip) durationIssue = loc({ en: `${selectedModel.name} creates up to ${maxClip}s per video. Choose a shorter length or switch the model.`, ar: `${selectedModel.name} بيولّد لحد ${maxClip} ثانية في الفيديو الواحد. اختار مدة أقل أو غيّر الموديل.` });
  else if (!selectedModel.durations.includes(durationValue)) durationIssue = loc({ en: `${selectedModel.name} supports these lengths: ${selectedModel.durations.join(", ")}s.`, ar: `${selectedModel.name} بيدعم المدد دي: ${selectedModel.durations.join("، ")} ثانية.` });
  const canGenerate = promptReady && Boolean(modelId) && Boolean(aspect) && Boolean(style) && !durationIssue && (selectedModel.resolutions.length === 0 || selectedModel.resolutions.includes(resolution)) && selectedModel.ratios.includes(aspect) && images.length <= selectedModel.maxImages && !generating;

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    Promise.all([getBrandIdentity(projectId).catch(() => null), getProjectContext(projectId).catch(() => null), projectService.get(projectId).catch(() => null)])
      .then(([brandData, context, project]) => {
        if (!active) return;
        setBrand(brandData); setProjectContext(context);
        const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
        if (inheritedPrompt) setPrompt(inheritedPrompt);
        else if ((context?.approvedAsset?.url || context?.latestAsset?.url) && !prompt) setPrompt(loc({ en: "Create a premium brand video using the approved creative as visual reference.", ar: "أنشئ فيديو احترافي للعلامة باستخدام التصميم المعتمد كمرجع بصري." }));
      });
    return () => { active = false; };
  }, [projectId, loc]);

  React.useEffect(() => {
    if (!queueRequest) return undefined;
    let active = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("fal-video", { body: { action: "status", model: queueRequest.model, model_path: queueRequest.model_path, request_id: queueRequest.request_id } });
        if (invokeError) throw invokeError;
        if (!active || !data) return;
        if (data.status === "COMPLETED") {
          const url = getVideoUrl(data.result);
          if (!url) throw new Error("VIDEO_URL_MISSING");
          setVideoUrl(url); setGenerationId(queueRequest.request_id); setQueueRequest(null); setGenerating(false);
          if (projectId) await saveStudioOutput(projectId, { studioId: "video", asset: { id: queueRequest.request_id, url, generation_id: queueRequest.request_id }, approved: false, metadata: { provider: "fal", model: modelId, duration, aspect, resolution: selectedModel.resolutions.length ? resolution : null, style, source_asset_id: incomingAssetId || null } });
        } else if (data.status === "FAILED") {
          throw new Error(data.error || "VIDEO_GENERATION_FAILED");
        } else if (attempts >= 180) {
          throw new Error("VIDEO_GENERATION_TIMEOUT");
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || loc({ en: "Could not read the video job status.", ar: "تعذر قراءة حالة توليد الفيديو." }));
        setQueueRequest(null); setGenerating(false);
      }
    }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [queueRequest, projectId, modelId, duration, aspect, resolution, style, incomingAssetId, loc]);

  const changeModel = (nextId) => {
    const next = MODELS.find((m) => m.id === nextId);
    if (!next) return;
    setModelId(nextId);
    setResolution(next.defaultResolution);
    if (!next.ratios.includes(aspect)) setAspect(next.ratios.includes("16:9") ? "16:9" : next.ratios[0]);
    const nextMaxClip = Math.max(...next.durations);
    if (Number(duration) <= nextMaxClip && !next.durations.includes(Number(duration))) {
      const snapped = nearestValue(next.durations, Number(duration) || next.durations[0]);
      setDuration(snapped); setCustomDurationText(String(snapped));
    }
    if (images.length > next.maxImages) setImages((current) => current.slice(0, next.maxImages));
    setError("");
  };

  const pickPresetDuration = (sec) => { setIsCustomDuration(false); setDuration(sec); setCustomDurationText(String(sec)); setError(""); };
  const startCustomDuration = () => { setIsCustomDuration(true); setCustomDurationText(String(duration || selectedModel.durations[0])); setError(""); };
  const changeCustomText = (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
    if (!digits) { setCustomDurationText(""); setDuration(0); return; }
    const n = Math.min(MAX_DURATION, parseInt(digits, 10));
    setCustomDurationText(String(n)); setDuration(n); setError("");
  };
  const commitCustomText = () => {
    const min = selectedModel.durations[0];
    if (!Number(duration) || Number(duration) < min) { setDuration(min); setCustomDurationText(String(min)); }
  };
  const changeCustomSlider = (event) => { const n = Number(event.target.value); setDuration(n); setCustomDurationText(String(n)); setError(""); };

  const addImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const allowed = files.filter((f) => f.type.startsWith("image/") && f.size <= 20 * 1024 * 1024);
    const limit = Math.min(5, selectedModel.maxImages);
    const remaining = Math.max(0, limit - images.length);
    setImages((current) => [...current, ...allowed.slice(0, remaining).map((file) => ({ file, preview: URL.createObjectURL(file), id: crypto.randomUUID() }))]);
    if (files.length > remaining) setError(loc({ en: `This model supports up to ${limit} reference image(s), each up to 20 MB.`, ar: `هذا الموديل يدعم حتى ${limit} صورة مرجعية، بحد أقصى 20 ميجابايت للصورة.` }));
  };
  const removeImage = (id) => setImages((current) => { const item = current.find((x) => x.id === id); if (item) URL.revokeObjectURL(item.preview); return current.filter((x) => x.id !== id); });

  const generate = async () => {
    if (isAnonymous) { requireAccount(); return; }
    if (!canGenerate) { setError(loc({ en: "Complete all required fields and choose options supported by this model.", ar: "أكمل جميع البيانات المطلوبة واختر إعدادات يدعمها الموديل." })); return; }
    setGenerating(true); setError(""); setVideoUrl(""); setGenerationId(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const ownerId = authData?.user?.id || user?.id;
      if (!ownerId) throw new Error("AUTH_LOGIN_REQUIRED");
      const uploadedUrls = [];
      if (images.length === 0) {
        const inheritedReference = projectContext?.approvedAsset?.url || brand?.logo?.url || projectContext?.latestAsset?.url;
        if (inheritedReference) uploadedUrls.push(inheritedReference);
      }
      for (const item of images) {
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "reference-image.png";
        const path = `${ownerId}/${projectId || "unassigned"}/video-references/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("eyad-assets").upload(path, item.file, { contentType: item.file.type, cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        uploadedUrls.push(supabase.storage.from("eyad-assets").getPublicUrl(path).data.publicUrl);
      }
      const brandContext = brand?.brand_name ? `Brand: ${brand.brand_name}.` : "";
      const promptWithStyle = `${prompt.trim()}\n\nVisual direction: ${STYLE_GUIDANCE[style]} ${brandContext}`.trim();
      const { data, error: invokeError } = await supabase.functions.invoke("fal-video", { body: { action: "submit", model: modelId, prompt: promptWithStyle, duration: Number(duration), aspect_ratio: aspect, resolution: selectedModel.resolutions.length ? resolution : undefined, image_urls: uploadedUrls, user_id: ownerId } });
      if (invokeError) throw invokeError;
      if (data?.video?.url || data?.video_url || data?.url) {
        const url = getVideoUrl(data); setVideoUrl(url); setGenerationId(data.request_id || data.id || null);
        if (projectId) await saveStudioOutput(projectId, { studioId: "video", asset: { id: data.request_id || data.id || null, url, generation_id: data.request_id || data.id || null }, approved: false, metadata: { provider: "fal", model: modelId, duration, aspect, resolution: selectedModel.resolutions.length ? resolution : null, style, source_asset_id: incomingAssetId || null } });
        setGenerating(false);
      } else if (data?.request_id) setQueueRequest({ model: modelId, model_path: data.model_path, request_id: data.request_id });
      else throw new Error(data?.error || "FAL_SUBMIT_FAILED");
    } catch (err) {
      setError(err?.message || loc({ en: "Video generation failed.", ar: "فشل توليد الفيديو." })); setGenerating(false);
    }
  };

  return <div className="video-studio-page" dir={direction}>
    <header className="video-studio-head">
      <button type="button" className="video-studio-back" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")}><span>{direction === "rtl" ? <ArrowRight /> : <ArrowLeft />}</span>{loc({ en: "Back", ar: "رجوع" })}</button>
      <div><span className="video-studio-kicker"><Sparkles /> {loc({ en: "EYAD AI · FAL", ar: "إياد AI · FAL" })}</span><h1>{loc({ en: "Video Studio", ar: "ستوديو الفيديو" })}</h1><p>{loc({ en: "Create cinematic videos with professional AI models.", ar: "أنشئ فيديوهات احترافية باستخدام أحدث موديلات الذكاء الاصطناعي." })}</p></div>
    </header>
    {projectId && <div className="video-studio-brand"><div className="video-studio-brand-mark">{brand?.logo?.url ? <img src={brand.logo.url} alt="" /> : <Palette />}</div><div><strong>{brand?.brand_name || projectContext?.project?.name || loc({ en: "Current project", ar: "المشروع الحالي" })}</strong><span>{loc({ en: "Project context connected", ar: "بيانات المشروع متصلة تلقائيًا" })}</span></div>{brand?.palette?.swatches?.length ? <div className="video-studio-swatches">{brand.palette.swatches.slice(0, 5).map((c) => <i key={c} style={{ background: c }} />)}</div> : null}</div>}
    <main className="video-studio-workspace">
      <section className="video-studio-controls">
        <div className="video-studio-title"><Wand2 /> {loc({ en: "Describe your video", ar: "اوصف الفيديو" })}<span className="video-studio-required">{loc({ en: "Required", ar: "مطلوب" })}</span></div>
        <div className="video-studio-composer">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={2500} placeholder={loc({ en: "Describe the scene, subject, camera movement, lighting and mood…", ar: "اكتب وصف المشهد والعناصر وحركة الكاميرا والإضاءة والأجواء المطلوبة…" })} />
          <div className="video-studio-composer-bar">
            <PillSelect label={loc({ en: "AI Model", ar: "موديل الفيديو" })} valueLabel={selectedModel.name} value={modelId} onChange={changeModel} options={MODELS.map((model) => ({ id: model.id, label: model.name, sub: loc({ en: model.en, ar: model.ar }) }))} />
            <PillSelect label={loc({ en: "Format", ar: "الفورمات" })} valueLabel={aspect} value={aspect} onChange={(id) => setAspect(id)} options={FORMATS.map((item) => ({ id: item.id, label: item.id, sub: loc({ en: item.en, ar: item.ar }), disabled: !selectedModel.ratios.includes(item.id) }))} />
            {selectedModel.resolutions.length > 0 && <PillSelect label={loc({ en: "Resolution", ar: "الدقة" })} valueLabel={resolution} value={resolution} onChange={(id) => setResolution(id)} options={selectedModel.resolutions.map((id) => ({ id, label: id, sub: RESOLUTION_HINTS[id] ? loc(RESOLUTION_HINTS[id]) : "" }))} />}
            <div className="video-studio-counter">{prompt.length}/2500</div>
          </div>
        </div>

        <div className="video-studio-label"><Clock3 /> {loc({ en: "Duration", ar: "مدة الفيديو" })}<span className="video-studio-muted">{formatDuration(durationValue)} · {loc({ en: "max 2:00", ar: "الحد الأقصى دقيقتان" })}</span></div>
        <div className="video-studio-options">
          {DURATION_PRESETS.map((sec) => <button key={sec} type="button" className={!isCustomDuration && durationValue === sec ? "is-active" : ""} onClick={() => pickPresetDuration(sec)}>{sec}s</button>)}
          <button type="button" className={isCustomDuration ? "is-active" : ""} onClick={startCustomDuration}>{loc({ en: "Custom", ar: "مخصص" })}</button>
        </div>
        {isCustomDuration && <div className="video-studio-custom-duration">
          <div className="video-studio-custom-row">
            <input type="range" min={selectedModel.durations[0]} max={MAX_DURATION} step="1" value={Math.min(MAX_DURATION, Math.max(selectedModel.durations[0], durationValue))} onChange={changeCustomSlider} aria-label={loc({ en: "Custom duration", ar: "مدة مخصصة" })} />
            <label className="video-studio-custom-input"><input type="text" inputMode="numeric" value={customDurationText} onChange={changeCustomText} onBlur={commitCustomText} aria-label={loc({ en: "Seconds", ar: "الثواني" })} /><span>{loc({ en: "sec", ar: "ثانية" })}</span></label>
          </div>
        </div>}
        {durationIssue && <div className="video-studio-hint is-warning">{durationIssue}</div>}

        <div className="video-studio-label">{loc({ en: "Visual Style", ar: "الاستايل" })}</div>
        <div className="video-studio-options">{STYLES.map((item) => <button key={item.id} type="button" className={style === item.id ? "is-active" : ""} onClick={() => setStyle(item.id)}>{loc({ en: item.en, ar: item.ar })}</button>)}</div>

        <div className="video-studio-label">{loc({ en: "Reference Images", ar: "الصور المرجعية" })}<span className="video-studio-muted"> ({images.length}/{Math.min(5, selectedModel.maxImages)})</span></div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={addImages} />
        <div className="video-studio-upload-row"><button type="button" className="video-studio-upload" onClick={() => fileInputRef.current?.click()} disabled={images.length >= Math.min(5, selectedModel.maxImages)}><Upload /> {loc({ en: "Add images", ar: "إرفاق صور" })}</button><span>{loc({ en: `Up to ${Math.min(5, selectedModel.maxImages)} images · 20 MB each`, ar: `حتى ${Math.min(5, selectedModel.maxImages)} صور · 20 ميجابايت للصورة` })}</span></div>
        {images.length > 0 && <div className="video-studio-image-grid">{images.map((item) => <div className="video-studio-image" key={item.id}><img src={item.preview} alt={item.file.name} /><button type="button" onClick={() => removeImage(item.id)} aria-label={loc({ en: "Remove image", ar: "حذف الصورة" })}><X /></button><small>{formatBytes(item.file.size)}</small></div>)}</div>}

        <button type="button" className="video-studio-generate" onClick={generate} disabled={!canGenerate}>{generating ? <><span className="video-studio-spinner" /> {loc({ en: "Creating video…", ar: "جاري إنشاء الفيديو…" })}</> : <><Sparkles /> {loc({ en: "Generate Video", ar: "إنشاء الفيديو" })}</>}</button>
        {!canGenerate && !generating && <div className="video-studio-validation">{loc({ en: "Enter a prompt and complete every setting to enable generation.", ar: "اكتب البرومبت وأكمل جميع الاختيارات لتفعيل التوليد." })}</div>}
        {error && <div className="video-studio-error">{error}</div>}
      </section>
      <section className="video-studio-result">{generating ? <div className="video-studio-empty"><div className="video-studio-orb"><span /><span /><span /></div><strong>{loc({ en: "Your video is being generated", ar: "جاري إنشاء الفيديو" })}</strong><small>{loc({ en: "This may take a few minutes. You can keep this page open.", ar: "قد تستغرق العملية عدة دقائق. يمكنك إبقاء الصفحة مفتوحة." })}</small></div> : videoUrl ? <div className="video-studio-output"><StudioNextActions projectId={projectId} fromStudio="video" asset={{ id: generationId, url: videoUrl }} title={loc({ en: "Video created. Choose the next step", ar: "تم إنشاء الفيديو. اختر الخطوة التالية" })} description={loc({ en: "Continue with the same project context.", ar: "كمل بنفس بيانات المشروع والهوية." })} /><div className="video-studio-player-wrap"><video controls playsInline src={videoUrl} /></div><div className="video-studio-output-actions"><a href={videoUrl} target="_blank" rel="noreferrer" download="eyad-video.mp4"><Download /> {loc({ en: "Download", ar: "تحميل" })}</a><button type="button" onClick={generate}><RefreshCw /> {loc({ en: "Generate again", ar: "توليد مرة أخرى" })}</button></div></div> : <div className="video-studio-empty"><Film /><strong>{loc({ en: "Your video will appear here", ar: "الفيديو الناتج هيظهر هنا" })}</strong><small>{loc({ en: "Choose a model, describe your idea and generate.", ar: "اختر الموديل واكتب فكرتك وابدأ التوليد." })}</small></div>}</section>
    </main>
  </div>;
}

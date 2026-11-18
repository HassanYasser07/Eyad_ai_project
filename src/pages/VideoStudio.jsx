import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Film, Sparkles, Wand2, Download, RefreshCw, Palette, Upload, X, Clock3, ChevronDown, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { getBrandIdentity } from "@/services/brandService";
import { projectService } from "@/services/projectService";
import { conversationService } from "@/services/conversationService";
import { getProjectContext, saveStudioOutput } from "@/services/projectContextService";
import "./videoStudio.css";
import TypewriterHint from "@/components/ui/TypewriterHint";
import { VIDEO_HINTS } from "@/config/typewriterHints";

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

// Compact preview that keeps the video's aspect ratio (max ~440px wide, ~380px tall).
function playerStyle(ratio) {
  const [w, h] = String(ratio).split(":").map(Number);
  const r = w > 0 && h > 0 ? w / h : 16 / 9;
  const width = Math.round(Math.min(440, 380 * r));
  return { aspectRatio: `${w || 16} / ${h || 9}`, width: `min(100%, ${width}px)` };
}

// Surface the real error body from a non-2xx edge function response.
async function readInvokeError(err) {
  try {
    const body = await err?.context?.json?.();
    if (body?.error) return new Error(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
  } catch { /* ignore */ }
  return err;
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
  const [videoAspect, setVideoAspect] = React.useState("16:9");
  const [downloading, setDownloading] = React.useState(false);
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

  // The fal job runs on fal's side no matter what the app does. We remember the queue request so
  // that leaving the app / reloading resumes polling, and network errors never fail the video.
  const queueStoreKey = `eyad.video-queue.v1:${user?.id || "anon"}`;
  const queueRequestLoadedRef = React.useRef(false);
  React.useEffect(() => {
    try {
      if (queueRequest) globalThis.localStorage?.setItem(queueStoreKey, JSON.stringify({ ...queueRequest, savedAt: queueRequest.savedAt || Date.now() }));
      else if (queueRequestLoadedRef.current) globalThis.localStorage?.removeItem(queueStoreKey);
    } catch { /* storage unavailable */ }
  }, [queueRequest, queueStoreKey]);
  React.useEffect(() => {
    if (queueRequestLoadedRef.current || !user?.id) return;
    queueRequestLoadedRef.current = true;
    try {
      const stored = JSON.parse(globalThis.localStorage?.getItem(queueStoreKey) || "null");
      const fresh = stored?.request_id && Date.now() - Number(stored.savedAt || 0) < 3 * 60 * 60 * 1000;
      const sameProject = (stored?.meta?.projectId || null) === (projectId || null);
      if (fresh && sameProject) { setQueueRequest(stored); setGenerating(true); }
      else if (stored) globalThis.localStorage?.removeItem(queueStoreKey);
    } catch { /* ignore */ }
  }, [user?.id, queueStoreKey, projectId]);

  React.useEffect(() => {
    if (!queueRequest) return undefined;
    let active = true;
    let timer = null;
    let running = false;
    const startedAt = Number(queueRequest.savedAt || Date.now());

    const check = async () => {
      if (!active || running) return;
      running = true;
      let nextDelay = 4000;
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("fal-video", { body: { action: "status", model: queueRequest.model, model_path: queueRequest.model_path, request_id: queueRequest.request_id, status_url: queueRequest.status_url, response_url: queueRequest.response_url } });
        if (invokeError) throw await readInvokeError(invokeError);
        if (!active || !data) return;
        if (data.status === "COMPLETED") {
          const url = getVideoUrl(data.result);
          if (!url) throw Object.assign(new Error("VIDEO_URL_MISSING"), { terminal: true });
          const meta = queueRequest.meta || {};
          setVideoUrl(url); setGenerationId(queueRequest.request_id); setVideoAspect(queueRequest.aspect || meta.aspect || aspect); setQueueRequest(null); setGenerating(false);
          await saveVideoToProject({ url, requestId: queueRequest.request_id, title: queueRequest.title, metadata: { provider: "fal", model: meta.modelId || modelId, duration: meta.duration || duration, aspect: queueRequest.aspect || meta.aspect || aspect, resolution: meta.resolution !== undefined ? meta.resolution : (selectedModel.resolutions.length ? resolution : null), style: meta.style || style, source_asset_id: meta.incomingAssetId || incomingAssetId || null } });
          resetForm();
          active = false;
          return;
        }
        if (data.status === "FAILED") throw Object.assign(new Error(data.error || "VIDEO_GENERATION_FAILED"), { terminal: true });
        // Still running: back off a little the longer it takes. No client-side deadline.
        nextDelay = Date.now() - startedAt > 5 * 60 * 1000 ? 8000 : 4000;
      } catch (err) {
        if (!active) return;
        if (err?.terminal) {
          setError(err?.message || loc({ en: "Video generation failed.", ar: "فشل توليد الفيديو." }));
          setQueueRequest(null); setGenerating(false); active = false;
          return;
        }
        // Network / gateway hiccup or app just resumed: the video is still being made. Keep trying.
        nextDelay = 6000;
      } finally {
        running = false;
        if (active) timer = setTimeout(check, nextDelay);
      }
    };

    const wake = () => { if (document.visibilityState === "hidden") return; if (timer) clearTimeout(timer); timer = null; check(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [queueRequest, projectId, modelId, duration, aspect, resolution, style, incomingAssetId, loc]);

  // Persist the finished video: copy it to our own storage (fal links can expire), make sure a project exists
  // (create one when the studio was opened directly) and register the video in that project so it shows in My Projects.
  const saveVideoToProject = async ({ url, requestId, title, metadata }) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const ownerId = authData?.user?.id || user?.id;
      if (!ownerId) return;
      let targetProjectId = projectId;
      let createdProject = false;
      if (!targetProjectId) {
        const fallbackTitle = brand?.brand_name ? `${brand.brand_name} - ${loc({ en: "Video", ar: "فيديو" })}` : (title || loc({ en: "Video", ar: "فيديو" }));
        const created = await projectService.create({ title: title || fallbackTitle, studio_type: "video", status: "completed", language: direction === "rtl" ? "ar" : "en", project_data: { last_studio_id: "video" } });
        targetProjectId = created?.id; createdProject = true;
      }
      if (!targetProjectId) return;
      const assetId = crypto.randomUUID();
      let finalUrl = url; let storagePath = null; let sizeBytes = null;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("FETCH_FAILED");
        const blob = await response.blob();
        const path = `${ownerId}/${targetProjectId}/videos/${assetId}.mp4`;
        const { error: uploadError } = await supabase.storage.from("eyad-assets").upload(path, blob, { contentType: "video/mp4", cacheControl: "31536000", upsert: false });
        if (uploadError) throw uploadError;
        finalUrl = supabase.storage.from("eyad-assets").getPublicUrl(path).data.publicUrl; storagePath = path; sizeBytes = blob.size;
      } catch { /* keep the provider URL if the copy fails */ }
      if (storagePath) {
        await supabase.from("assets").insert({ id: assetId, owner_id: ownerId, project_id: targetProjectId, kind: "video", name: `video-${assetId.slice(0, 8)}.mp4`, storage_path: storagePath, mime_type: "video/mp4", size_bytes: sizeBytes, metadata: { source: "video-studio", asset_url: finalUrl, provider_url: url, ...metadata } });
      }
      await saveStudioOutput(targetProjectId, { studioId: "video", asset: { id: storagePath ? assetId : requestId, url: finalUrl, generation_id: requestId, kind: "video" }, approved: false, metadata });
      // Add the video to the project's chat so it can be played and downloaded there.
      try {
        const conversation = await conversationService.getOrCreate(targetProjectId, {});
        await conversationService.addMessage(conversation.id, {
          role: "assistant",
          content: loc({ en: "Your video is ready.", ar: "الفيديو جاهز." }),
          metadata: { studio_id: "video", video_url: finalUrl, video_aspect: metadata?.aspect || "16:9", video_asset_id: storagePath ? assetId : requestId },
        });
      } catch { /* the video is still saved in the project */ }
      if (createdProject) await projectService.update(targetProjectId, { studio_type: "video", status: "completed" }).catch(() => null);
      setVideoUrl(finalUrl);
    } catch { /* saving must never break the generated video */ }
  };

  // Clear all inputs after a successful generation (kept untouched when generation fails).
  const resetForm = () => {
    setPrompt("");
    setImages((current) => { current.forEach((item) => { try { URL.revokeObjectURL(item.preview); } catch { /* ignore */ } }); return []; });
    setModelId(MODELS[0].id); setResolution(MODELS[0].defaultResolution);
    setDuration(5); setIsCustomDuration(false); setCustomDurationText("5");
    setAspect("16:9"); setStyle("cinematic"); setError("");
  };

  // Save the video file to the device instead of opening it in a new tab.
  const downloadVideo = async () => {
    if (!videoUrl || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("DOWNLOAD_FAILED");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: "video/mp4" }));
      const link = document.createElement("a");
      link.href = objectUrl; link.download = `eyad-video-${Date.now()}.mp4`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch {
      setError(loc({ en: "Could not download the video. Please try again.", ar: "تعذر تنزيل الفيديو. حاول مرة أخرى." }));
    } finally { setDownloading(false); }
  };

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
      if (invokeError) throw await readInvokeError(invokeError);
      if (data?.video?.url || data?.video_url || data?.url) {
        const url = getVideoUrl(data); setVideoUrl(url); setGenerationId(data.request_id || data.id || null); setVideoAspect(aspect);
        await saveVideoToProject({ url, requestId: data.request_id || data.id || null, title: prompt.trim().slice(0, 60), metadata: { provider: "fal", model: modelId, duration, aspect, resolution: selectedModel.resolutions.length ? resolution : null, style, source_asset_id: incomingAssetId || null } });
        setGenerating(false); resetForm();
      } else if (data?.request_id) setQueueRequest({ savedAt: Date.now(), meta: { modelId, duration, aspect, resolution: selectedModel.resolutions.length ? resolution : null, style, incomingAssetId: incomingAssetId || null, projectId: projectId || null }, aspect, title: prompt.trim().slice(0, 60), model: modelId, model_path: data.model_path, request_id: data.request_id, status_url: data.status_url, response_url: data.response_url });
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
          <TypewriterHint value={prompt} sentences={VIDEO_HINTS}><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={2500} aria-label={loc({ en: "Describe your video", ar: "اوصف الفيديو" })} /></TypewriterHint>
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
      <section className="video-studio-result">{generating ? <div className="video-studio-empty"><div className="video-studio-orb"><span /><span /><span /></div><strong>{loc({ en: "Your video is being generated", ar: "جاري إنشاء الفيديو" })}</strong><small>{loc({ en: "This may take a few minutes. You can keep this page open.", ar: "قد تستغرق العملية عدة دقائق. يمكنك إبقاء الصفحة مفتوحة." })}</small></div> : videoUrl ? <div className="video-studio-output"><div className="video-studio-player-wrap" style={playerStyle(videoAspect)}><video controls playsInline src={videoUrl} /></div><div className="video-studio-output-actions"><button type="button" onClick={downloadVideo} disabled={downloading}><Download /> {downloading ? loc({ en: "Downloading...", ar: "جاري التنزيل..." }) : loc({ en: "Download", ar: "تحميل" })}</button></div></div> : <div className="video-studio-empty"><Film /><strong>{loc({ en: "Your video will appear here", ar: "الفيديو الناتج هيظهر هنا" })}</strong><small>{loc({ en: "Choose a model, describe your idea and generate.", ar: "اختر الموديل واكتب فكرتك وابدأ التوليد." })}</small></div>}</section>
    </main>
  </div>;
}

import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ImagePlus, Sparkles, Check, Palette, Wand2, Camera, Clapperboard, PenLine, SlidersHorizontal, Maximize2, ChevronDown, Folder, Home, Search, UserRound, Plus, Mic } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { transcribeEyadAudio } from "@/services/transcribeService";
import { jobService } from "@/services/jobService";
import { getBrandIdentity } from "@/services/brandService";
import { projectService } from "@/services/projectService";
import { assetService } from "@/services/assetService";
import { saveStudioOutput } from "@/services/projectContextService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import { Image as UIImage } from "@/components/ui/image";
import "./aiImagesStudio.css";

const EYAD_AI_HEADER_LOGO = "/images/brand/eyad-ai-header-logo.jpg";
const AI_IMAGES_HERO_IPHONE = "/images/ai-images/hero-iphone.png";

const PRESETS = [
  { id: "all", ar: "الكل", en: "All", icon: Sparkles, prompt: "premium creative image" },
  { id: "realistic", ar: "واقعي", en: "Realistic", icon: Camera, prompt: "photorealistic premium photography" },
  { id: "cinematic", ar: "سينمائي", en: "Cinematic", icon: Clapperboard, prompt: "cinematic premium visual" },
  { id: "design", ar: "تصميمي", en: "Design", icon: Palette, prompt: "high-end graphic design composition" },
  { id: "illustration", ar: "رسومي", en: "Illustration", icon: ImagePlus, prompt: "premium artistic illustration" },
  { id: "art", ar: "فني", en: "Art", icon: PenLine, prompt: "refined contemporary art direction" },
];
const STYLE_REFERENCES = [
  { id: "cinematic", ar: "سينمائي", en: "Cinematic", url: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=600&q=80", prompt: "cinematic lighting, dramatic contrast, film still composition, atmospheric depth" },
  { id: "luxury", ar: "فاخر", en: "Luxury", url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=600&q=80", prompt: "luxury editorial aesthetic, premium materials, refined composition, sophisticated lighting" },
  { id: "editorial", ar: "تحريري", en: "Editorial", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80", prompt: "high-fashion editorial photography, polished art direction, magazine aesthetic" },
  { id: "minimal", ar: "مينيمال", en: "Minimal", url: "https://images.unsplash.com/photo-1526481280695-3c687fd643ed?auto=format&fit=crop&w=600&q=80", prompt: "minimalist visual language, clean negative space, restrained palette, precise composition" },
  { id: "3d", ar: "ثري دي", en: "3D", url: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=600&q=80", prompt: "premium 3D render aesthetic, polished materials, studio lighting, dimensional forms" },
  { id: "futuristic", ar: "مستقبلي", en: "Futuristic", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80", prompt: "futuristic design, advanced technology aesthetic, luminous details, sleek forms" },
  { id: "analog", ar: "فيلم أنالوج", en: "Analog Film", url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80", prompt: "35mm analog film look, organic grain, natural highlights, nostalgic color response" },
  { id: "blackwhite", ar: "أبيض وأسود", en: "B&W", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80", prompt: "high-contrast black and white photography, expressive light and shadow, timeless tone" },
  { id: "neon", ar: "نيون", en: "Neon", url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=600&q=80", prompt: "neon-lit nightlife aesthetic, vibrant luminous colors, cinematic urban atmosphere" },
  { id: "pastel", ar: "باستيل", en: "Pastel", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80", prompt: "soft pastel palette, airy light, gentle contrast, dreamy contemporary aesthetic" },
  { id: "moody", ar: "مودي", en: "Moody", url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&q=80", prompt: "moody photography, deep shadows, muted tones, emotional atmosphere" },
  { id: "golden", ar: "غروب ذهبي", en: "Golden Hour", url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80", prompt: "golden hour sunlight, warm cinematic glow, soft highlights, premium photography" },
  { id: "street", ar: "ستريت", en: "Street", url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=600&q=80", prompt: "contemporary street photography, candid energy, urban texture, authentic framing" },
  { id: "fashion", ar: "موضة", en: "Fashion", url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80", prompt: "fashion campaign aesthetic, bold styling, controlled studio light, luxury editorial direction" },
  { id: "product", ar: "منتج", en: "Product", url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80", prompt: "premium product photography, clean studio lighting, crisp details, commercial art direction" },
  { id: "architecture", ar: "معماري", en: "Architecture", url: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=600&q=80", prompt: "architectural photography, geometric precision, clean lines, dramatic spatial composition" },
  { id: "illustrative", ar: "إلوستريشن", en: "Illustrative", url: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=600&q=80", prompt: "modern artistic illustration, painterly texture, expressive shapes, curated color harmony" },
  { id: "dreamy", ar: "حالم", en: "Dreamy", url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=600&q=80", prompt: "dreamlike visual atmosphere, soft focus, ethereal light, poetic composition" },
  { id: "dark", ar: "دارك", en: "Dark", url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=80", prompt: "dark luxury aesthetic, rich blacks, dramatic directional light, sophisticated mood" },
  { id: "vibrant", ar: "ألوان قوية", en: "Vibrant", url: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=600&q=80", prompt: "vibrant contemporary art direction, saturated colors, energetic composition, bold visual rhythm" },
];
const ASPECTS = [
  { id: "1:1", ar: "مربع", en: "1:1" },
  { id: "16:9", ar: "أفقي", en: "16:9" },
  { id: "9:16", ar: "عمودي", en: "9:16" },
  { id: "4:3", ar: "قياسي", en: "4:3" },
  { id: "3:4", ar: "بورتريه", en: "3:4" },
];

export default function AIImagesStudio() {
  const { loc, direction, language } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const incomingAssetId = params.get("asset");
  const [brand, setBrand] = React.useState(null);
  const [loadingBrand, setLoadingBrand] = React.useState(Boolean(projectId));
  const [prompt, setPrompt] = React.useState("");
  const [preset, setPreset] = React.useState("all");
  const [aspect, setAspect] = React.useState("1:1");
  const [generating, setGenerating] = React.useState(false);
  const [jobId, setJobId] = React.useState(null);
  const [images, setImages] = React.useState([]);
  const [error, setError] = React.useState("");
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [referenceImages, setReferenceImages] = React.useState([]);
  const [styleReference, setStyleReference] = React.useState(null);
  const [previewReference, setPreviewReference] = React.useState(null);
  const [voiceMode, setVoiceMode] = React.useState(false);
  const [voiceRecording, setVoiceRecording] = React.useState(false);
  const [voiceProcessing, setVoiceProcessing] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");
  const mediaRecorderRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const voiceChunksRef = React.useRef([]);
  const referenceInputRef = React.useRef(null);

  React.useEffect(() => {
    let active = true;
    if (!incomingAssetId || incomingAssetId === "latest") return undefined;
    assetService.get(incomingAssetId).then((asset) => {
      if (!active) return;
      if (!asset?.url) {
        setError(loc({ en: "The selected design could not be loaded. Return to chat and open it again.", ar: "تعذر تحميل التصميم المحدد. ارجع للمحادثة وافتح التصميم مرة أخرى." }));
        return;
      }
      const incomingImage = {
        id: asset.id,
        asset_id: asset.id,
        url: asset.url,
        name: asset.name || "Incoming design",
        type: asset.mime_type || "image/png",
      };
      setImages([incomingImage]);
      setSelectedImage(incomingImage);
      setReferenceImages([incomingImage]);
      setError("");
    }).catch((error) => {
      console.warn("[AI Images] Could not load incoming asset", error);
      if (active) setError(loc({ en: "The selected design could not be loaded. Return to chat and open it again.", ar: "تعذر تحميل التصميم المحدد. ارجع للمحادثة وافتح التصميم مرة أخرى." }));
    });
    return () => { active = false; };
  }, [incomingAssetId, loc]);

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    Promise.all([
      getBrandIdentity(projectId).catch(() => null),
      projectService.get(projectId).catch(() => null),
    ]).then(([brandData, project]) => {
      if (!active) return;
      setBrand(brandData);
      const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
      if (inheritedPrompt) setPrompt(inheritedPrompt);
    }).finally(() => {
      if (active) setLoadingBrand(false);
    });
    return () => { active = false; };
  }, [projectId]);

  React.useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      if (!active) return;
      attempts += 1;
      try {
        const data = await jobService.pollGeneration(jobId);
        if (!active || !data) return;
        if (data.status === "generated" || data.status === "completed") {
          const next = Array.isArray(data.images) ? data.images : data.image ? [data.image] : [];
          if (next.length) {
            setImages(next);
            setSelectedImage(next[0]);
          } else {
            setError(loc({ en: "The generation completed without an image.", ar: "اكتمل التوليد بدون صورة." }));
          }
          setGenerating(false);
          setJobId(null);
        } else if (data.status === "failed") {
          setError(data.error || loc({ en: "Image generation failed.", ar: "فشل توليد الصورة." }));
          setGenerating(false);
          setJobId(null);
        }
      } catch {}
      if (attempts >= 60) {
        setError(loc({ en: "Generation is still processing. You can return later and the job will remain on the server.", ar: "التوليد ما زال قيد التنفيذ. يمكنك العودة لاحقًا وستظل العملية محفوظة على الخادم." }));
        setGenerating(false);
        setJobId(null);
      }
    }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [jobId, loc]);

  const generate = async (promptOverride = null, { fromVoice = false } = {}) => {
    if (isAnonymous) {
      requireAccount();
      return;
    }
    const requestPrompt = String(promptOverride ?? prompt).trim();
    if (!requestPrompt) {
      setError(loc({ en: "Describe the image you want first.", ar: "اكتب وصف الصورة أولًا." }));
      return;
    }
    setGenerating(true);
    setError("");
    setImages([]);
    setSelectedImage(null);
    try {
      const chosen = PRESETS.find((item) => item.id === preset);
      const data = await runEyadEngine({
        message: requestPrompt,
        projectId,
        studioId: "ai-images",
        language: direction === "rtl" ? "ar" : "en",
        action: "generate",
        referenceImage: referenceImages[0]?.data_url || referenceImages[0]?.url || brand?.logo?.url || null,
        designOptions: {
          image_type: "ai-image",
          preset,
          preset_direction: chosen?.prompt || "",
          aspect_ratio: aspect,
          brand_identity: brand || null,
          approved_logo_url: brand?.logo?.url || null,
          brand_name: brand?.brand_name || "",
          reference_images: referenceImages.map((item, index) => ({ index: index + 1, name: item.name || `reference-${index + 1}`, type: item.type || "image", data_url: item.data_url || item.url || null })),
          reference_image: referenceImages[0] ? { name: referenceImages[0].name || "reference-image", type: referenceImages[0].type || "image", has_data: Boolean(referenceImages[0].data_url || referenceImages[0].url) } : null,
          style_reference_image: styleReference ? { id: styleReference.id, name: styleReference.en, url: styleReference.url, prompt: styleReference.prompt } : null,
          style_reference_prompt: styleReference?.prompt || "",
        },
      });
      if (data?.image?.data_url || data?.image?.url) {
        setImages([data.image]);
        setSelectedImage(data.image);
        if (projectId) await saveStudioOutput(projectId, { studioId: "ai-images", asset: { id: data.image.id || data.image.asset_id || null, url: data.image.url || data.image.data_url || null, data_url: data.image.data_url || null }, approved: false, metadata: { preset, aspect } });
        setGenerating(false);
      } else if (Array.isArray(data?.images) && data.images.length) {
        setImages(data.images);
        setSelectedImage(data.images[0]);
        if (projectId) await saveStudioOutput(projectId, { studioId: "ai-images", asset: { id: data.images[0].id || data.images[0].asset_id || null, url: data.images[0].url || data.images[0].data_url || null, data_url: data.images[0].data_url || null }, approved: false, metadata: { preset, aspect } });
        setGenerating(false);
      } else if (data?.job_id) {
        setJobId(data.job_id);
      } else {
        setError(data?.reply || loc({ en: "Generation did not start.", ar: "لم يبدأ التوليد." }));
        setGenerating(false);
      }
    } catch (err) {
      setError(err?.message || loc({ en: "Image generation failed.", ar: "فشل توليد الصورة." }));
      setGenerating(false);
    }
  };

  const stopInlineRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startInlineRecording = React.useCallback(async () => {
    setVoiceError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError(loc({ en: "Voice recording is not supported here.", ar: "تسجيل الصوت غير مدعوم هنا." }));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const chunks = voiceChunksRef.current;
        const actualType = recorder.mimeType || mimeType || "audio/webm";
        voiceChunksRef.current = [];
        mediaRecorderRef.current = null;
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setVoiceRecording(false);
        if (!chunks.length) return;
        setVoiceProcessing(true);
        try {
          const blob = new Blob(chunks, { type: actualType });
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const result = String(reader.result || "");
              const comma = result.indexOf(",");
              const audioBase64 = comma >= 0 ? result.slice(comma + 1) : result;
              const response = await transcribeEyadAudio({ audioBase64, mimeType: actualType, language });
              const transcript = String(response?.text || "").trim();
              if (transcript) {
                setPrompt(transcript);
                setVoiceMode(false);
              } else {
                setVoiceError(loc({ en: "I could not understand the recording.", ar: "لم أستطع فهم التسجيل." }));
              }
            } catch {
              setVoiceError(loc({ en: "I could not understand the recording.", ar: "لم أستطع فهم التسجيل." }));
            } finally {
              setVoiceProcessing(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          setVoiceProcessing(false);
          setVoiceError(loc({ en: "Could not process the recording.", ar: "تعذر معالجة التسجيل." }));
        }
      };
      recorder.start(100);
      setVoiceRecording(true);
    } catch {
      setVoiceError(loc({ en: "Could not access the microphone.", ar: "تعذر الوصول للميكروفون." }));
    }
  }, [language, loc]);

  React.useEffect(() => () => {
    try { mediaRecorderRef.current?.stop?.(); } catch {}
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleReferenceImage = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remaining = Math.max(0, 5 - referenceImages.length);
    if (!remaining) {
      setError(loc({ en: "Maximum 5 reference images.", ar: "الحد الأقصى 5 صور مرجعية." }));
      event.target.value = "";
      return;
    }
    const accepted = files.filter((file) => file.type?.startsWith("image/")).slice(0, remaining);
    if (!accepted.length) {
      setError(loc({ en: "Please choose image files only.", ar: "اختر ملفات صور فقط." }));
      event.target.value = "";
      return;
    }
    Promise.all(accepted.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, data_url: String(reader.result || "") });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).then((loaded) => {
      setReferenceImages((prev) => [...prev, ...loaded].slice(0, 5));
      setError(accepted.length < files.length ? loc({ en: "Only 5 reference images can be added.", ar: "يمكن إضافة 5 صور مرجعية فقط." }) : "");
    }).catch(() => setError(loc({ en: "Could not load the reference images.", ar: "تعذر تحميل الصور المرجعية." })));
    event.target.value = "";
  };

  const removeReferenceImage = (index) => setReferenceImages((prev) => prev.filter((_, i) => i !== index));

  const currentSrc = (image) => image?.data_url || image?.url || "";

  return (
    <div className="ai-images-page" dir={direction}>
      <header className="ai-images-topbar">
        <button type="button" className="ai-images-circle-btn" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")} aria-label={loc({ en: "Back", ar: "رجوع" })}>{direction === "rtl" ? <ArrowRight /> : <ArrowLeft />}</button>
        <div className="ai-images-brand"><UIImage src={EYAD_AI_HEADER_LOGO} alt="EYAD AI" fittingType="fit" className="ai-images-brand-img" /></div>

      </header>
      <section className="ai-images-hero">
        <div className="ai-images-hero-bg" aria-hidden="true"><img src={AI_IMAGES_HERO_IPHONE} alt="" /></div>
        <div className="ai-images-hero-overlay" aria-hidden="true" />
        <div className="ai-images-hero-content">
          <div className="ai-images-kicker"><Sparkles /> {loc({ en: "CREATIVE ENGINE", ar: "محرك الإبداع" })}</div>
          <h1>{loc({ en: "AI Images", ar: "الصور بالذكاء الاصطناعي" })} <span>Studio</span></h1>
          <p>{loc({ en: "Turn your ideas into extraordinary images", ar: "حوّل أفكارك إلى صور احترافية" })}</p>
        </div>
      </section>
      <div className="ai-images-presets">{PRESETS.map((item) => { const Icon=item.icon; return <button key={item.id} type="button" className={preset===item.id?"is-active":""} onClick={()=>setPreset(item.id)}><Icon/><span>{loc({en:item.en,ar:item.ar})}</span></button>; })}</div>
      {previewReference && <div className="ai-images-reference-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewReference(null)}><button type="button" onClick={() => setPreviewReference(null)} aria-label={loc({en:"Close preview",ar:"إغلاق المعاينة"})}>×</button><img src={previewReference.data_url || previewReference.url} alt={previewReference.name || "Reference"} onClick={(e) => e.stopPropagation()} /></div>}
      <section className="ai-images-style-section">
        <div className="ai-images-style-head">
          <div><span>{loc({ en: "STYLE REFERENCES", ar: "ستايلات جاهزة" })}</span><strong>{loc({ en: "Choose a visual style", ar: "اختار الستايل اللي يعجبك" })}</strong><small>{loc({ en: "Pick one image and EYAD will use its visual language for your prompt.", ar: "اختار صورة واحدة وإياد هيستخدم أسلوبها البصري مع الوصف اللي هتكتبه." })}</small></div>
          {styleReference ? <button type="button" className="ai-images-style-clear" onClick={() => setStyleReference(null)}>{loc({ en: "Clear style", ar: "إلغاء الستايل" })}</button> : null}
        </div>
        <div className="ai-images-style-grid">
          {STYLE_REFERENCES.map((style) => <button key={style.id} type="button" className={styleReference?.id === style.id ? "is-selected" : ""} onClick={() => setStyleReference(style)}>
            <img src={style.url} alt="" loading="lazy" />
            <span>{loc({ en: style.en, ar: style.ar })}</span>
            {styleReference?.id === style.id ? <b><Check /></b> : null}
          </button>)}
        </div>
        <div className="ai-images-style-credit">Style preview photography via <a href="https://unsplash.com/" target="_blank" rel="noreferrer">Unsplash</a></div>
      </section>
      <section className="ai-images-preview-shell">{images.length && selectedImage ? <div className="ai-images-main-preview"><img src={currentSrc(selectedImage)} alt="" /><button type="button" className="ai-images-reference-btn" onClick={() => referenceInputRef.current?.click()}><ImagePlus /> {loc({en:"Add reference image",ar:"إضافة صورة مرجعية"})}</button><button type="button" className="ai-images-expand-btn"><Maximize2 /></button></div> : <div className="ai-images-main-preview ai-images-main-empty"><div className="ai-preview-glow"/><div className="ai-preview-icon"><ImagePlus/></div><strong>{loc({en:"Your creation appears here",ar:"الصورة التي تنشئها ستظهر هنا"})}</strong><small>{loc({en:"Describe your idea below and let EYAD create it.",ar:"اكتب فكرتك بالأسفل ودع إياد ينشئها."})}</small></div>}</section>
      <section className="ai-images-prompt-card">
        <input ref={referenceInputRef} type="file" accept="image/*" multiple onChange={handleReferenceImage} style={{display:"none"}} />
        {styleReference ? <div className="ai-images-style-chip"><img src={styleReference.url} alt="" /><div><b>{loc({ en: "Style", ar: "ستايل" })}</b><span>{loc({ en: styleReference.en, ar: styleReference.ar })}</span></div><button type="button" onClick={() => setStyleReference(null)}>×</button></div> : null}
        {referenceImages.length > 0 ? <div className="ai-images-reference-thumbs">{referenceImages.map((item, index) => (
          <div key={index} className="ai-images-reference-thumb">
            <button type="button" className="ai-images-reference-preview" onClick={() => setPreviewReference(item)}><img src={item.data_url} alt="" /></button>
            <button type="button" className="ai-images-reference-remove" onClick={() => removeReferenceImage(index)}>×</button>
            <span>{index + 1}</span>
          </div>
        ))}</div> : null}
        {!voiceMode ? <div className="ai-images-text-mode">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={loc({en:"Describe the image you want to create…",ar:"صف الصورة التي تريد إنشاءها..."})} rows={5} />
          <div className="ai-images-prompt-actions">
            <button type="button" className="ai-images-upload-btn" onClick={() => referenceInputRef.current?.click()} disabled={referenceImages.length >= 5}><ImagePlus /></button>
            <button type="button" className="ai-images-voice-btn" onClick={() => { setVoiceMode(true); setVoiceError(""); startInlineRecording(); }}><Mic /></button>
          </div>
        </div> : null}
        {voiceMode ? <div className="ai-images-inline-voice">
          <div className="ai-images-voice-head"><span>{voiceProcessing ? loc({en:"Converting voice to text…",ar:"جاري تحويل الصوت إلى كتابة…"}) : voiceRecording ? loc({en:"Listening…",ar:"جاري الاستماع…"}) : loc({en:"Voice input",ar:"الإدخال الصوتي"})}</span><button type="button" onClick={() => { if (voiceRecording) stopInlineRecording(); else setVoiceMode(false); }}>×</button></div>
          <div className={voiceRecording ? "ai-images-waveform is-recording" : "ai-images-waveform"} aria-hidden="true">{Array.from({length:28}).map((_, i) => <i key={i} />)}</div>
          {voiceError ? <div className="ai-images-voice-error">{voiceError}</div> : null}
          <div className="ai-images-voice-controls">{voiceRecording ? <button type="button" className="ai-images-voice-send" onClick={stopInlineRecording}><Mic /> {loc({en:"Send recording",ar:"إرسال التسجيل"})}</button> : <button type="button" className="ai-images-voice-send" onClick={startInlineRecording} disabled={voiceProcessing}><Mic /> {loc({en:"Record again",ar:"تسجيل مرة أخرى"})}</button>}</div>
        </div> : null}
      </section>
      <section className="ai-images-format-row"><button type="button" className="ai-images-format-select">{loc({en:"Aspect ratio",ar:"نسبة العرض"})}<ChevronDown/></button><div className="ai-images-aspects">{ASPECTS.map(item=><button key={item.id} type="button" className={aspect===item.id?"is-active":""} onClick={()=>setAspect(item.id)}><span className={"ratio-icon ratio-"+item.id.replace(":","-")}/><b>{item.id}</b></button>)}</div></section>
      <button type="button" className="ai-images-generate" onClick={generate} disabled={generating}>{generating?<><span className="ai-images-spinner"/>{loc({en:"Creating image…",ar:"جاري إنشاء الصورة…"})}</>:<><Sparkles/>{loc({en:"Create Image",ar:"إنشاء الصورة"})}</>}</button>
      {error&&<div className="ai-images-error">{error}</div>}
      {images.length>0&&<section className="ai-images-history"><div className="ai-images-history-head"><strong>{loc({en:"Previous results",ar:"نتائج سابقة"})}</strong><button type="button">{loc({en:"View all",ar:"عرض الكل"})}<ArrowLeft/></button></div><div className="ai-images-history-grid">{images.map((image,index)=>{const src=currentSrc(image);return <button key={image.asset_id||image.id||index} type="button" className={selectedImage===image?"is-selected":""} onClick={()=>setSelectedImage(image)}>{src&&<img src={src} alt=""/>}{selectedImage===image&&<span className="history-check"><Check/></span>}</button>;})}</div><StudioNextActions projectId={projectId} fromStudio="ai-images" asset={selectedImage} title={loc({en:"Continue with this image",ar:"كمّل باستخدام الصورة دي"})} description={loc({en:"The project context stays attached.",ar:"بيانات المشروع والهوية تفضل مرتبطة."})}/></section>}

      <section className="ai-images-about">
        <div className="ai-images-about-glow" aria-hidden="true" />
        <div className="ai-images-about-head">
          <div>
            <span>{loc({en:"ABOUT EYAD AI",ar:"عن إياد AI"})}</span>
            <h2>{loc({en:"Professional image creation, from idea to final visual.",ar:"من الفكرة إلى صورة احترافية جاهزة للاستخدام."})}</h2>
            <p>{loc({en:"EYAD combines creative direction, AI generation and visual references in one focused workspace — so you can build polished images without leaving the studio.",ar:"إياد يجمع التوجيه الإبداعي، وتوليد الصور بالذكاء الاصطناعي، والمراجع البصرية في مساحة واحدة — علشان تطلع بصورة متقنة من غير ما تخرج من الاستوديو."})}</p>
          </div>
          <div className="ai-images-about-badge"><Sparkles/><strong>{loc({en:"Creative Intelligence",ar:"ذكاء إبداعي"})}</strong><small>{loc({en:"Built for professional visual work",ar:"مصمم للشغل البصري الاحترافي"})}</small></div>
        </div>

        <div className="ai-images-about-features">
          <article><div className="ai-images-about-icon"><Wand2/></div><div><b>{loc({en:"Precise creative direction",ar:"توجيه إبداعي دقيق"})}</b><p>{loc({en:"Turn a simple brief into a clear visual direction with style, mood and composition.",ar:"حوّل وصف بسيط إلى اتجاه بصري واضح مع ستايل ومود وتكوين مناسب."})}</p></div></article>
          <article><div className="ai-images-about-icon"><Camera/></div><div><b>{loc({en:"Professional visual quality",ar:"جودة بصرية احترافية"})}</b><p>{loc({en:"Create commercial-looking visuals for products, campaigns, social content and presentations.",ar:"أنشئ صورًا مناسبة للمنتجات والحملات والسوشيال ميديا والعروض التقديمية."})}</p></div></article>
          <article><div className="ai-images-about-icon"><Palette/></div><div><b>{loc({en:"20 ready-made visual styles",ar:"20 ستايل بصري جاهز"})}</b><p>{loc({en:"Choose a visual language such as cinematic, luxury, editorial, 3D, minimal and more.",ar:"اختار لغة بصرية مثل السينمائي، الفاخر، التحريري، الثري دي، المينيمال وغيرهم."})}</p></div></article>
          <article><div className="ai-images-about-icon"><ImagePlus/></div><div><b>{loc({en:"Reference-aware creation",ar:"فهم الصور المرجعية"})}</b><p>{loc({en:"Add up to five reference images to guide the visual result while keeping your prompt in control.",ar:"أضف حتى 5 صور مرجعية لتوجيه النتيجة البصرية مع الحفاظ على تحكمك في الوصف."})}</p></div></article>
          <article><div className="ai-images-about-icon"><SlidersHorizontal/></div><div><b>{loc({en:"Flexible formats",ar:"مقاسات متعددة"})}</b><p>{loc({en:"Prepare the same idea for square, landscape, portrait and standard compositions.",ar:"جهّز نفس الفكرة بمقاسات مربع وأفقي وعمودي وقياسية حسب الاستخدام."})}</p></div></article>
          <article><div className="ai-images-about-icon"><Clapperboard/></div><div><b>{loc({en:"Built for real workflows",ar:"مصمم لسير العمل الحقيقي"})}</b><p>{loc({en:"Move the approved result into EYAD's other studios and continue the same project context.",ar:"انقل النتيجة المعتمدة إلى باقي استوديوهات إياد وكمل بنفس سياق المشروع."})}</p></div></article>
        </div>

        <div className="ai-images-about-process">
          <div><span>01</span><b>{loc({en:"Describe",ar:"اوصف"})}</b><small>{loc({en:"Your idea",ar:"فكرتك"})}</small></div>
          <i />
          <div><span>02</span><b>{loc({en:"Direct",ar:"اختار"})}</b><small>{loc({en:"Style & format",ar:"الستايل والمقاس"})}</small></div>
          <i />
          <div><span>03</span><b>{loc({en:"Create",ar:"أنشئ"})}</b><small>{loc({en:"Professional visual",ar:"الصورة الاحترافية"})}</small></div>
          <i />
          <div><span>04</span><b>{loc({en:"Continue",ar:"كمّل"})}</b><small>{loc({en:"Across EYAD studios",ar:"في باقي الاستوديوهات"})}</small></div>
        </div>

        <div className="ai-images-about-cta">
          <div><span>{loc({en:"YOUR IDEA. YOUR STYLE. YOUR IMAGE.",ar:"فكرتك. ستايلك. صورتك."})}</span><strong>{loc({en:"Create visuals that look ready for the real world.",ar:"أنشئ صورًا تبدو جاهزة للاستخدام الحقيقي."})}</strong></div>
          <button type="button" onClick={() => window.scrollTo({top:0,behavior:"smooth"})}><Sparkles/>{loc({en:"Start creating",ar:"ابدأ الإنشاء"})}</button>
        </div>
      </section>

      <nav className="ai-images-bottom-nav"><button type="button" onClick={()=>navigate("/account")}><UserRound/><span>{loc({en:"Account",ar:"الحساب"})}</span></button><button type="button" onClick={()=>navigate("/projects")}><Folder/><span>{loc({en:"Projects",ar:"أعمالي"})}</span></button><button type="button" className="is-create"><span><Plus/></span><b>{loc({en:"Create",ar:"إنشاء"})}</b></button><button type="button" onClick={()=>navigate("/search")}><Search/><span>{loc({en:"Search",ar:"البحث"})}</span></button><button type="button" onClick={()=>navigate("/")}><Home/><span>{loc({en:"Home",ar:"الرئيسية"})}</span></button></nav>
    </div>
  );
}
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ImagePlus, Sparkles, Check, Mic, Download, Maximize2, X } from "lucide-react";
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
import "./aiImagesStudio.css";

const MIN_PROMPT_LENGTH = 3;
const MAX_REFERENCES = 5;

const STYLE_REFERENCES = [
  { id: "cinematic", ar: "سينمائي", en: "Cinematic", url: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=400&q=70", prompt: "cinematic lighting, dramatic contrast, film still composition, atmospheric depth" },
  { id: "luxury", ar: "فاخر", en: "Luxury", url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=400&q=70", prompt: "luxury editorial aesthetic, premium materials, refined composition, sophisticated lighting" },
  { id: "editorial", ar: "تحريري", en: "Editorial", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=70", prompt: "high-fashion editorial photography, polished art direction, magazine aesthetic" },
  { id: "minimal", ar: "مينيمال", en: "Minimal", url: "https://images.unsplash.com/photo-1526481280695-3c687fd643ed?auto=format&fit=crop&w=400&q=70", prompt: "minimalist visual language, clean negative space, restrained palette, precise composition" },
  { id: "3d", ar: "ثري دي", en: "3D", url: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=400&q=70", prompt: "premium 3D render aesthetic, polished materials, studio lighting, dimensional forms" },
  { id: "futuristic", ar: "مستقبلي", en: "Futuristic", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=70", prompt: "futuristic design, advanced technology aesthetic, luminous details, sleek forms" },
  { id: "analog", ar: "فيلم أنالوج", en: "Analog Film", url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=70", prompt: "35mm analog film look, organic grain, natural highlights, nostalgic color response" },
  { id: "blackwhite", ar: "أبيض وأسود", en: "B&W", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=70", prompt: "high-contrast black and white photography, expressive light and shadow, timeless tone" },
  { id: "neon", ar: "نيون", en: "Neon", url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=400&q=70", prompt: "neon-lit nightlife aesthetic, vibrant luminous colors, cinematic urban atmosphere" },
  { id: "pastel", ar: "باستيل", en: "Pastel", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=70", prompt: "soft pastel palette, airy light, gentle contrast, dreamy contemporary aesthetic" },
  { id: "moody", ar: "مودي", en: "Moody", url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=400&q=70", prompt: "moody photography, deep shadows, muted tones, emotional atmosphere" },
  { id: "golden", ar: "غروب ذهبي", en: "Golden Hour", url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=70", prompt: "golden hour sunlight, warm cinematic glow, soft highlights, premium photography" },
  { id: "street", ar: "ستريت", en: "Street", url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=400&q=70", prompt: "contemporary street photography, candid energy, urban texture, authentic framing" },
  { id: "fashion", ar: "موضة", en: "Fashion", url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=400&q=70", prompt: "fashion campaign aesthetic, bold styling, controlled studio light, luxury editorial direction" },
  { id: "product", ar: "منتج", en: "Product", url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=70", prompt: "premium product photography, clean studio lighting, crisp details, commercial art direction" },
  { id: "architecture", ar: "معماري", en: "Architecture", url: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=400&q=70", prompt: "architectural photography, geometric precision, clean lines, dramatic spatial composition" },
  { id: "illustrative", ar: "إلوستريشن", en: "Illustrative", url: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=400&q=70", prompt: "modern artistic illustration, painterly texture, expressive shapes, curated color harmony" },
  { id: "dreamy", ar: "حالم", en: "Dreamy", url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=70", prompt: "dreamlike visual atmosphere, soft focus, ethereal light, poetic composition" },
  { id: "dark", ar: "دارك", en: "Dark", url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=400&q=70", prompt: "dark luxury aesthetic, rich blacks, dramatic directional light, sophisticated mood" },
  { id: "vibrant", ar: "ألوان قوية", en: "Vibrant", url: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=400&q=70", prompt: "vibrant contemporary art direction, saturated colors, energetic composition, bold visual rhythm" },
];

// w/h are the exact ratio the generated image must have.
const ASPECTS = [
  { id: "1:1", w: 1, h: 1, ar: "مربع", en: "Square", useAr: "بوست", useEn: "Post" },
  { id: "16:9", w: 16, h: 9, ar: "أفقي", en: "Wide", useAr: "يوتيوب / عرض", useEn: "YouTube / Slides" },
  { id: "9:16", w: 9, h: 16, ar: "عمودي", en: "Vertical", useAr: "ستوري / ريلز", useEn: "Story / Reels" },
  { id: "4:3", w: 4, h: 3, ar: "قياسي", en: "Standard", useAr: "عرض / طباعة", useEn: "Display / Print" },
  { id: "3:4", w: 3, h: 4, ar: "بورتريه", en: "Portrait", useAr: "بوستر / بنترست", useEn: "Poster / Pinterest" },
];

const getAspect = (id) => ASPECTS.find((item) => item.id === id) || null;
const imageSrc = (image) => image?.data_url || image?.url || "";
const imageKey = (image, index) => image?.asset_id || image?.id || image?.url || "img-" + index;

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

/**
 * Guarantees the exact aspect ratio. If the provider returned a slightly
 * different shape, centre-crop it to the requested ratio. Returns a blob URL,
 * or null when the image already matches (or cannot be processed).
 */
async function cropToAspect(src, w, h) {
  const el = await loadImageElement(src);
  const target = w / h;
  const current = el.naturalWidth / el.naturalHeight;
  if (Math.abs(current - target) / target < 0.015) return null;
  let sw = el.naturalWidth;
  let sh = el.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (current > target) { sw = Math.round(sh * target); sx = Math.round((el.naturalWidth - sw) / 2); }
  else { sh = Math.round(sw / target); sy = Math.round((el.naturalHeight - sh) / 2); }
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d").drawImage(el, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}

async function downloadImage(src, filename) {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    window.open(src, "_blank", "noopener");
  }
}

function ResultSlot({ index, image, aspect, loading, selected, onSelect, onExpand, onDownload, loc }) {
  const label = index === 0 ? "A" : "B";
  const src = imageSrc(image);
  const [displaySrc, setDisplaySrc] = React.useState(src);
  React.useEffect(() => {
    let active = true;
    let created = null;
    setDisplaySrc(src);
    if (!src || !aspect) return undefined;
    cropToAspect(src, aspect.w, aspect.h).then((cropped) => {
      if (!active) { if (cropped) URL.revokeObjectURL(cropped); return; }
      created = cropped;
      if (cropped) setDisplaySrc(cropped);
    }).catch(() => {});
    return () => { active = false; if (created) URL.revokeObjectURL(created); };
  }, [src, aspect?.w, aspect?.h]);

  const frameStyle = aspect ? { "--ar": aspect.w + " / " + aspect.h, "--ar-num": aspect.w / aspect.h } : { "--ar": "1 / 1", "--ar-num": 1 };
  const state = src ? "ready" : loading ? "loading" : "empty";
  return (
    <article className={"aiw-slot is-" + state + (selected ? " is-selected" : "")} style={frameStyle}>
      <div className="aiw-slot-frame">
        {src ? (
          <>
            <img src={displaySrc} alt={loc({ en: "Option " + label, ar: "الخيار " + label })} onClick={() => onSelect(image)} />
            <span className="aiw-slot-tag">{label}</span>
            <button type="button" className="aiw-icon-btn aiw-slot-expand" onClick={() => onExpand(displaySrc)} aria-label={loc({ en: "View larger", ar: "تكبير" })}><Maximize2 /></button>
            {selected ? <span className="aiw-slot-badge"><Check /></span> : null}
          </>
        ) : (
          <div className="aiw-slot-placeholder">
            <b>{label}</b>
            <span>{loading ? loc({ en: "Creating…", ar: "جاري الإنشاء…" }) : aspect ? aspect.id : ""}</span>
          </div>
        )}
      </div>
      <footer className="aiw-slot-foot">
        {src ? (
          <div className="aiw-slot-actions">
            <button type="button" className="aiw-icon-btn" onClick={() => onDownload(displaySrc, label)} aria-label={loc({ en: "Download", ar: "تحميل" })}><Download /></button>
            <button type="button" className={"aiw-pick" + (selected ? " is-picked" : "")} onClick={() => onSelect(image)}>
              {selected ? <><Check />{loc({ en: "Selected", ar: "تم الاختيار" })}</> : loc({ en: "Choose this", ar: "اختار دي" })}
            </button>
          </div>
        ) : null}
      </footer>
    </article>
  );
}

export default function AIImagesStudio() {
  const { loc, direction, language } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const incomingAssetId = params.get("asset");
  const [brand, setBrand] = React.useState(null);
  const [prompt, setPrompt] = React.useState("");
  // No default: the user must choose the aspect ratio before generating.
  const [aspectId, setAspectId] = React.useState(null);
  // Aspect ratio the current results were generated with (frames never change after generation).
  const [resultAspectId, setResultAspectId] = React.useState(null);
  // Ratio the results are currently shown/cropped to. The user can change it freely after generation.
  const [displayAspectId, setDisplayAspectId] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);
  const [jobId, setJobId] = React.useState(null);
  const [images, setImages] = React.useState([]);
  const [error, setError] = React.useState("");
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [referenceImages, setReferenceImages] = React.useState([]);
  const [styleReference, setStyleReference] = React.useState(null);
  const [lightboxSrc, setLightboxSrc] = React.useState(null);
  const [voiceMode, setVoiceMode] = React.useState(false);
  const [voiceRecording, setVoiceRecording] = React.useState(false);
  const [voiceProcessing, setVoiceProcessing] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");
  const mediaRecorderRef = React.useRef(null);
  const mediaStreamRef = React.useRef(null);
  const voiceChunksRef = React.useRef([]);
  const referenceInputRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const savedKeysRef = React.useRef(new Set());
  const generationAspectRef = React.useRef(null);

  const aspect = getAspect(aspectId);
  const resultAspect = getAspect(displayAspectId) || getAspect(resultAspectId) || aspect;
  const hasPrompt = prompt.trim().length >= MIN_PROMPT_LENGTH;
  const missing = [];
  if (!hasPrompt) missing.push(loc({ en: "describe your image", ar: "وصف الصورة" }));
  if (!aspect) missing.push(loc({ en: "choose an aspect ratio", ar: "نسبة العرض" }));
  const canGenerate = missing.length === 0 && !generating;

  React.useEffect(() => {
    let active = true;
    if (!incomingAssetId || incomingAssetId === "latest") return undefined;
    assetService.get(incomingAssetId).then((asset) => {
      if (!active) return;
      if (!asset?.url) {
        setError(loc({ en: "The selected design could not be loaded. Return to chat and open it again.", ar: "تعذر تحميل التصميم المحدد. ارجع للمحادثة وافتح التصميم مرة أخرى." }));
        return;
      }
      const incomingImage = { id: asset.id, asset_id: asset.id, url: asset.url, name: asset.name || "Incoming design", type: asset.mime_type || "image/png" };
      setImages([incomingImage]);
      setSelectedImage(incomingImage);
      setReferenceImages([incomingImage]);
      setError("");
    }).catch((err) => {
      console.warn("[AI Images] Could not load incoming asset", err);
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
    });
    return () => { active = false; };
  }, [projectId]);

  // On desktop the results sit beside the form; only phones/tablets need the scroll.
  const scrollStageIntoView = React.useCallback(() => {
    if (window.innerWidth >= 1024) return;
    window.setTimeout(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  const showResults = React.useCallback((list) => {
    const next = list.filter((item) => imageSrc(item)).slice(0, 2);
    if (!next.length) return false;
    setResultAspectId(generationAspectRef.current);
    setDisplayAspectId(generationAspectRef.current);
    setImages(next);
    // The user picks the best one themselves.
    setSelectedImage(null);
    setGenerating(false);
    setJobId(null);
    scrollStageIntoView();
    return true;
  }, [scrollStageIntoView]);

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
          if (!showResults(next)) {
            setError(loc({ en: "The generation completed without an image.", ar: "اكتمل التوليد بدون صورة." }));
            setGenerating(false);
            setJobId(null);
          }
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
  }, [jobId, loc, showResults]);

  const generate = async () => {
    if (generating) return;
    if (isAnonymous) {
      requireAccount();
      return;
    }
    const requestPrompt = prompt.trim();
    // Hard guard: the button is disabled, but the logic must never run with incomplete input.
    if (requestPrompt.length < MIN_PROMPT_LENGTH || !aspect) {
      setError(loc({ en: "Complete the description and aspect ratio first.", ar: "أكمل وصف الصورة واختيار نسبة العرض أولًا." }));
      return;
    }
    generationAspectRef.current = aspect.id;
    setGenerating(true);
    setError("");
    setImages([]);
    setSelectedImage(null);
    setResultAspectId(aspect.id);
    setDisplayAspectId(aspect.id);
    scrollStageIntoView();
    try {
      const data = await runEyadEngine({
        message: requestPrompt,
        projectId,
        studioId: "ai-images",
        language: direction === "rtl" ? "ar" : "en",
        action: "generate",
        referenceImage: referenceImages[0]?.data_url || referenceImages[0]?.url || brand?.logo?.url || null,
        designOptions: {
          image_type: "ai-image",
          aspect_ratio: aspect.id,
          brand_identity: brand || null,
          approved_logo_url: brand?.logo?.url || null,
          brand_name: brand?.brand_name || "",
          reference_images: referenceImages.map((item, index) => ({ index: index + 1, name: item.name || `reference-${index + 1}`, type: item.type || "image", data_url: item.data_url || item.url || null })),
          reference_image: referenceImages[0] ? { name: referenceImages[0].name || "reference-image", type: referenceImages[0].type || "image", has_data: Boolean(referenceImages[0].data_url || referenceImages[0].url) } : null,
          style_reference_image: styleReference ? { id: styleReference.id, name: styleReference.en, url: styleReference.url, prompt: styleReference.prompt } : null,
          style_reference_prompt: styleReference?.prompt || "",
        },
      });
      const list = Array.isArray(data?.images) && data.images.length ? data.images : data?.image ? [data.image] : [];
      if (list.length && showResults(list)) return;
      if (data?.job_id) {
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

  const chooseImage = (image) => {
    setSelectedImage(image);
    const key = imageKey(image, 0);
    if (projectId && !savedKeysRef.current.has(key)) {
      savedKeysRef.current.add(key);
      saveStudioOutput(projectId, {
        studioId: "ai-images",
        asset: { id: image.id || image.asset_id || null, url: image.url || image.data_url || null, data_url: image.data_url || null },
        approved: false,
        metadata: { aspect: displayAspectId || resultAspectId, generated_aspect: resultAspectId, chosen: true },
      }).catch(() => savedKeysRef.current.delete(key));
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
    const remaining = Math.max(0, MAX_REFERENCES - referenceImages.length);
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
      setReferenceImages((prev) => [...prev, ...loaded].slice(0, MAX_REFERENCES));
      setError(accepted.length < files.length ? loc({ en: "Only 5 reference images can be added.", ar: "يمكن إضافة 5 صور مرجعية فقط." }) : "");
    }).catch(() => setError(loc({ en: "Could not load the reference images.", ar: "تعذر تحميل الصور المرجعية." })));
    event.target.value = "";
  };

  const removeReferenceImage = (index) => setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  const BackIcon = direction === "rtl" ? ArrowRight : ArrowLeft;
  const slotCount = images.length === 1 && !generating ? 1 : 2;
  const stageAspect = resultAspect;
  const isLandscape = Boolean(stageAspect && stageAspect.w > stageAspect.h);
  const hasResults = images.length > 0;

  return (
    <div className="aiw" dir={direction}>
      <header className="aiw-head">
        <button type="button" className="aiw-back" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")} aria-label={loc({ en: "Back", ar: "رجوع" })}><BackIcon /></button>
        <div className="aiw-head-text">
          <h1>{loc({ en: "AI Images Studio", ar: "ستوديو الصور بالذكاء الاصطناعي" })}</h1>
          <p>{loc({ en: "Describe your idea and get two different options — pick the one you like.", ar: "اكتب فكرتك وهتطلعلك نسختين مختلفتين، وانت تختار الأفضل." })}</p>
        </div>
      </header>

      {lightboxSrc ? (
        <div className="aiw-lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxSrc(null)}>
          <button type="button" onClick={() => setLightboxSrc(null)} aria-label={loc({ en: "Close preview", ar: "إغلاق المعاينة" })}><X /></button>
          <img src={lightboxSrc} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}

      <div className="aiw-grid">
        <aside className="aiw-panel">
          <input ref={referenceInputRef} type="file" accept="image/*" multiple onChange={handleReferenceImage} style={{ display: "none" }} />

          <section className="aiw-step">
            <div className="aiw-step-head">
              <span className={"aiw-step-no" + (hasPrompt ? " is-done" : "")}>{hasPrompt ? <Check /> : "1"}</span>
              <strong>{loc({ en: "Describe your image", ar: "اوصف صورتك" })}</strong>
            </div>
            {!voiceMode ? (
              <div className="aiw-prompt">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={loc({ en: "e.g. A cup of Arabic coffee on a marble table at sunrise…", ar: "مثال: فنجان قهوة عربية على طاولة رخام وقت الشروق…" })} rows={4} />
                <div className="aiw-prompt-bar">
                  <div className="aiw-refs">
                    {referenceImages.map((item, index) => (
                      <div key={index} className="aiw-ref">
                        <button type="button" className="aiw-ref-img" onClick={() => setLightboxSrc(item.data_url || item.url)}><img src={item.data_url || item.url} alt="" /></button>
                        <button type="button" className="aiw-ref-remove" onClick={() => removeReferenceImage(index)} aria-label={loc({ en: "Remove", ar: "حذف" })}><X /></button>
                      </div>
                    ))}
                  </div>
                  <div className="aiw-prompt-tools">
                    <button type="button" className="aiw-tool" onClick={() => referenceInputRef.current?.click()} disabled={referenceImages.length >= MAX_REFERENCES} title={loc({ en: "Add reference image", ar: "إضافة صورة مرجعية" })}><ImagePlus /></button>
                    <button type="button" className="aiw-tool" onClick={() => { setVoiceMode(true); setVoiceError(""); startInlineRecording(); }} title={loc({ en: "Voice input", ar: "إدخال صوتي" })}><Mic /></button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aiw-voice">
                <div className="aiw-voice-head">
                  <span>{voiceProcessing ? loc({ en: "Converting voice to text…", ar: "جاري تحويل الصوت إلى كتابة…" }) : voiceRecording ? loc({ en: "Listening…", ar: "جاري الاستماع…" }) : loc({ en: "Voice input", ar: "الإدخال الصوتي" })}</span>
                  <button type="button" onClick={() => { if (voiceRecording) stopInlineRecording(); setVoiceMode(false); }} aria-label={loc({ en: "Close", ar: "إغلاق" })}><X /></button>
                </div>
                <div className={voiceRecording ? "aiw-wave is-recording" : "aiw-wave"} aria-hidden="true">{Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ "--i": i }} />)}</div>
                {voiceError ? <div className="aiw-voice-error">{voiceError}</div> : null}
                {voiceRecording
                  ? <button type="button" className="aiw-voice-btn" onClick={stopInlineRecording}><Mic /> {loc({ en: "Done", ar: "تم" })}</button>
                  : <button type="button" className="aiw-voice-btn" onClick={startInlineRecording} disabled={voiceProcessing}><Mic /> {loc({ en: "Record again", ar: "تسجيل مرة أخرى" })}</button>}
              </div>
            )}
          </section>

          <section className="aiw-step">
            <div className="aiw-step-head">
              <span className={"aiw-step-no" + (aspect ? " is-done" : "")}>{aspect ? <Check /> : "2"}</span>
              <strong>{loc({ en: "Aspect ratio", ar: "نسبة العرض" })}</strong>
              {aspect ? <em>{loc({ en: aspect.useEn, ar: aspect.useAr })}</em> : null}
            </div>
            <div className="aiw-aspects" role="radiogroup" aria-label={loc({ en: "Aspect ratio", ar: "نسبة العرض" })}>
              {ASPECTS.map((item) => (
                <button key={item.id} type="button" role="radio" aria-checked={aspectId === item.id} className={aspectId === item.id ? "is-active" : ""} onClick={() => setAspectId(item.id)} title={loc({ en: item.useEn, ar: item.useAr })}>
                  <span className="aiw-ratio" style={{ "--rw": item.w, "--rh": item.h }} />
                  <b>{item.id}</b>
                  <small>{loc({ en: item.en, ar: item.ar })}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="aiw-step">
            <div className="aiw-step-head">
              <span className={"aiw-step-no" + (styleReference ? " is-done" : " is-optional")}>{styleReference ? <Check /> : "3"}</span>
              <strong>{loc({ en: "Visual style", ar: "الستايل" })}</strong>
              <em>{loc({ en: "optional", ar: "اختياري" })}</em>
              {styleReference ? <button type="button" className="aiw-clear" onClick={() => setStyleReference(null)}>{loc({ en: "Clear", ar: "إلغاء" })}</button> : null}
            </div>
            <div className="aiw-styles">
              {STYLE_REFERENCES.map((style) => (
                <button key={style.id} type="button" className={styleReference?.id === style.id ? "is-selected" : ""} onClick={() => setStyleReference(styleReference?.id === style.id ? null : style)}>
                  <img src={style.url} alt="" loading="lazy" />
                  <span>{loc({ en: style.en, ar: style.ar })}</span>
                  {styleReference?.id === style.id ? <b><Check /></b> : null}
                </button>
              ))}
            </div>
          </section>

          <div className="aiw-cta">
            {error ? <div className="aiw-error" role="alert">{error}</div> : null}
            <button type="button" className="aiw-generate" onClick={() => generate()} disabled={!canGenerate} aria-disabled={!canGenerate}>
              {generating ? <><span className="aiw-spinner" />{loc({ en: "Creating 2 options…", ar: "جاري إنشاء نسختين…" })}</> : <><Sparkles />{loc({ en: "Create 2 options", ar: "إنشاء نسختين" })}</>}
            </button>
            {!generating && missing.length ? <p className="aiw-missing">{loc({ en: "Still needed: ", ar: "لسه ناقص: " })}{missing.join(loc({ en: ", ", ar: "، " }))}</p> : null}
          </div>
        </aside>

        <section className="aiw-stage" ref={stageRef}>
          <div className="aiw-stage-head">
            <strong>{hasResults ? loc({ en: "Pick your favourite", ar: "اختار الأفضل بالنسبة لك" }) : loc({ en: "Your results", ar: "النتائج" })}</strong>
            {!hasResults && stageAspect ? <span>{stageAspect.id}</span> : null}
          </div>
          {hasResults && !generating ? (
            <div className="aiw-reframe">
              <span>{loc({ en: "Change ratio", ar: "غيّر النسبة" })}</span>
              <div role="radiogroup" aria-label={loc({ en: "Change ratio", ar: "غيّر النسبة" })}>
                {ASPECTS.map((item) => (
                  <button key={item.id} type="button" role="radio" aria-checked={stageAspect?.id === item.id} className={stageAspect?.id === item.id ? "is-active" : ""} onClick={() => setDisplayAspectId(item.id)}>
                    <i className="aiw-ratio" style={{ "--rw": item.w, "--rh": item.h }} />{item.id}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className={"aiw-slots" + (isLandscape ? " is-landscape" : "") + (slotCount === 1 ? " is-single" : "")}>
            {Array.from({ length: slotCount }).map((_, index) => (
              <ResultSlot
                key={index}
                index={index}
                image={images[index]}
                aspect={stageAspect}
                loading={generating}
                selected={Boolean(images[index]) && selectedImage === images[index]}
                onSelect={chooseImage}
                onExpand={setLightboxSrc}
                onDownload={(src, label) => downloadImage(src, "eyad-image-" + label + ".png")}
                loc={loc}
              />
            ))}
          </div>
          {!hasResults && !generating ? (
            <p className="aiw-stage-note">{loc({ en: "Two different versions of your idea will appear here, in the exact ratio you chose.", ar: "هتظهر هنا نسختين مختلفتين من فكرتك، بنفس النسبة اللي اخترتها بالظبط." })}</p>
          ) : null}
          {hasResults && resultAspectId && stageAspect && stageAspect.id !== resultAspectId ? (
            <p className="aiw-stage-note">{loc({ en: "The image is framed from the original (" + resultAspectId + "), so some edges may be trimmed. Switch back anytime.", ar: "الصورة متقصوصة من الأصل (" + resultAspectId + ") فممكن أطراف تتشال. تقدر ترجع للنسبة الأصلية في أي وقت." })}</p>
          ) : null}
          {hasResults && !selectedImage ? (
            <p className="aiw-stage-note">{loc({ en: "Tap the image you like best to continue with it.", ar: "اضغط على الصورة اللي عجبتك علشان تكمل بيها." })}</p>
          ) : null}
          {selectedImage ? (
            <div className="aiw-next">
              <StudioNextActions projectId={projectId} fromStudio="ai-images" asset={selectedImage} title={loc({ en: "Continue with this image", ar: "كمّل باستخدام الصورة دي" })} description={loc({ en: "The project context stays attached.", ar: "بيانات المشروع والهوية تفضل مرتبطة." })} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

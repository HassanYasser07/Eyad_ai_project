import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Film, Sparkles, Wand2, Download, RefreshCw, Palette } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { jobService } from "@/services/jobService";
import { getBrandIdentity } from "@/services/brandService";
import { projectService } from "@/services/projectService";
import { getProjectContext, saveStudioOutput } from "@/services/projectContextService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import "./videoStudio.css";

const DURATIONS = [
  { id: "5s", ar: "5 ثواني", en: "5 sec" },
  { id: "10s", ar: "10 ثواني", en: "10 sec" },
  { id: "15s", ar: "15 ثانية", en: "15 sec" },
];

const ASPECTS = [
  { id: "16:9", ar: "أفقي", en: "Landscape" },
  { id: "9:16", ar: "عمودي", en: "Portrait" },
  { id: "1:1", ar: "مربع", en: "Square" },
];

const STYLES = [
  { id: "cinematic", ar: "سينمائي", en: "Cinematic" },
  { id: "commercial", ar: "إعلاني", en: "Commercial" },
  { id: "social", ar: "سوشيال ميديا", en: "Social" },
  { id: "minimal", ar: "مينيمال", en: "Minimal" },
];

function getVideoUrl(data) {
  return data?.video?.url || data?.video?.video_url || data?.video_url || data?.videoUrl || data?.url || null;
}

export default function VideoStudio() {
  const { loc, direction } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const incomingAssetId = params.get("asset");
  const [brand, setBrand] = React.useState(null);
  const [projectContext, setProjectContext] = React.useState(null);
  const [prompt, setPrompt] = React.useState("");
  const [duration, setDuration] = React.useState("10s");
  const [aspect, setAspect] = React.useState("16:9");
  const [style, setStyle] = React.useState("cinematic");
  const [generating, setGenerating] = React.useState(false);
  const [jobId, setJobId] = React.useState(null);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [generationId, setGenerationId] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    Promise.all([
      getBrandIdentity(projectId).catch(() => null),
      getProjectContext(projectId).catch(() => null),
      projectService.get(projectId).catch(() => null),
    ]).then(([brandData, context, project]) => {
      if (!active) return;
      setBrand(brandData);
      setProjectContext(context);
      const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
      if (inheritedPrompt) setPrompt(inheritedPrompt);
      const source = context?.approvedAsset?.url || context?.latestAsset?.url;
      if (source && !inheritedPrompt && !prompt) {
        setPrompt(loc({
          en: "Create a premium brand video using the approved creative as visual reference.",
          ar: "أنشئ فيديو احترافي للعلامة باستخدام التصميم المعتمد كمرجع بصري."
        }));
      }
    });
    return () => { active = false; };
  }, [projectId, loc]);

  React.useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const data = await jobService.pollGeneration(jobId);
        if (!active || !data) return;
        const nextUrl = getVideoUrl(data);
        if (data.status === "generated" || data.status === "completed") {
          if (nextUrl) {
            setVideoUrl(nextUrl);
            setGenerationId(data.generation_id || data.id || jobId);
            if (projectId) {
              await saveStudioOutput(projectId, {
                studioId: "video",
                asset: { id: data.asset_id || data.id || jobId, url: nextUrl, generation_id: data.generation_id || data.id || jobId },
                approved: false,
                metadata: { duration, aspect, style, source_asset_id: incomingAssetId || null },
              });
            }
          } else {
            setError(loc({ en: "The video job completed without a video URL.", ar: "اكتملت العملية بدون رابط فيديو." }));
          }
          setGenerating(false);
          setJobId(null);
        } else if (data.status === "failed") {
          setError(data.error || loc({ en: "Video generation failed.", ar: "فشل توليد الفيديو." }));
          setGenerating(false);
          setJobId(null);
        }
      } catch (err) {
        if (attempts >= 60 && active) {
          setError(err?.message || loc({ en: "Could not read the video job status.", ar: "تعذر قراءة حالة توليد الفيديو." }));
          setGenerating(false);
          setJobId(null);
        }
      }
      if (attempts >= 60 && active) {
        setError(loc({ en: "The video is still processing. You can return later.", ar: "الفيديو ما زال قيد التنفيذ. يمكنك العودة لاحقًا." }));
        setGenerating(false);
        setJobId(null);
      }
    }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [jobId, projectId, duration, aspect, style, incomingAssetId, loc]);

  const generate = async () => {
    if (isAnonymous) {
      requireAccount();
      return;
    }
    if (!prompt.trim()) {
      setError(loc({ en: "Describe the video first.", ar: "اكتب وصف الفيديو أولًا." }));
      return;
    }
    setGenerating(true);
    setError("");
    setVideoUrl("");
    setGenerationId(null);
    try {
      const referenceImage =
        projectContext?.approvedAsset?.url ||
        brand?.logo?.url ||
        projectContext?.latestAsset?.url ||
        null;
      const data = await runEyadEngine({
        message: prompt.trim(),
        projectId,
        studioId: "video",
        language: direction === "rtl" ? "ar" : "en",
        action: "generate",
        referenceImage,
        designOptions: {
          media_type: "video",
          duration,
          aspect_ratio: aspect,
          visual_style: style,
          brand_identity: brand || null,
          approved_logo_url: brand?.logo?.url || null,
          approved_asset_url: projectContext?.approvedAsset?.url || null,
          source_asset_id: incomingAssetId || null,
        },
      });
      const nextUrl = getVideoUrl(data);
      if (nextUrl) {
        setVideoUrl(nextUrl);
        setGenerationId(data.generation_id || data.id || null);
        if (projectId) {
          await saveStudioOutput(projectId, {
            studioId: "video",
            asset: { id: data.asset_id || data.id || null, url: nextUrl, generation_id: data.generation_id || data.id || null },
            approved: false,
            metadata: { duration, aspect, style, source_asset_id: incomingAssetId || null },
          });
        }
        setGenerating(false);
      } else if (data?.job_id) {
        setJobId(data.job_id);
      } else {
        setError(data?.reply || loc({
          en: "The video engine did not return a video or a background job.",
          ar: "محرك الفيديو لم يُرجع فيديو أو عملية تنفيذ في الخلفية."
        }));
        setGenerating(false);
      }
    } catch (err) {
      setError(err?.message || loc({ en: "Video generation failed.", ar: "فشل توليد الفيديو." }));
      setGenerating(false);
    }
  };

  return (
    <div className="video-studio-page" dir={direction}>
      <header className="video-studio-head">
        <button type="button" className="video-studio-back" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")}>
          {direction === "rtl" ? <ArrowRight /> : <ArrowLeft />}
          {loc({ en: "Back", ar: "رجوع" })}
        </button>
        <div>
          <span className="video-studio-kicker"><Sparkles /> {loc({ en: "EYAD AI", ar: "إياد AI" })}</span>
          <h1>{loc({ en: "Video Studio", ar: "ستوديو الفيديو" })}</h1>
          <p>{loc({ en: "Turn your project idea and approved brand assets into video.", ar: "حوّل فكرة المشروع وأصول الهوية المعتمدة إلى فيديو." })}</p>
        </div>
      </header>

      {projectId && (
        <div className="video-studio-brand">
          <div className="video-studio-brand-mark">
            {brand?.logo?.url ? <img src={brand.logo.url} alt="" /> : <Palette />}
          </div>
          <div>
            <strong>{brand?.brand_name || projectContext?.project?.name || loc({ en: "Current project", ar: "المشروع الحالي" })}</strong>
            <span>{loc({ en: "Project context connected", ar: "بيانات المشروع متصلة تلقائيًا" })}</span>
          </div>
          {brand?.palette?.swatches?.length ? <div className="video-studio-swatches">{brand.palette.swatches.slice(0, 5).map((c) => <i key={c} style={{ background: c }} />)}</div> : null}
        </div>
      )}

      <main className="video-studio-workspace">
        <section className="video-studio-controls">
          <div className="video-studio-title"><Wand2 /> {loc({ en: "Describe your video", ar: "اوصف الفيديو" })}</div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder={loc({ en: "Example: A cinematic product reveal with elegant camera movement, premium lighting and a clean branded ending.", ar: "مثال: ظهور سينمائي لمنتج مع حركة كاميرا أنيقة وإضاءة فاخرة ونهاية تحمل الهوية." })} />

          <div className="video-studio-label">{loc({ en: "Duration", ar: "المدة" })}</div>
          <div className="video-studio-options">{DURATIONS.map((item) => <button key={item.id} className={duration === item.id ? "is-active" : ""} type="button" onClick={() => setDuration(item.id)}>{loc({ en: item.en, ar: item.ar })}</button>)}</div>

          <div className="video-studio-label">{loc({ en: "Format", ar: "المقاس" })}</div>
          <div className="video-studio-options">{ASPECTS.map((item) => <button key={item.id} className={aspect === item.id ? "is-active" : ""} type="button" onClick={() => setAspect(item.id)}>{item.id} · {loc({ en: item.en, ar: item.ar })}</button>)}</div>

          <div className="video-studio-label">{loc({ en: "Style", ar: "الأسلوب" })}</div>
          <div className="video-studio-options">{STYLES.map((item) => <button key={item.id} className={style === item.id ? "is-active" : ""} type="button" onClick={() => setStyle(item.id)}>{loc({ en: item.en, ar: item.ar })}</button>)}</div>

          <button type="button" className="video-studio-generate" onClick={generate} disabled={generating}>
            {generating ? <><span className="video-studio-spinner" /> {loc({ en: "Creating video…", ar: "جاري إنشاء الفيديو…" })}</> : <><Sparkles /> {loc({ en: "Generate Video", ar: "إنشاء الفيديو" })}</>}
          </button>
          {error && <div className="video-studio-error">{error}</div>}
        </section>

        <section className="video-studio-result">
          {generating ? (
            <div className="video-studio-empty">
              <div className="video-studio-orb"><span /><span /><span /></div>
              <strong>{loc({ en: "EYAD is creating your video", ar: "إياد بيجهز الفيديو" })}</strong>
              <small>{loc({ en: "The project context stays attached while the job runs.", ar: "بيانات المشروع تظل متصلة أثناء التنفيذ." })}</small>
            </div>
          ) : videoUrl ? (
            <div className="video-studio-output">
              <StudioNextActions projectId={projectId} fromStudio="video" asset={{ id: generationId, url: videoUrl }} title={loc({ en: "Video created. Choose the next step", ar: "تم إنشاء الفيديو. اختر الخطوة التالية" })} description={loc({ en: "Continue with the same project context.", ar: "كمل بنفس بيانات المشروع والهوية." })} />
              <div className="video-studio-player-wrap">
                <video controls playsInline src={videoUrl} />
              </div>
              <div className="video-studio-output-actions">
                <button type="button" onClick={async () => {
                  const response = await fetch(videoUrl, { mode: "cors" });
                  if (!response.ok) throw new Error("DOWNLOAD_FETCH_FAILED");
                  const blob = await response.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = objectUrl;
                  link.download = "eyad-video.mp4";
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                }}><Download /> {loc({ en: "Download", ar: "تحميل" })}</button>
                <button type="button" onClick={generate}><RefreshCw /> {loc({ en: "Generate again", ar: "توليد مرة أخرى" })}</button>
              </div>
            </div>
          ) : (
            <div className="video-studio-empty">
              <Film />
              <strong>{loc({ en: "Your video will appear here", ar: "الفيديو الناتج هيظهر هنا" })}</strong>
              <small>{loc({ en: "Your approved brand and project assets can be used as context.", ar: "يمكن استخدام الهوية والأصول المعتمدة كمرجع تلقائي." })}</small>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

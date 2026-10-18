import React from "react";
import { ArrowLeft, ArrowRight, Check, PencilRuler, Presentation, Sparkles, Wand2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { projectService } from "@/services/projectService";
import { getBrandIdentity } from "@/services/brandService";
import StudioNextActions from "@/components/studios/StudioNextActions";
// Separate, lazily loaded editing environment; it does not touch the generation workflow below.
const PptxEditorDialog = React.lazy(() => import("@/components/pptxEditor/PptxEditorDialog"));

export default function PresentationsStudio() {
  const { t, loc, direction } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const [brand, setBrand] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [prompt, setPrompt] = React.useState("");
  const [slides, setSlides] = React.useState([]);
  const [generating, setGenerating] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pptxEditorOpen, setPptxEditorOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    projectService.get(projectId).then(async (project) => {
      if (!active) return;
      setProfile(project?.project_data?.company_profile || null);
      const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
      if (inheritedPrompt) setPrompt(inheritedPrompt);
      const identity = await getBrandIdentity(projectId);
      if (active) setBrand(identity);
    }).catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  const generate = async () => {
    if (isAnonymous) { requireAccount(window.location.pathname + window.location.search); return; }
    if (!projectId) { requireAccount(window.location.pathname + window.location.search); return; }
    if (!prompt.trim()) {
      setError(loc({ ar: "اكتب هدف العرض أولًا.", en: "Describe the presentation goal first." }));
      return;
    }
    setGenerating(true); setError(""); setSaved(false);
    try {
      const data = await runEyadEngine({
        message: prompt.trim(),
        projectId,
        studioId: "presentations",
        language: direction === "rtl" ? "ar" : "en",
        action: "chat",
        designOptions: {
          presentation: true,
          company_profile: profile || {},
          brand_identity: brand || {},
          instruction: "Create a concise presentation plan. Return JSON only with a title and an array named slides. Each slide must have title and 2-4 short bullet points.",
        },
      });
      let parsed = null;
      try {
        const raw = String(data?.reply || "").replace(/\`\`\`json|\`\`\`/g, "").trim();
        parsed = JSON.parse(raw);
      } catch {}
      const next = Array.isArray(parsed?.slides) ? parsed.slides : [
        { title: data?.reply || loc({ ar: "مخطط العرض", en: "Presentation outline" }), bullets: [] },
      ];
      setSlides(next);
      const project = await projectService.get(projectId);
      const pd = project?.project_data || {};
      await projectService.update(projectId, {
        project_data: {
          ...pd,
          presentation: {
            title: parsed?.title || prompt.trim(),
            slides: next,
            source_prompt: prompt.trim(),
            updated_at: new Date().toISOString(),
          },
          last_studio_id: "presentations",
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err?.message || loc({ ar: "تعذر إنشاء العرض.", en: "Could not create the presentation." }));
    } finally { setGenerating(false); }
  };

  return (
    <div className="min-h-full px-4 py-6 md:px-8" dir={direction}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <button type="button" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
            {direction === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {loc({ ar: "رجوع", en: "Back" })}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPptxEditorOpen(true)} data-testid="open-pptx-editor" className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white px-3 py-2 text-xs font-extrabold text-primary shadow-sm hover:bg-primary/5">
              <PencilRuler className="h-4 w-4" />
              <span>{t("pptxEditor.title")}</span>
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/70 border border-white shadow-sm text-xs font-bold text-indigo-700">
              <Presentation className="w-4 h-4" />
              {loc({ ar: "ستوديو العروض التقديمية", en: "Presentation Studio" })}
            </div>
          </div>
        </header>

        {brand && (
          <div className="mb-6 rounded-3xl border border-white bg-white/65 backdrop-blur-xl shadow-sm p-4 flex items-center gap-3">
            {brand.logo?.url && <img src={brand.logo.url} alt="" className="w-12 h-12 object-contain rounded-2xl bg-white p-2" />}
            <div><strong className="block text-sm">{brand.brand_name}</strong><span className="text-xs text-slate-400">{loc({ ar: "الهوية المعتمدة متصلة", en: "Approved brand identity connected" })}</span></div>
            {profile?.companyName && <span className="ml-auto text-xs font-bold text-slate-500">{profile.companyName}</span>}
          </div>
        )}

        <div className="grid lg:grid-cols-[420px_1fr] gap-6">
          <section className="rounded-[28px] border border-white bg-white/70 backdrop-blur-xl shadow-sm p-6 h-fit">
            <Wand2 className="w-6 h-6 text-indigo-500 mb-4" />
            <h1 className="text-2xl font-black text-slate-900">{loc({ ar: "أنشئ عرضك بالذكاء الاصطناعي", en: "Build a presentation with AI" })}</h1>
            <p className="text-sm text-slate-500 mt-2">{loc({ ar: "إياد سيستخدم بيانات الشركة والهوية المعتمدة لبناء هيكل العرض.", en: "EYAD uses the company profile and approved brand identity to build the deck structure." })}</p>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} className="w-full mt-5 rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-indigo-300" placeholder={loc({ ar: "مثال: عرض تعريفي من 8 شرائح لشركة عقارات...", en: "Example: an 8-slide company introduction for a real-estate company..." })} />
            <button type="button" onClick={generate} disabled={generating} className="w-full mt-4 h-12 rounded-2xl bg-slate-900 text-white font-black inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Sparkles className="w-4 h-4" /> {generating ? loc({ ar: "جاري إنشاء العرض...", en: "Creating presentation..." }) : loc({ ar: "إنشاء العرض", en: "Create presentation" })}
            </button>
            {saved && <div className="mt-3 text-xs font-bold text-emerald-600 inline-flex items-center gap-1"><Check className="w-4 h-4" /> {loc({ ar: "تم حفظ العرض داخل المشروع", en: "Presentation saved to project" })}</div>}
            {error && <div className="mt-3 text-xs font-bold text-red-500">{error}</div>}
          </section>

          <section className="rounded-[28px] border border-white bg-white/70 backdrop-blur-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5"><strong className="text-lg font-black">{loc({ ar: "هيكل العرض", en: "Presentation outline" })}</strong>{slides.length > 0 && <span className="text-xs text-slate-400">{slides.length} {loc({ ar: "شرائح", en: "slides" })}</span>}</div>
            {slides.length ? (
              <div className="space-y-3">
                {slides.map((slide, i) => (
                  <article key={i} className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                    <div className="flex gap-3"><span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center text-xs font-black">{i + 1}</span><div><h2 className="font-black text-slate-800">{slide.title}</h2>{Array.isArray(slide.bullets) && <ul className="mt-2 space-y-1 text-sm text-slate-500">{slide.bullets.map((b,j)=><li key={j}>• {b}</li>)}</ul>}</div></div>
                  </article>
                ))}
              </div>
            ) : <div className="min-h-80 grid place-items-center text-center text-slate-400"><div><Presentation className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>{loc({ ar: "هيكل العرض سيظهر هنا", en: "Your presentation outline will appear here" })}</p></div></div>}
          </section>
        </div>

        {projectId && slides.length > 0 && <StudioNextActions projectId={projectId} fromStudio="presentations" asset={null} title={loc({ ar: "تم تجهيز هيكل العرض. اختر الخطوة التالية", en: "Presentation structure is ready. Choose the next step" })} description={loc({ ar: "بيانات الشركة والهوية تظل مرتبطة بالمشروع.", en: "Company data and brand identity remain attached to the project." })} />}
      </div>
      {pptxEditorOpen && (<React.Suspense fallback={null}><PptxEditorDialog onClose={() => setPptxEditorOpen(false)} /></React.Suspense>)}
    </div>
  );
}

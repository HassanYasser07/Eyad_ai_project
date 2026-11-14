import React from "react";
import { ArrowLeft, ArrowRight, PencilRuler, Presentation } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { projectService } from "@/services/projectService";
import { getBrandIdentity } from "@/services/brandService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import DesktopShell from "@/components/home/DesktopShell";
import PromptComposer from "@/components/presentations/PromptComposer";
import { extractPresentationTopic } from "@/components/presentations/presentationTopic";
import TemplateGallery from "@/components/presentations/TemplateGallery";
import PresentationResult from "@/components/presentations/PresentationResult";
import { usePresentationGeneration } from "@/components/presentations/usePresentationGeneration";
import { fieldMessage } from "@/components/presentations/presentationMessages";
import {
  DEFAULT_PRESENTATION_SETTINGS, DETAIL_OPTIONS, PRESENTATION_LANGUAGES, SLIDE_COUNT_OPTIONS,
} from "@/config/presentationOptions";
import { fetchTemplatePptx } from "@/services/templateService";
import { fetchPresentationFile } from "@/services/presentationService";
import { errorMessage as presentationErrorMessage } from "@/components/presentations/presentationMessages";
import { buildSettingsPayload, validatePresentationSettings } from "@/config/presentationValidation";
// Separate, lazily loaded editing environment; it does not touch the generation workflow below.
const createPptxEditorComponent = () => React.lazy(() => import("@/components/pptxEditor/PptxEditorDialog"));

// Keep a lazy editor failure local to the editor rather than blanking the whole studio.
class PptxEditorLoadBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Test Presentation Editor failed to load:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { onRetry, onClose, loc } = this.props;
    return (
      <div className="fixed inset-0 z-[10001] grid place-items-center bg-slate-950/55 p-4" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="text-lg font-black text-slate-900">{loc({ ar: "تعذر فتح محرر العروض", en: "The presentation editor could not open" })}</h2>
          <p className="mt-2 break-words text-sm text-slate-600">{loc({ ar: "حدث خطأ أثناء تحميل المحرر. يمكنك إعادة المحاولة أو مراجعة التفاصيل التقنية أدناه.", en: "An error occurred while loading the editor. Retry or inspect the technical details below." })}</p>
          {this.state.error?.message && (
            <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
              <summary className="cursor-pointer text-xs font-bold text-amber-900">{loc({ ar: "التفاصيل التقنية", en: "Technical details" })}</summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-amber-950">{String(this.state.error.message)}</pre>
            </details>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">{loc({ ar: "إغلاق", en: "Close" })}</button>
            <button type="button" onClick={onRetry} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{loc({ ar: "إعادة المحاولة", en: "Try again" })}</button>
          </div>
        </div>
      </div>
    );
  }
}

export default function PresentationsStudio() {
  const { t, loc, direction } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const [brand, setBrand] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [settings, setSettings] = React.useState({ ...DEFAULT_PRESENTATION_SETTINGS });
  const [file, setFile] = React.useState(null); // { name, size, text, truncated } extracted from "Add File"
  const [template, setTemplate] = React.useState(null); // row picked in the gallery
  const [errors, setErrors] = React.useState({});
  // Returning from /login after a save attempt: reopen the editor so it can restore the deck from its local draft.
  const [pptxEditorOpen, setPptxEditorOpen] = React.useState(() => { try { return !!sessionStorage.getItem("eyad_pptx_resume"); } catch { return false; } });
  const [editorFile, setEditorFile] = React.useState(null); // { bytes, name } handed to the editor (a template's .pptx)
  const [openingTemplateId, setOpeningTemplateId] = React.useState(null);
  const [templateError, setTemplateError] = React.useState("");
  const [openingResult, setOpeningResult] = React.useState(false);
  const [resultOpenError, setResultOpenError] = React.useState("");
  const [pptxEditorAttempt, setPptxEditorAttempt] = React.useState(0);
  const [PptxEditorComponent, setPptxEditorComponent] = React.useState(() => createPptxEditorComponent());
  const formRef = React.useRef(null);
  const retryPptxEditor = () => {
    setPptxEditorAttempt((attempt) => attempt + 1);
    setPptxEditorComponent(() => createPptxEditorComponent());
  };

  // After Gamma confirms a finished presentation, remember its link on the project (non-fatal if it fails).
  const saveToProject = React.useCallback(async (job) => {
    if (!projectId || !job?.gamma_url) return;
    try {
      const project = await projectService.get(projectId);
      const pd = project?.project_data || {};
      await projectService.update(projectId, {
        project_data: {
          ...pd,
          gamma_presentation: { job_id: job.id, gamma_url: job.gamma_url, updated_at: new Date().toISOString() },
          last_studio_id: "presentations",
        },
      });
    } catch (err) {
      console.warn("Could not save the presentation link to the project", err?.message);
    }
  }, [projectId]);

  const generation = usePresentationGeneration({ onCompleted: saveToProject });
  const { phase, job, error: genError, timedOut, busy } = generation;

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    projectService.get(projectId).then(async (project) => {
      if (!active) return;
      setProfile(project?.project_data?.company_profile || null);
      // The project keeps the raw chat request ("عايز اعمل بريزنتيشن عن ..."); only the actual topic belongs in the box.
      const inheritedPrompt = String(project?.presentation_brief?.topic || "").trim() || extractPresentationTopic(String(project?.initial_prompt || project?.description || ""));
      if (inheritedPrompt) setSettings((prev) => (prev.topic ? prev : { ...prev, topic: inheritedPrompt }));
      const identity = await getBrandIdentity(projectId);
      // "Approved brand identity connected" is only true when an identity was really approved (logo, palette, fonts or
      // background). A bare name derived from the chat message must never trigger the banner.
      const hasApprovedIdentity = Boolean(identity && (identity.logo?.url || identity.palette || identity.typography || identity.background));
      const savedName = String(project?.project_data?.brand_identity?.brand_name || project?.project_data?.logo_brief?.name || "").trim();
      if (active) setBrand(hasApprovedIdentity ? { ...identity, brand_name: savedName } : null);
    }).catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  // Server-side validation errors are shown next to their fields.
  React.useEffect(() => {
    if (genError?.fields) setErrors(genError.fields);
  }, [genError]);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (busy) return; // no duplicate requests while one is running
    if (isAnonymous) { requireAccount(window.location.pathname + window.location.search); return; }
    const found = validatePresentationSettings(settings, file);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector("[data-field=\"topic\"]")?.focus?.());
      return;
    }
    await generation.start({ settings: buildSettingsPayload(settings, file), projectId, templateId: template?.id || null });
  };

  const closeEditor = () => { setPptxEditorOpen(false); setEditorFile(null); };

  // The deck that was just generated is already saved in the project: open that stored .pptx in the editor.
  const openGeneratedInEditor = async () => {
    if (!job?.project_id || openingResult) return;
    setOpeningResult(true);
    setResultOpenError("");
    try {
      const opened = await fetchPresentationFile(job.project_id, job.version_id || null);
      setEditorFile({ bytes: opened.bytes, name: opened.name, projectId: job.project_id, versionId: opened.version?.id || job.version_id || null, versionNo: opened.version?.version_no ?? job.version_no ?? null });
      setPptxEditorOpen(true);
    } catch (err) {
      setResultOpenError(presentationErrorMessage(err.code, loc, err.detail));
    } finally {
      setOpeningResult(false);
    }
  };

  // A template with a .pptx opens straight in the editor; one without a file is attached to the prompt as before.
  const pickTemplate = async (picked) => {
    if (openingTemplateId) return;
    setTemplateError("");
    if (!picked.pptx_path) {
      setTemplate((current) => (current?.id === picked.id ? null : picked));
      requestAnimationFrame(() => formRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" }));
      return;
    }
    setOpeningTemplateId(picked.id);
    try {
      const opened = await fetchTemplatePptx(picked, loc({ ar: picked.title_ar, en: picked.title_en }));
      setEditorFile(opened);
      setPptxEditorOpen(true);
    } catch (err) {
      console.warn("Could not open the template in the editor", err?.message);
      setTemplateError(loc({ ar: "تعذّر فتح القالب. حاول مرة أخرى.", en: "Could not open the template. Please try again." }));
    } finally {
      setOpeningTemplateId(null);
    }
  };

  const topicError = errors.topic ? fieldMessage(errors.topic === "REQUIRED" ? "TOPIC_REQUIRED" : errors.topic, loc) : "";

  return (
    <DesktopShell>
    <div className="min-h-full bg-[radial-gradient(70%_45%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%)] px-4 py-3 md:px-8" dir={direction}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")} className="inline-flex min-h-[2rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary">
            {direction === "rtl" ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            {loc({ ar: "رجوع", en: "Back" })}
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPptxEditorOpen(true)} data-testid="open-pptx-editor" className="inline-flex min-h-[2rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/25 bg-card px-3 py-1 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-primary/10">
              <PencilRuler className="h-3.5 w-3.5 shrink-0" />
              <span>{t("pptxEditor.title")}</span>
            </button>
            <div className="inline-flex min-h-[2rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-br from-primary to-violet-600 px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/20">
              <Presentation className="h-3.5 w-3.5 shrink-0" />
              {loc({ ar: "ستوديو العروض التقديمية", en: "Presentation Studio" })}
            </div>
          </div>
        </header>

        {brand && (
          <div className="mx-auto mb-6 flex max-w-4xl items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            {brand.logo?.url && <img src={brand.logo.url} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-2" />}
            <div>{brand.brand_name && <strong className="block text-sm text-foreground">{brand.brand_name}</strong>}<span className="text-xs text-muted-foreground">{loc({ ar: "الهوية المعتمدة متصلة", en: "Approved brand identity connected" })}</span></div>
            {profile?.companyName && <span className="ms-auto text-xs font-bold text-muted-foreground">{profile.companyName}</span>}
          </div>
        )}

        <div className="mx-auto max-w-4xl">
          <h1 className="mb-3 text-balance text-center text-base font-extrabold leading-tight text-foreground md:text-lg">
            {loc({ ar: "اكتب موضوعك، وأنشئ محتوى العرض الآن", en: "Enter your topic, generate the presentation content now" })}
          </h1>

          <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
            <PromptComposer
              settings={settings} onChange={update} error={topicError} busy={busy} loc={loc}
              detailOptions={DETAIL_OPTIONS} slideOptions={SLIDE_COUNT_OPTIONS} languageOptions={PRESENTATION_LANGUAGES}
              file={file} onFileChange={setFile} template={template} onClearTemplate={() => setTemplate(null)}
            />
          </form>

          {phase !== "idle" && (
            <aside aria-label={loc({ ar: "نتيجة التوليد", en: "Generation result" })} className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
              <PresentationResult phase={phase} job={job} error={genError} timedOut={timedOut} loc={loc}
                onRetry={submit} onRecheck={generation.recheck}
                onOpenEditor={openGeneratedInEditor} openingEditor={openingResult} openError={resultOpenError} />
            </aside>
          )}
        </div>

        <TemplateGallery selectedId={template?.id || null} onSelect={pickTemplate} openingId={openingTemplateId} error={templateError} loc={loc} />

        {projectId && phase === "completed" && <StudioNextActions projectId={projectId} fromStudio="presentations" asset={null} title={loc({ ar: "تم إنشاء العرض. اختر الخطوة التالية", en: "Presentation is ready. Choose the next step" })} description={loc({ ar: "بيانات الشركة والهوية تظل مرتبطة بالمشروع.", en: "Company data and brand identity remain attached to the project." })} />}
      </div>
      {pptxEditorOpen && (
        <PptxEditorLoadBoundary
          key={pptxEditorAttempt}
          loc={loc}
          onClose={closeEditor}
          onRetry={retryPptxEditor}
        >
          <React.Suspense fallback={
            <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/35 p-4" role="status" aria-live="polite">
              <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold text-slate-700 shadow-xl">{loc({ ar: "جاري تحميل محرر العروض…", en: "Loading the presentation editor…" })}</div>
            </div>
          }>
            <PptxEditorComponent onClose={closeEditor} initialFile={editorFile} />
          </React.Suspense>
        </PptxEditorLoadBoundary>
      )}
    </div>
    </DesktopShell>
  );
}

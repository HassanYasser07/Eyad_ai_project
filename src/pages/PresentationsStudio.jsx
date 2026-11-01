import React from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, PencilRuler, Presentation, Sparkles, Wand2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { projectService } from "@/services/projectService";
import { getBrandIdentity } from "@/services/brandService";
import StudioNextActions from "@/components/studios/StudioNextActions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import OptionCardGroup from "@/components/presentations/OptionCardGroup";
import ColorPackagePicker from "@/components/presentations/ColorPackagePicker";
import PresentationResult from "@/components/presentations/PresentationResult";
import { usePresentationGeneration } from "@/components/presentations/usePresentationGeneration";
import { fieldMessage } from "@/components/presentations/presentationMessages";
import {
  DEFAULT_PRESENTATION_SETTINGS, LIMITS, PRESENTATION_AUDIENCES, PRESENTATION_LANGUAGES,
  PRESENTATION_PURPOSES, SLIDE_COUNT_OPTIONS, TOPIC_EXAMPLES,
} from "@/config/presentationOptions";
import { DEFAULT_COLOR_PACKAGE_ID } from "@/config/presentationColorPackages";
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

const inputClass = "w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

function Field({ id, label, required = false, group = false, hint, error, children }) {
  const Label = group ? "span" : "label";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label {...(group ? {} : { htmlFor: id })} id={`${id}-label`} className="text-sm font-black text-foreground">
          {label}{required && <span className="ms-1 text-destructive" aria-hidden="true">*</span>}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}

export default function PresentationsStudio() {
  const { t, loc, direction } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const [brand, setBrand] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [settings, setSettings] = React.useState({ ...DEFAULT_PRESENTATION_SETTINGS, colorPackageId: DEFAULT_COLOR_PACKAGE_ID });
  const [errors, setErrors] = React.useState({});
  const [extrasOpen, setExtrasOpen] = React.useState(false);
  const [pptxEditorOpen, setPptxEditorOpen] = React.useState(false);
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
      const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
      if (inheritedPrompt) setSettings((prev) => (prev.topic ? prev : { ...prev, topic: inheritedPrompt }));
      const identity = await getBrandIdentity(projectId);
      if (active) setBrand(identity);
    }).catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  // Server-side validation errors (e.g. an unsupported "other" language) are shown next to their fields.
  React.useEffect(() => {
    if (genError?.fields) setErrors(genError.fields);
  }, [genError]);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const focusFirstError = (found) => {
    const order = ["topic", "purpose", "audience", "customAudience", "slideCount", "language", "otherLanguage", "additionalInstructions"];
    const first = order.find((key) => found[key]);
    if (first === "additionalInstructions") setExtrasOpen(true);
    requestAnimationFrame(() => {
      const target = formRef.current?.querySelector(`[data-field="${first}"]`);
      target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      target?.focus?.();
    });
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (busy) return; // no duplicate requests while one is running
    if (isAnonymous) { requireAccount(window.location.pathname + window.location.search); return; }
    const found = validatePresentationSettings(settings);
    setErrors(found);
    if (Object.keys(found).length) { focusFirstError(found); return; }
    await generation.start({ settings: buildSettingsPayload(settings), projectId });
  };

  const err = (key) => (errors[key] ? fieldMessage(errors[key], loc) : "");
  const describedBy = (key) => (errors[key] ? `${key}-error` : undefined);
  const borderFor = (key) => (errors[key] ? "border-destructive" : "border-input");

  return (
    <div className="min-h-full px-4 py-6 md:px-8" dir={direction}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            {direction === "rtl" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {loc({ ar: "رجوع", en: "Back" })}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPptxEditorOpen(true)} data-testid="open-pptx-editor" className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card px-3 py-2 text-xs font-extrabold text-primary shadow-sm hover:bg-primary/5">
              <PencilRuler className="h-4 w-4" />
              <span>{t("pptxEditor.title")}</span>
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-primary shadow-sm">
              <Presentation className="h-4 w-4" />
              {loc({ ar: "ستوديو العروض التقديمية", en: "Presentation Studio" })}
            </div>
          </div>
        </header>

        {brand && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            {brand.logo?.url && <img src={brand.logo.url} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-2" />}
            <div><strong className="block text-sm text-foreground">{brand.brand_name}</strong><span className="text-xs text-muted-foreground">{loc({ ar: "الهوية المعتمدة متصلة", en: "Approved brand identity connected" })}</span></div>
            {profile?.companyName && <span className="ms-auto text-xs font-bold text-muted-foreground">{profile.companyName}</span>}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy} className="space-y-7 rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
            <div>
              <Wand2 className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="text-2xl font-black text-foreground">{loc({ ar: "أنشئ عرضك بالذكاء الاصطناعي", en: "Build a presentation with AI" })}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{loc({ ar: "أجب عن بضعة أسئلة بسيطة وسنُنشئ عرضًا تقديميًا كاملًا لك.", en: "Answer a few quick questions and we will create a complete presentation for you." })}</p>
            </div>

            <fieldset disabled={busy} className="min-w-0 space-y-7 border-0 p-0">
              <Field id="topic" label={loc({ ar: "موضوع العرض التقديمي", en: "Presentation topic" })} required error={err("topic")}
                hint={`${settings.topic.length}/${LIMITS.topicMax}`}>
                <textarea id="topic" data-field="topic" rows={5} maxLength={LIMITS.topicMax} value={settings.topic}
                  onChange={(e) => update("topic", e.target.value)} aria-required="true" aria-invalid={Boolean(errors.topic)} aria-describedby={describedBy("topic")}
                  placeholder={loc({ ar: "اكتب الموضوع أو الفكرة التي تريد تحويلها إلى عرض تقديمي...", en: "Write the topic or idea you want to turn into a presentation..." })}
                  className={`${inputClass} ${borderFor("topic")} resize-y leading-7`} />
                <div className="flex flex-wrap gap-2" aria-label={loc({ ar: "أمثلة لموضوعات", en: "Topic examples" })}>
                  {TOPIC_EXAMPLES.map((example) => (
                    <button key={example.en} type="button" onClick={() => update("topic", loc(example))}
                      className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {loc(example)}
                    </button>
                  ))}
                </div>
              </Field>

              <Field id="purpose" group label={loc({ ar: "الغرض من العرض التقديمي", en: "Presentation purpose" })} required error={err("purpose")}>
                <div data-field="purpose" tabIndex={-1} className="outline-none">
                  <OptionCardGroup name="purpose" label={loc({ ar: "الغرض من العرض التقديمي", en: "Presentation purpose" })} options={PRESENTATION_PURPOSES}
                    value={settings.purpose} onChange={(v) => update("purpose", v)} loc={loc} invalid={Boolean(errors.purpose)} describedBy={describedBy("purpose")} />
                </div>
                {settings.purpose === "auto" && <p className="text-xs text-muted-foreground">{loc({ ar: "سنستنتج الغرض من كلمات موضوعك؛ وإن لم نجد دلالة واضحة تُترك Gamma لتقدّر الأنسب.", en: "We infer the purpose from your topic's wording; if nothing is clear, Gamma decides." })}</p>}
              </Field>

              <Field id="audience" group label={loc({ ar: "الجمهور المستهدف", en: "Target audience" })} required error={err("audience")}>
                <div data-field="audience" tabIndex={-1} className="outline-none">
                  <OptionCardGroup name="audience" label={loc({ ar: "الجمهور المستهدف", en: "Target audience" })} options={PRESENTATION_AUDIENCES}
                    value={settings.audience} onChange={(v) => update("audience", v)} loc={loc} invalid={Boolean(errors.audience)} describedBy={describedBy("audience")} />
                </div>
                {settings.audience === "auto" && <p className="text-xs text-muted-foreground">{loc({ ar: "يُحدَّد الجمهور حسب الغرض من العرض.", en: "The audience is derived from the presentation purpose." })}</p>}
                {settings.audience === "custom" && (
                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="customAudience" className="text-xs font-bold text-foreground">{loc({ ar: "صف الجمهور المستهدف", en: "Describe the audience" })}<span className="ms-1 text-destructive" aria-hidden="true">*</span></label>
                    <input id="customAudience" data-field="customAudience" type="text" maxLength={LIMITS.customAudienceMax} value={settings.customAudience}
                      onChange={(e) => update("customAudience", e.target.value)} aria-required="true" aria-invalid={Boolean(errors.customAudience)} aria-describedby={describedBy("customAudience")}
                      placeholder={loc({ ar: "مثال: أصحاب المتاجر الصغيرة في الإسكندرية", en: "e.g. small shop owners in Alexandria" })}
                      className={`${inputClass} ${borderFor("customAudience")}`} />
                    {err("customAudience") && <p id="customAudience-error" role="alert" className="text-xs font-bold text-destructive">{err("customAudience")}</p>}
                  </div>
                )}
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="slideCount" label={loc({ ar: "عدد الشرائح", en: "Number of slides" })} required error={err("slideCount")}>
                  <div className="relative">
                    <select id="slideCount" data-field="slideCount" value={settings.slideCount} onChange={(e) => update("slideCount", e.target.value)}
                      className={`${inputClass} ${borderFor("slideCount")} appearance-none pe-9`}>
                      {SLIDE_COUNT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{loc(o)}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Field>

                <Field id="language" label={loc({ ar: "لغة العرض التقديمي", en: "Presentation language" })} required error={err("language")}>
                  <div className="relative">
                    <select id="language" data-field="language" value={settings.language} onChange={(e) => update("language", e.target.value)}
                      aria-required="true" aria-invalid={Boolean(errors.language)} aria-describedby={describedBy("language")}
                      className={`${inputClass} ${borderFor("language")} appearance-none pe-9`}>
                      <option value="" disabled>{loc({ ar: "اختر لغة العرض", en: "Choose a language" })}</option>
                      {PRESENTATION_LANGUAGES.map((o) => <option key={o.value} value={o.value}>{loc(o)}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-muted-foreground">{loc({ ar: "لغة المحتوى مستقلة عن لغة واجهة التطبيق.", en: "The content language is independent of the app interface language." })}</p>
                </Field>
              </div>

              {settings.language === "other" && (
                <Field id="otherLanguage" label={loc({ ar: "اسم اللغة المطلوبة", en: "Language name" })} required error={err("otherLanguage")}>
                  <input id="otherLanguage" data-field="otherLanguage" type="text" maxLength={LIMITS.otherLanguageMax} value={settings.otherLanguage}
                    onChange={(e) => update("otherLanguage", e.target.value)} aria-required="true" aria-invalid={Boolean(errors.otherLanguage)} aria-describedby={describedBy("otherLanguage")}
                    placeholder={loc({ ar: "مثال: الإيطالية أو التركية أو اليابانية", en: "e.g. Italian, Turkish, Japanese" })}
                    className={`${inputClass} ${borderFor("otherLanguage")}`} />
                </Field>
              )}

              <section aria-labelledby="color-package-title" className="space-y-3">
                <div>
                  <h2 id="color-package-title" className="text-sm font-black text-foreground">{loc({ ar: "باكدج الألوان", en: "Color package" })}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{loc({ ar: "اختر مجموعة ألوان متناسقة لتصميم العرض.", en: "Choose a harmonious set of colors for the design." })}</p>
                </div>
                <ColorPackagePicker value={settings.colorPackageId} onChange={(id) => update("colorPackageId", id)} label={loc({ ar: "باكدج الألوان", en: "Color package" })} />
              </section>

              <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen} className="rounded-2xl border border-border">
                <CollapsibleTrigger type="button" data-testid="toggle-extra-instructions"
                  className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-start text-sm font-black text-foreground hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span>{loc({ ar: "تعليمات إضافية (اختياري)", en: "Additional instructions (optional)" })}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${extrasOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 px-4 pb-4">
                  <textarea id="additionalInstructions" data-field="additionalInstructions" rows={4} maxLength={LIMITS.additionalInstructionsMax} value={settings.additionalInstructions}
                    onChange={(e) => update("additionalInstructions", e.target.value)} aria-label={loc({ ar: "تعليمات إضافية", en: "Additional instructions" })} aria-describedby={describedBy("additionalInstructions")}
                    placeholder={loc({ ar: "أضف أي متطلبات أو أمثلة أو نقاط محددة تريد التركيز عليها في العرض التقديمي...", en: "Add any requirements, examples, or specific points you want the presentation to focus on..." })}
                    className={`${inputClass} ${borderFor("additionalInstructions")} resize-y leading-7`} />
                  {err("additionalInstructions") && <p id="additionalInstructions-error" role="alert" className="text-xs font-bold text-destructive">{err("additionalInstructions")}</p>}
                </CollapsibleContent>
              </Collapsible>
            </fieldset>

            <div className="space-y-2">
              <button type="submit" disabled={busy} data-testid="generate-presentation"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-black text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {busy ? loc({ ar: "جاري إنشاء العرض...", en: "Creating presentation..." }) : loc({ ar: "إنشاء العرض التقديمي (Generate Presentation)", en: "Generate Presentation" })}
              </button>
              {Object.values(errors).some(Boolean) && <p role="alert" className="text-center text-xs font-bold text-destructive">{loc({ ar: "راجع الحقول المحددة أعلاه.", en: "Please review the highlighted fields above." })}</p>}
            </div>
          </form>

          <aside aria-label={loc({ ar: "نتيجة التوليد", en: "Generation result" })} className="h-fit rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6 lg:sticky lg:top-6">
            <PresentationResult phase={phase} job={job} error={genError} timedOut={timedOut} loc={loc}
              onRetry={submit} onRecheck={generation.recheck} />
          </aside>
        </div>

        {projectId && phase === "completed" && <StudioNextActions projectId={projectId} fromStudio="presentations" asset={null} title={loc({ ar: "تم إنشاء العرض. اختر الخطوة التالية", en: "Presentation is ready. Choose the next step" })} description={loc({ ar: "بيانات الشركة والهوية تظل مرتبطة بالمشروع.", en: "Company data and brand identity remain attached to the project." })} />}
      </div>
      {pptxEditorOpen && (
        <PptxEditorLoadBoundary
          key={pptxEditorAttempt}
          loc={loc}
          onClose={() => setPptxEditorOpen(false)}
          onRetry={retryPptxEditor}
        >
          <React.Suspense fallback={
            <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/35 p-4" role="status" aria-live="polite">
              <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold text-slate-700 shadow-xl">{loc({ ar: "جاري تحميل محرر العروض…", en: "Loading the presentation editor…" })}</div>
            </div>
          }>
            <PptxEditorComponent onClose={() => setPptxEditorOpen(false)} />
          </React.Suspense>
        </PptxEditorLoadBoundary>
      )}
    </div>
  );
}

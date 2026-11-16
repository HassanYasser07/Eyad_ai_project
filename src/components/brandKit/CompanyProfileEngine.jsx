/**
 * EYAD AI — Company Profile (a section of the Visual Identity Studio)
 *
 * The user picks how many slides they want, fills in the company details (only name + description are
 * required, everything else is optional and makes the result more accurate) and generates a PPTX company
 * profile. Generation, polling, saving and editing all reuse the Presentation Studio pipeline:
 *   usePresentationGeneration -> eyad-presentation edge function -> saved .pptx version -> PptxEditorDialog.
 * The approved brand identity (name, palette, fonts) is injected into the brief automatically.
 */
import React from "react";
import {
  Building2, Check, ChevronDown, FileText, ListOrdered, Loader2, Minus, Paperclip, Plus, Presentation, Save, Sparkles, X,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { projectService } from "@/services/projectService";
import { extractFileText } from "@/services/fileTextService";
import { fetchPresentationFile } from "@/services/presentationService";
import { usePresentationGeneration } from "@/components/presentations/usePresentationGeneration";
import PresentationResult from "@/components/presentations/PresentationResult";
import PresentationEditorHost from "@/components/presentations/PresentationEditorHost";
import { errorMessage as presentationErrorMessage, fileErrorMessage } from "@/components/presentations/presentationMessages";
import {
  EMPTY_PROFILE, PROFILE_AUDIENCES, PROFILE_DETAILS, PROFILE_GROUPS, PROFILE_LANGUAGES, PROFILE_SLIDE_MAX, PROFILE_SLIDE_MIN,
  PROFILE_SLIDE_PRESETS, PROFILE_TONES, clampSlideCount, groupFill, profileCompleteness,
} from "@/config/companyProfileOptions";
import { buildProfileSettings, buildSlidePlan } from "./companyProfilePrompt";

const DRAFT_PREFIX = "eyad_company_profile_draft:";
const EDITOR_ORIGIN_KEY = "eyad_cp_editor_origin";
const RESUME_KEY = "eyad_pptx_resume"; // set by the editor when it sends the user to /login

const readDraft = (projectId) => {
  try { return JSON.parse(localStorage.getItem(DRAFT_PREFIX + (projectId || "new")) || "null"); } catch { return null; }
};
const writeDraft = (projectId, value) => {
  try { localStorage.setItem(DRAFT_PREFIX + (projectId || "new"), JSON.stringify(value)); } catch { /* storage unavailable */ }
};

/** Saved project data may come from the old standalone profile page: map its keys onto the new schema. */
function normalizeSaved(saved = {}) {
  const next = { ...saved };
  if (!next.description && next.about) next.description = next.about;
  if (typeof next.slideCount !== "undefined") next.slideCount = clampSlideCount(next.slideCount);
  return next;
}

function Segmented({ options, value, onChange, loc, label }) {
  return (
    <div className="cp-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value}
          className={value === option.value ? "is-active" : ""} onClick={() => onChange(option.value)}>
          {loc(option)}
        </button>
      ))}
    </div>
  );
}

function SelectField({ label, value, options, onChange, loc }) {
  return (
    <label className="cp-select">
      <span>{label}</span>
      <div>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{loc(option)}</option>)}
        </select>
        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
      </div>
    </label>
  );
}

function Toggle({ checked, onChange, title, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`cp-toggle ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="cp-toggle-track"><i /></span>
      <span className="cp-toggle-copy"><strong>{title}</strong>{hint && <small>{hint}</small>}</span>
    </button>
  );
}

function ProfileField({ field, value, onChange, error, ar }) {
  const id = `cp-${field.key}`;
  const label = ar ? field.ar : field.en;
  const example = ar ? field.exAr : field.exEn;
  const common = {
    id, value, "aria-invalid": Boolean(error), placeholder: example || "",
    onChange: (event) => onChange(field.key, event.target.value),
    dir: field.dir || "auto",
  };
  const wide = field.type === "textarea";
  return (
    <div className={`cp-field ${wide ? "is-wide" : ""} ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>
        <span>{label}</span>
        {field.required ? <em className="cp-required">{ar ? "مطلوب" : "Required"}</em> : <em className="cp-optional">{ar ? "اختياري" : "Optional"}</em>}
      </label>
      {wide ? <textarea {...common} rows={field.rows || 3} /> : <input {...common} type={field.type === "textarea" ? "text" : field.type} />}
      {error && <p role="alert" className="cp-error">{error}</p>}
    </div>
  );
}

export default function CompanyProfileEngine({ brand, palette, arabicFont, englishFont, projectId, ar }) {
  const { loc } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const tx = (arabic, english) => (ar ? arabic : english);

  const [form, setForm] = React.useState(() => ({ ...EMPTY_PROFILE, ...normalizeSaved(readDraft(projectId) || {}) }));
  const [errors, setErrors] = React.useState({});
  const [openGroups, setOpenGroups] = React.useState({ basics: true });
  const [planOpen, setPlanOpen] = React.useState(false);
  const [file, setFile] = React.useState(null);
  const [fileBusy, setFileBusy] = React.useState(false);
  const [fileError, setFileError] = React.useState("");
  const [saveState, setSaveState] = React.useState("idle"); // idle | saving | saved | error
  const [adjustedTo, setAdjustedTo] = React.useState(null);
  const [editorFile, setEditorFile] = React.useState(null);
  const [editorOpen, setEditorOpen] = React.useState(() => {
    try { return Boolean(sessionStorage.getItem(RESUME_KEY)) && sessionStorage.getItem(EDITOR_ORIGIN_KEY) === window.location.pathname; } catch { return false; }
  });
  const [openingEditor, setOpeningEditor] = React.useState(false);
  const [openError, setOpenError] = React.useState("");
  const fileInputRef = React.useRef(null);
  const sectionRef = React.useRef(null);
  const loadedFor = React.useRef(null);
  const retried = React.useRef(false);

  const update = (key, value) => {
    setSaveState("idle");
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  /* ---------- load saved profile (project) once, then keep a local draft ---------- */
  React.useEffect(() => {
    if (!projectId || loadedFor.current === projectId) return undefined;
    loadedFor.current = projectId;
    let active = true;
    projectService.get(projectId).then((project) => {
      if (!active) return;
      const saved = normalizeSaved(project?.project_data?.company_profile || {});
      setForm((current) => ({ ...EMPTY_PROFILE, ...normalizeSaved(readDraft(projectId) || {}), ...saved, ...(current.companyName && !saved.companyName ? { companyName: current.companyName } : null) }));
    }).catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  // The approved brand name is the source of truth for the company name when nothing was typed yet.
  React.useEffect(() => {
    if (brand?.brand_name) setForm((current) => (current.companyName ? current : { ...current, companyName: brand.brand_name }));
  }, [brand?.brand_name]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => writeDraft(projectId, form), 400);
    return () => window.clearTimeout(timer);
  }, [form, projectId]);

  /* ---------- generation (same pipeline as the Presentation Studio) ---------- */
  const saveProfile = React.useCallback(async (extra = {}) => {
    if (!projectId) return false;
    const project = await projectService.get(projectId);
    const pd = project?.project_data || {};
    await projectService.update(projectId, {
      project_data: {
        ...pd,
        company_profile: { ...(pd.company_profile || {}), ...form, updated_at: new Date().toISOString() },
        ...extra,
        last_studio_id: "brand-kit",
      },
    });
    return true;
  }, [projectId, form]);

  const onCompleted = React.useCallback(async (job) => {
    if (!projectId || !job?.gamma_url) return;
    try {
      const project = await projectService.get(projectId);
      const pd = project?.project_data || {};
      await projectService.update(projectId, {
        project_data: {
          ...pd,
          company_profile_presentation: {
            job_id: job.id, gamma_url: job.gamma_url, project_id: job.project_id || null, version_id: job.version_id || null,
            slide_count: clampSlideCount(form.slideCount), updated_at: new Date().toISOString(),
          },
          last_studio_id: "brand-kit",
        },
      });
    } catch (err) {
      console.warn("Could not save the company profile link to the project", err?.message);
    }
  }, [projectId, form.slideCount]);

  const generation = usePresentationGeneration({ onCompleted });
  const { phase, job, error: genError, timedOut, busy } = generation;

  const brandContext = React.useMemo(() => ({ brand, palette, arabicFont, englishFont }), [brand, palette, arabicFont, englishFont]);

  const validate = () => {
    const found = {};
    if (!form.companyName.trim()) found.companyName = tx("اكتب اسم الشركة.", "Enter the company name.");
    if (!form.description.trim() && !file?.text) found.description = tx("اكتب نبذة عن الشركة أو أرفق ملفًا.", "Write a company description or attach a file.");
    return found;
  };

  const run = async ({ presetCount = false } = {}) => {
    if (busy) return;
    if (isAnonymous) { requireAccount(window.location.pathname + window.location.search); return; }
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setOpenGroups((current) => ({ ...current, basics: true }));
      requestAnimationFrame(() => sectionRef.current?.querySelector(found.companyName ? "#cp-companyName" : "#cp-description")?.focus?.());
      return;
    }
    if (!presetCount) { retried.current = false; setAdjustedTo(null); }
    try { await saveProfile(); } catch { /* the draft is also kept locally */ }
    await generation.start({
      settings: buildProfileSettings(form, brandContext, { file, presetCount }),
      projectId,
      templateId: null,
    });
  };

  // If the backend only accepts preset page counts, retry once with the nearest preset; the brief still asks for the exact plan.
  React.useEffect(() => {
    if (genError?.fields?.slideCount && !retried.current) {
      retried.current = true;
      setAdjustedTo(buildProfileSettings(form, brandContext, { presetCount: true }).slideCount);
      run({ presetCount: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genError]);

  const saveDetails = async () => {
    if (isAnonymous || !projectId) { requireAccount(window.location.pathname + window.location.search); return; }
    setSaveState("saving");
    try { await saveProfile(); setSaveState("saved"); } catch { setSaveState("error"); }
  };

  /* ---------- editor ---------- */
  const openInEditor = async () => {
    if (!job?.project_id || openingEditor) return;
    setOpeningEditor(true);
    setOpenError("");
    try {
      const opened = await fetchPresentationFile(job.project_id, job.version_id || null);
      setEditorFile({ bytes: opened.bytes, name: opened.name, projectId: job.project_id, versionId: opened.version?.id || job.version_id || null, versionNo: opened.version?.version_no ?? job.version_no ?? null });
      try { sessionStorage.setItem(EDITOR_ORIGIN_KEY, window.location.pathname); } catch { /* ignore */ }
      setEditorOpen(true);
    } catch (err) {
      setOpenError(presentationErrorMessage(err.code, loc, err.detail));
    } finally {
      setOpeningEditor(false);
    }
  };
  const closeEditor = () => { setEditorOpen(false); setEditorFile(null); };

  /* ---------- optional company document ---------- */
  const attach = async (picked) => {
    if (!picked || busy) return;
    setFileError("");
    setFileBusy(true);
    try { setFile(await extractFileText(picked)); setErrors((current) => ({ ...current, description: undefined })); }
    catch (err) { setFileError(fileErrorMessage(err?.code, loc)); }
    finally { setFileBusy(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const count = clampSlideCount(form.slideCount);
  const plan = React.useMemo(() => buildSlidePlan(form, count), [form, count]);
  const completeness = profileCompleteness(form);
  const percent = Math.round(completeness.ratio * 100);
  const swatches = form.useBrand && Array.isArray(palette?.swatches) ? palette.swatches.slice(0, 5) : [];
  const toggleGroup = (id) => setOpenGroups((current) => ({ ...current, [id]: !current[id] }));
  const thin = count > 14 && completeness.filled < 6;

  return (
    <section className="vi-section cp-section" id="company-profile" ref={sectionRef} aria-labelledby="cp-title">
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon"><Building2 className="w-4 h-4" /></span>
          <h2 id="cp-title">{tx("بروفايل الشركة (PPTX)", "Company Profile (PPTX)")}</h2>
        </div>
        <span className="vi-section-hint">{tx("عرض جاهز للتعديل والتنزيل", "Editable, downloadable deck")}</span>
      </div>

      <p className="cp-lead">
        {tx(
          "حدّد عدد الشرائح وأدخل بيانات شركتك، وسنُنشئ بروفايل شركة احترافي بصيغة PowerPoint بألوان وخطوط هويتك، يمكنك تعديله وتنزيله من المحرر مباشرة.",
          "Choose the number of slides and enter your company details. We build a professional company profile as a PowerPoint deck in your brand colors and fonts that you can edit and download in the editor.",
        )}
      </p>

      {/* 1 · deck setup */}
      <div className="cp-card">
        <div className="cp-card-head"><span className="cp-step">1</span><strong>{tx("إعداد العرض", "Deck setup")}</strong></div>

        <div className="cp-count">
          <div className="cp-count-top">
            <span className="cp-label">{tx("عدد الشرائح", "Number of slides")}</span>
            <div className="cp-stepper">
              <button type="button" aria-label={tx("إنقاص", "Decrease")} onClick={() => update("slideCount", clampSlideCount(count - 1))} disabled={count <= PROFILE_SLIDE_MIN}><Minus className="w-4 h-4" /></button>
              <input type="number" inputMode="numeric" min={PROFILE_SLIDE_MIN} max={PROFILE_SLIDE_MAX} value={form.slideCount}
                aria-label={tx("عدد الشرائح", "Number of slides")}
                onChange={(event) => update("slideCount", event.target.value === "" ? "" : Math.min(PROFILE_SLIDE_MAX, Math.max(0, Math.round(Number(event.target.value)))))}
                onBlur={() => update("slideCount", clampSlideCount(form.slideCount))} />
              <button type="button" aria-label={tx("زيادة", "Increase")} onClick={() => update("slideCount", clampSlideCount(count + 1))} disabled={count >= PROFILE_SLIDE_MAX}><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <input className="cp-range" type="range" min={PROFILE_SLIDE_MIN} max={PROFILE_SLIDE_MAX} value={count}
            aria-label={tx("عدد الشرائح", "Number of slides")} onChange={(event) => update("slideCount", Number(event.target.value))}
            style={{ "--cp-fill": `${((count - PROFILE_SLIDE_MIN) / (PROFILE_SLIDE_MAX - PROFILE_SLIDE_MIN)) * 100}%` }} />
          <div className="cp-presets">
            {PROFILE_SLIDE_PRESETS.map((preset) => (
              <button key={preset} type="button" className={count === preset ? "is-active" : ""} onClick={() => update("slideCount", preset)}>{preset}</button>
            ))}
            <small>{tx(`من ${PROFILE_SLIDE_MIN} إلى ${PROFILE_SLIDE_MAX} شريحة`, `${PROFILE_SLIDE_MIN}–${PROFILE_SLIDE_MAX} slides`)}</small>
          </div>
        </div>

        <div className="cp-grid">
          <div className="cp-select">
            <span>{tx("لغة العرض", "Deck language")}</span>
            <Segmented options={PROFILE_LANGUAGES} value={form.language} onChange={(v) => update("language", v)} loc={loc} label={tx("لغة العرض", "Deck language")} />
          </div>
          <SelectField label={tx("أسلوب العرض", "Style & tone")} value={form.tone} options={PROFILE_TONES} onChange={(v) => update("tone", v)} loc={loc} />
          <SelectField label={tx("الجمهور المستهدف", "Target audience")} value={form.audience} options={PROFILE_AUDIENCES} onChange={(v) => update("audience", v)} loc={loc} />
          <SelectField label={tx("مستوى التفصيل", "Level of detail")} value={form.detail} options={PROFILE_DETAILS} onChange={(v) => update("detail", v)} loc={loc} />
        </div>

        <div className="cp-toggles">
          <Toggle checked={form.useBrand} onChange={(v) => update("useBrand", v)}
            title={tx("استخدام الهوية البصرية", "Use my visual identity")}
            hint={swatches.length ? null : tx("ألوان وخطوط الهوية المعتمدة", "Approved brand colors & fonts")} />
          {swatches.length > 0 && (
            <div className="cp-swatches" aria-hidden="true">{swatches.map((color) => <i key={color} style={{ background: color }} />)}</div>
          )}
          <Toggle checked={form.includeContactSlide} onChange={(v) => update("includeContactSlide", v)}
            title={tx("شريحة تواصل ختامية", "Closing contact slide")} />
        </div>
      </div>

      {/* 2 · company details */}
      <div className="cp-card">
        <div className="cp-card-head">
          <span className="cp-step">2</span>
          <strong>{tx("بيانات الشركة", "Company details")}</strong>
          <span className="cp-meter-label">{tx(`اكتمال البيانات الاختيارية ${percent}%`, `Optional details ${percent}%`)}</span>
        </div>
        <div className="cp-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${Math.max(percent, 3)}%` }} /></div>
        <p className="cp-tip"><Sparkles className="w-3.5 h-3.5" />{tx("كلما أضفت تفاصيل أكثر كانت النتيجة أدق وأقل عمومية. الحقول الاختيارية يمكن تركها فارغة.", "The more you add, the more accurate and specific the result. Optional fields can be left empty.")}</p>

        <div className="cp-groups">
          {PROFILE_GROUPS.map((group) => {
            const open = Boolean(openGroups[group.id]);
            const fill = groupFill(form, group);
            return (
              <div key={group.id} className={`cp-group ${open ? "is-open" : ""}`}>
                <button type="button" className="cp-group-head" aria-expanded={open} aria-controls={`cp-group-${group.id}`} onClick={() => toggleGroup(group.id)}>
                  <span className="cp-group-title"><strong>{ar ? group.ar : group.en}</strong><small>{ar ? group.hintAr : group.hintEn}</small></span>
                  <span className={`cp-badge ${fill.filled ? "has-data" : ""}`}>{fill.filled}/{fill.total}</span>
                  <ChevronDown className="w-4 h-4 cp-chevron" aria-hidden="true" />
                </button>
                {open && (
                  <div className="cp-group-body" id={`cp-group-${group.id}`}>
                    {group.fields.map((field) => (
                      <ProfileField key={field.key} field={field} value={form[field.key] ?? ""} onChange={update} error={errors[field.key]} ar={ar} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="cp-attach">
          <input ref={fileInputRef} type="file" className="sr-only" tabIndex={-1} accept=".txt,.md,.markdown,.csv,.json,.docx,.pptx" onChange={(event) => attach(event.target.files?.[0])} />
          {file ? (
            <span className="cp-file-chip">
              <FileText className="w-3.5 h-3.5" />
              <span dir="auto">{file.name}</span>
              <button type="button" aria-label={tx("إزالة الملف", "Remove file")} onClick={() => { setFile(null); setFileError(""); }}><X className="w-3 h-3" /></button>
            </span>
          ) : (
            <button type="button" className="cp-attach-btn" disabled={busy || fileBusy} onClick={() => fileInputRef.current?.click()}>
              {fileBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              {tx("أرفق ملف الشركة الحالي (اختياري)", "Attach an existing company document (optional)")}
            </button>
          )}
          <small>{tx("TXT · MD · DOCX · PPTX · CSV · JSON — يُقرأ النص داخل المتصفح فقط.", "TXT · MD · DOCX · PPTX · CSV · JSON — text is read in your browser only.")}</small>
          {fileError && <p role="alert" className="cp-error">{fileError}</p>}
        </div>
      </div>

      {/* 3 · plan preview + generate */}
      <div className="cp-card">
        <div className="cp-card-head">
          <span className="cp-step">3</span>
          <strong>{tx("خطة الشرائح", "Slide plan")}</strong>
          <button type="button" className="cp-link" onClick={() => setPlanOpen((v) => !v)} aria-expanded={planOpen}>
            <ListOrdered className="w-3.5 h-3.5" />{planOpen ? tx("إخفاء", "Hide") : tx(`عرض ${plan.length} شريحة`, `Preview ${plan.length} slides`)}
          </button>
        </div>
        {planOpen && (
          <ol className="cp-plan">
            {plan.map((item, index) => <li key={item.id}><b>{index + 1}</b><span>{ar ? item.titleAr || item.title : item.title}</span></li>)}
          </ol>
        )}
        {thin && <p className="cp-tip is-warn">{tx("عدد الشرائح كبير مقارنة بالبيانات المُدخلة؛ أضف مشاريع وخدمات وأرقامًا لشرائح أكثر تنوعًا.", "That is a lot of slides for the details given. Add services, projects and numbers for more varied slides.")}</p>}

        <div className="cp-actions">
          <button type="button" className="cp-secondary-btn" onClick={saveDetails} disabled={saveState === "saving"}>
            {saveState === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : saveState === "saved" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveState === "saved" ? tx("تم حفظ البيانات", "Details saved") : tx("حفظ البيانات", "Save details")}
          </button>
          <button type="button" className="vi-apply-btn cp-generate" onClick={() => run()} disabled={busy} data-testid="generate-company-profile">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Presentation className="w-5 h-5" />}
            {busy ? tx("جاري إنشاء البروفايل…", "Creating your profile…") : tx(`إنشاء بروفايل الشركة (${count} شريحة)`, `Generate company profile (${count} slides)`)}
          </button>
        </div>
        {saveState === "error" && <p role="alert" className="cp-error">{tx("تعذر حفظ البيانات. حاول مرة أخرى.", "Could not save the details. Please try again.")}</p>}
      </div>

      {phase !== "idle" && (
        <aside className="cp-result" aria-label={tx("نتيجة التوليد", "Generation result")}>
          <PresentationResult phase={phase} job={job} error={genError} timedOut={timedOut} loc={loc}
            onRetry={() => run()} onRecheck={generation.recheck}
            onOpenEditor={openInEditor} openingEditor={openingEditor} openError={openError} />
          {adjustedTo && phase !== "failed" && (
            <p className="cp-tip is-warn">{tx(`تم تقريب عدد الصفحات المرسل إلى ${adjustedTo}، مع بقاء خطة الـ${count} شريحة في الطلب. يمكنك حذف أو تكرار الشرائح من المحرر.`, `The page count sent was rounded to ${adjustedTo}; the ${count}-slide plan is still in the brief. You can add or delete slides in the editor.`)}</p>
          )}
        </aside>
      )}

      {editorOpen && <PresentationEditorHost file={editorFile} onClose={closeEditor} loc={loc} />}
    </section>
  );
}

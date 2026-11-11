import React from "react";
import moment from "moment";
import { AlertTriangle, ChevronDown, History, Loader2, PencilRuler, Presentation, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  fetchPresentationFile, getPresentationStatus, listPresentationVersions, waitForPresentation,
} from "@/services/presentationService";
import { errorMessage } from "./presentationMessages";
import FirstSlideThumbnail from "./FirstSlideThumbnail";
import PresentationEditorHost from "./PresentationEditorHost";

const titleOf = (version, fallback) => String(version?.file_name || fallback || "").replace(/\.pptx$/i, "") || fallback;
const byLastSaved = (a, b) => new Date(b.updated_at) - new Date(a.updated_at);

/**
 * Presentation card shown inside a project's Eyad chat.
 * Clicking it opens the editor on the LAST SAVED .pptx version; the "Versions" list opens any older one.
 * `presentation` is the pointer kept on the project (metadata.project_data.presentation).
 */
export default function PresentationProjectCard({ projectId, presentation, onChanged }) {
  const { loc, language, direction } = useI18n();
  const [versions, setVersions] = React.useState(null); // null = loading
  const [phase, setPhase] = React.useState(presentation?.status === "generating" ? "generating" : "ready");
  const [stalled, setStalled] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [error, setError] = React.useState("");
  const [opening, setOpening] = React.useState(null);
  const [editorFile, setEditorFile] = React.useState(null);
  const [showVersions, setShowVersions] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const onChangedRef = React.useRef(onChanged);
  onChangedRef.current = onChanged;

  const reload = React.useCallback(async () => {
    try {
      const rows = await listPresentationVersions(projectId);
      setVersions(rows);
      return rows;
    } catch (err) {
      setVersions((current) => current || []);
      setError(errorMessage(err.code, loc));
      return [];
    }
  }, [projectId, loc]);

  React.useEffect(() => { reload(); }, [reload, presentation?.updated_at]);

  // A generation that was still running when the project was opened: resume it (this also finishes the
  // server-side step that stores the .pptx, so closing the tab mid-generation never loses the deck).
  React.useEffect(() => {
    if (phase !== "generating" || !presentation?.job_id) return undefined;
    const controller = new AbortController();
    let active = true;
    setStalled(false);
    waitForPresentation(presentation.job_id, { signal: controller.signal }).then(async (job) => {
      if (!active) return;
      if (job.status === "pending") { setStalled(true); return; }
      const rows = await reload();
      if (!active) return;
      if (job.status === "failed") {
        setError(errorMessage(job.error_code || "GAMMA_GENERATION_FAILED", loc, job.error_message || ""));
        setPhase(rows.length ? "ready" : "failed");
      } else {
        setPhase("ready");
        if (!job.pptx_ready) setError(errorMessage("FILE_UNAVAILABLE", loc));
      }
      onChangedRef.current?.();
    }).catch((err) => {
      if (!active || err.code === "ABORTED") return;
      setError(errorMessage(err.code, loc, err.detail));
      setStalled(true);
    });
    return () => { active = false; controller.abort(); };
  }, [phase, presentation?.job_id, tick, reload, loc]);

  const latest = versions?.length ? [...versions].sort(byLastSaved)[0] : null;

  const openVersion = async (version) => {
    if (opening || !version) return;
    setError("");
    setOpening(version.id);
    try {
      const file = await fetchPresentationFile(projectId, version.id);
      setEditorFile({ bytes: file.bytes, name: file.name, projectId, versionId: version.id, versionNo: version.version_no });
    } catch (err) {
      setError(errorMessage(err.code, loc, err.detail));
    } finally {
      setOpening(null);
    }
  };

  // The Gamma deck was ready but its .pptx could not be copied into our bucket: ask the server to try again.
  const retryStore = async () => {
    if (retrying || !presentation?.job_id) return;
    setRetrying(true);
    setError("");
    try {
      const job = await getPresentationStatus(presentation.job_id);
      const rows = await reload();
      if (!job.pptx_ready && !rows.length) setError(errorMessage("FILE_UNAVAILABLE", loc));
      else onChangedRef.current?.();
    } catch (err) {
      setError(errorMessage(err.code, loc, err.detail));
    } finally {
      setRetrying(false);
    }
  };

  const fallbackThumb = (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-sky-50 to-indigo-50 text-primary/60">
      <Presentation className="h-7 w-7" aria-hidden="true" />
    </span>
  );

  let body;
  if (phase === "generating") {
    body = (
      <div role="status" aria-live="polite" className="flex items-center gap-3 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {stalled ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm font-black text-foreground">{loc({ ar: "جاري إنشاء العرض التقديمي…", en: "Creating your presentation…" })}</strong>
          <small className="text-xs text-muted-foreground">
            {stalled
              ? loc({ ar: "يستغرق وقتًا أطول من المعتاد. لم يفشل الطلب.", en: "It is taking longer than usual. The request has not failed." })
              : loc({ ar: "سيظهر هنا بمجرد اكتماله.", en: "It will appear here as soon as it is done." })}
          </small>
        </div>
        {stalled && (
          <button type="button" onClick={() => setTick((n) => n + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{loc({ ar: "تحقق مرة أخرى", en: "Check again" })}
          </button>
        )}
      </div>
    );
  } else if (versions === null) {
    body = (
      <div role="status" className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{loc({ ar: "جاري تحميل العرض…", en: "Loading the presentation…" })}
      </div>
    );
  } else if (!latest) {
    body = (
      <div role="alert" className="flex items-center gap-3 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm font-black text-foreground">
            {phase === "failed" ? loc({ ar: "تعذر إنشاء العرض التقديمي", en: "Could not create the presentation" }) : loc({ ar: "ملف العرض غير جاهز بعد", en: "The presentation file is not ready yet" })}
          </strong>
          <small className="text-xs text-muted-foreground">
            {phase === "failed"
              ? loc({ ar: "يمكنك إنشاء عرض جديد من ستوديو العروض.", en: "You can create a new one from the Presentation Studio." })
              : loc({ ar: "تم إنشاء العرض لكن تعذر حفظ ملفه في مشروعك.", en: "The presentation was created but its file could not be saved to your project." })}
          </small>
        </div>
        {phase !== "failed" && presentation?.job_id && (
          <button type="button" onClick={retryStore} disabled={retrying} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground disabled:opacity-60">
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            {loc({ ar: "إعادة المحاولة", en: "Retry" })}
          </button>
        )}
      </div>
    );
  } else {
    const isOpening = opening === latest.id;
    body = (
      <>
        <button type="button" onClick={() => openVersion(latest)} disabled={Boolean(opening)} data-testid="presentation-card-open"
          aria-label={loc({ ar: "فتح العرض التقديمي في المحرر", en: "Open the presentation in the editor" })}
          className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait">
          <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm sm:w-36">
            <FirstSlideThumbnail load={() => fetchPresentationFile(projectId, latest.id)} reloadKey={`${latest.id}:${latest.updated_at}`} fallback={fallbackThumb} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-black text-foreground">{titleOf(latest, loc({ ar: "عرض تقديمي", en: "Presentation" }))}</strong>
            <small className="mt-0.5 block text-xs text-muted-foreground">
              {loc({ ar: `النسخة ${latest.version_no} · آخر حفظ`, en: `Version ${latest.version_no} · last saved` })} {moment(latest.updated_at).locale(language).fromNow()}
            </small>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
              {isOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <PencilRuler className="h-3.5 w-3.5" aria-hidden="true" />}
              {loc({ ar: "فتح في المحرر", en: "Open in editor" })}
            </span>
          </span>
        </button>
        {versions.length > 1 && (
          <div className="border-t border-border/70">
            <button type="button" onClick={() => setShowVersions((v) => !v)} aria-expanded={showVersions} data-testid="presentation-card-versions"
              className="flex w-full items-center gap-2 px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              {loc({ ar: `النسخ المحفوظة (${versions.length})`, en: `Saved versions (${versions.length})` })}
              <ChevronDown className={`ms-auto h-3.5 w-3.5 transition-transform ${showVersions ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {showVersions && (
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {versions.map((version) => (
                  <li key={version.id}>
                    <button type="button" onClick={() => openVersion(version)} disabled={Boolean(opening)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-xs hover:bg-primary/5 disabled:opacity-60">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-black text-primary">v{version.version_no}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{moment(version.updated_at).locale(language).format("YYYY/MM/DD HH:mm")}</span>
                      {version.id === latest.id && <span className="text-[11px] font-bold text-emerald-600">{loc({ ar: "الأحدث", en: "Latest" })}</span>}
                      {opening === version.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <span className="font-bold text-primary">{loc({ ar: "فتح", en: "Open" })}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <section dir={direction} aria-label={loc({ ar: "العرض التقديمي", en: "Presentation" })} data-testid="presentation-card"
      className="mx-auto mb-4 w-full max-w-[720px] overflow-hidden rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur">
      {body}
      {error && <p role="alert" className="border-t border-border/70 px-4 py-2 text-xs text-destructive">{error}</p>}
      {editorFile && (
        <PresentationEditorHost
          file={editorFile}
          loc={loc}
          onClose={() => { setEditorFile(null); reload(); }}
          onSaved={() => { reload(); onChangedRef.current?.(); }}
        />
      )}
    </section>
  );
}

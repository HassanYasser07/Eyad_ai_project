import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useGenerations } from "@/lib/GenerationContext";
import { useI18n } from "@/i18n/I18nContext";
import { genText } from "@/i18n/generationTranslations";
import { isTerminalStatus } from "@/services/generationTracker";
import "./GenerationPill.css";

const pathOf = (route) => String(route || "").split("?")[0];

export default function GenerationPill() {
  const { jobs, consumeResult } = useGenerations();
  const { language } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const knownTerminal = useRef(null);

  const active = useMemo(() => jobs.filter((job) => !isTerminalStatus(job.status)), [jobs]);
  const finished = useMemo(() => jobs.filter((job) => isTerminalStatus(job.status) && job.result && !job.result.consumed), [jobs]);

  // Toast only for jobs that finish while the user is on another screen.
  useEffect(() => {
    const currentIds = new Set(finished.map((job) => job.jobId));
    if (knownTerminal.current === null) { knownTerminal.current = currentIds; return; }
    for (const job of finished) {
      if (knownTerminal.current.has(job.jobId)) continue;
      if (pathOf(job.route) === location.pathname) continue;
      setToast(job);
      break;
    }
    knownTerminal.current = currentIds;
  }, [finished, location.pathname]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(timer);
  }, [toast]);

  const visibleActive = active.filter((job) => pathOf(job.route) !== location.pathname);
  const visibleFinished = finished.filter((job) => pathOf(job.route) !== location.pathname);
  const rows = [...visibleActive, ...visibleFinished];
  const kindLabel = (job) => genText(language, `gen.kind.${job.kind}`);

  const openJob = (job) => {
    setOpen(false);
    setToast(null);
    navigate(job.route || "/chat");
  };

  return (
    <>
      {rows.length > 0 && (
        <button type="button" className="gen-pill" data-state={visibleActive.length ? "running" : "ready"} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {visibleActive.length ? <Loader2 className="gen-pill__icon gen-pill__spin" /> : <CheckCircle2 className="gen-pill__icon" />}
          <span>{visibleActive.length
            ? (visibleActive.length > 1 ? genText(language, "gen.runningCount", { count: visibleActive.length }) : genText(language, "gen.running"))
            : genText(language, "gen.ready")}</span>
        </button>
      )}
      {open && rows.length > 0 && (
        <div className="gen-sheet" role="dialog" aria-label={genText(language, "gen.sheetTitle")}>
          <div className="gen-sheet__head">
            <strong>{genText(language, "gen.sheetTitle")}</strong>
            <button type="button" className="gen-sheet__close" onClick={() => setOpen(false)} aria-label={genText(language, "gen.dismiss")}><X size={16} /></button>
          </div>
          <ul>
            {rows.map((job) => {
              const running = !isTerminalStatus(job.status);
              const failed = job.status === "failed";
              return (
                <li key={job.jobId}>
                  <button type="button" onClick={() => openJob(job)} className="gen-sheet__row">
                    {running ? <Loader2 className="gen-pill__icon gen-pill__spin" /> : failed ? <AlertCircle className="gen-pill__icon gen-pill__bad" /> : <CheckCircle2 className="gen-pill__icon gen-pill__ok" />}
                    <span className="gen-sheet__label">{kindLabel(job)}</span>
                    <span className="gen-sheet__state">{running ? genText(language, "gen.running") : failed ? genText(language, "gen.failed") : genText(language, "gen.ready")}</span>
                  </button>
                  {!running && (
                    <button type="button" className="gen-sheet__x" onClick={() => consumeResult(job.jobId)} aria-label={genText(language, "gen.dismiss")}><X size={14} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {toast && (
        <div className="gen-toast" role="status">
          <span>{toast.status === "failed"
            ? genText(language, "gen.failedToast", { kind: kindLabel(toast) })
            : genText(language, "gen.readyToast", { kind: kindLabel(toast) })}</span>
          <button type="button" onClick={() => openJob(toast)}>{genText(language, "gen.open")}</button>
          <button type="button" className="gen-toast__x" onClick={() => setToast(null)} aria-label={genText(language, "gen.dismiss")}><X size={14} /></button>
        </div>
      )}
    </>
  );
}

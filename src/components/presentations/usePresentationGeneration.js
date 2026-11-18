import React from "react";
import { PresentationError, startPresentation, waitForPresentation, getPresentationStatus } from "@/services/presentationService";
import { useAuth } from "@/lib/AuthContext";

// The server (Gamma sweeper) keeps advancing a pending job even when the app is closed. The
// client only remembers which job it was watching so it can resume after a reload / app switch.
const STORE_PREFIX = "eyad.presentation-job.v1:";
const RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000;
function readStored(key) {
  try { return JSON.parse(globalThis.localStorage?.getItem(key) || "null"); } catch { return null; }
}
function writeStored(key, value) {
  try {
    if (value) globalThis.localStorage?.setItem(key, JSON.stringify(value));
    else globalThis.localStorage?.removeItem(key);
  } catch { /* storage unavailable: the server job is still safe */ }
}

/**
 * Drives one Gamma generation: start -> poll -> completed | failed.
 * - Only reports "completed" when the backend confirms Gamma returned a presentation link.
 * - Blocks duplicate submits while a request is in flight.
 * - Keeps the same request id after a network failure so a retry cannot create a second job.
 */
export function usePresentationGeneration({ onCompleted, projectId: scopeProjectId = null } = {}) {
  const { user } = useAuth();
  const storeKey = `${STORE_PREFIX}${user?.id || "anon"}:${scopeProjectId || "none"}`;
  const [phase, setPhase] = React.useState("idle"); // idle | starting | polling | completed | failed
  const [job, setJob] = React.useState(null);
  const [error, setError] = React.useState(null); // { code, detail, fields }
  const [timedOut, setTimedOut] = React.useState(false);
  const inFlight = React.useRef(false);
  const requestIdRef = React.useRef(null);
  const abortRef = React.useRef(null);
  const onCompletedRef = React.useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const finish = React.useCallback((finalJob) => {
    setJob(finalJob);
    if (finalJob.status === "completed" || finalJob.status === "failed") writeStored(storeKey, null);
    if (finalJob.status === "completed") {
      setPhase("completed");
      try { onCompletedRef.current?.(finalJob); } catch { /* non-fatal */ }
    } else if (finalJob.status === "failed") {
      setPhase("failed");
      setError({ code: finalJob.error_code || "GAMMA_GENERATION_FAILED", detail: finalJob.error_message || "" });
    } else {
      setTimedOut(Boolean(finalJob.timedOut));
      setPhase("polling");
    }
  }, [storeKey]);

  const poll = React.useCallback(async (jobId) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("polling");
    setTimedOut(false);
    try {
      const finalJob = await waitForPresentation(jobId, { signal: controller.signal, onUpdate: setJob });
      finish(finalJob);
    } catch (err) {
      if (err.code === "ABORTED") return;
      setError({ code: err.code, detail: err.detail });
      // A polling hiccup is not a generation failure: keep the job id so the user can re-check.
      setTimedOut(true);
      setPhase("polling");
    }
  }, [finish]);

  const start = React.useCallback(async ({ settings, projectId, templateId = null }) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setTimedOut(false);
    setJob(null);
    setPhase("starting");
    if (!requestIdRef.current) requestIdRef.current = readStored(storeKey)?.requestId || crypto.randomUUID();
    writeStored(storeKey, { ...(readStored(storeKey) || {}), requestId: requestIdRef.current, createdAt: readStored(storeKey)?.createdAt || Date.now() });
    try {
      const created = await startPresentation({ settings, requestId: requestIdRef.current, projectId, templateId });
      requestIdRef.current = null;
      writeStored(storeKey, { jobId: created.id, createdAt: Date.now() });
      setJob(created);
      if (created.status === "pending") await poll(created.id);
      else finish(created);
      return true;
    } catch (err) {
      const definitive = err instanceof PresentationError && !["NETWORK_ERROR", "REQUEST_TIMEOUT"].includes(err.code);
      if (definitive) { requestIdRef.current = null; writeStored(storeKey, null); } // the server answered: a retry is a new request
      setPhase("failed");
      setError({ code: err.code || "UNKNOWN", detail: err.detail || "", fields: err.fields || null });
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [poll, finish, storeKey]);

  /** Re-check an existing job (after a timeout or a polling error). */
  const recheck = React.useCallback(async () => {
    if (!job?.id || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const latest = await getPresentationStatus(job.id);
      if (latest.status === "pending") await poll(job.id);
      else finish(latest);
    } catch (err) {
      setError({ code: err.code, detail: err.detail });
      setTimedOut(true);
    } finally {
      inFlight.current = false;
    }
  }, [job, poll, finish]);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    requestIdRef.current = null;
    writeStored(storeKey, null);
    setPhase("idle"); setJob(null); setError(null); setTimedOut(false);
  }, []);

  // Resume a job that was running when the user left / reloaded / the app was killed.
  const resumedRef = React.useRef(false);
  React.useEffect(() => {
    if (resumedRef.current || !user?.id) return;
    const stored = readStored(storeKey);
    if (!stored?.jobId || Date.now() - Number(stored.createdAt || 0) > RESUME_MAX_AGE_MS) return;
    resumedRef.current = true;
    (async () => {
      try {
        const latest = await getPresentationStatus(stored.jobId);
        setJob(latest);
        if (latest.status === "pending") await poll(latest.id);
        else finish(latest);
      } catch (err) {
        // Not a failure: the job lives on the server. Show the soft "re-check" state.
        setJob({ id: stored.jobId, status: "pending" });
        setError({ code: err?.code, detail: err?.detail });
        setTimedOut(true);
        setPhase("polling");
      }
    })();
  }, [user?.id, storeKey, poll, finish]);

  // Coming back to the app: re-check immediately instead of waiting for the next tick.
  const recheckRef = React.useRef(null);
  React.useEffect(() => { recheckRef.current = recheck; });
  React.useEffect(() => {
    const onBack = () => {
      if (document.visibilityState === "hidden") return;
      if (phase === "polling" && job?.id) recheckRef.current?.();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("online", onBack);
    window.addEventListener("pageshow", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("online", onBack);
      window.removeEventListener("pageshow", onBack);
    };
  }, [phase, job?.id]);

  const busy = phase === "starting" || (phase === "polling" && !timedOut);
  return { phase, job, error, timedOut, busy, start, recheck, reset };
}

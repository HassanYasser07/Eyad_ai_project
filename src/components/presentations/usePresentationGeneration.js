import React from "react";
import { PresentationError, startPresentation, waitForPresentation, getPresentationStatus } from "@/services/presentationService";

/**
 * Drives one Gamma generation: start -> poll -> completed | failed.
 * - Only reports "completed" when the backend confirms Gamma returned a presentation link.
 * - Blocks duplicate submits while a request is in flight.
 * - Keeps the same request id after a network failure so a retry cannot create a second job.
 */
export function usePresentationGeneration({ onCompleted } = {}) {
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
  }, []);

  const poll = React.useCallback(async (jobId) => {
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

  const start = React.useCallback(async ({ settings, projectId }) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setTimedOut(false);
    setJob(null);
    setPhase("starting");
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    try {
      const created = await startPresentation({ settings, requestId: requestIdRef.current, projectId });
      requestIdRef.current = null;
      setJob(created);
      if (created.status === "pending") await poll(created.id);
      else finish(created);
      return true;
    } catch (err) {
      const definitive = err instanceof PresentationError && !["NETWORK_ERROR", "REQUEST_TIMEOUT"].includes(err.code);
      if (definitive) requestIdRef.current = null; // the server answered: a retry is a new request
      setPhase("failed");
      setError({ code: err.code || "UNKNOWN", detail: err.detail || "", fields: err.fields || null });
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [poll, finish]);

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
    setPhase("idle"); setJob(null); setError(null); setTimedOut(false);
  }, []);

  const busy = phase === "starting" || (phase === "polling" && !timedOut);
  return { phase, job, error, timedOut, busy, start, recheck, reset };
}

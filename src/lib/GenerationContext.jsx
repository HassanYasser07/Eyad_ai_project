/**
 * GenerationContext: the ONLY place that polls generation jobs.
 *
 * The server owns each job (it keeps running when the app is suspended). This provider is a
 * resumable observer: jobs live in a persistent tracker, the poller backs off while a job is
 * unchanged, polls immediately whenever the app comes back (visibility, pageshow, focus, online,
 * Capacitor appStateChange) and never turns a network error into a failure.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { jobService } from "@/services/jobService";
import { clearGenerationRequestForJob } from "@/services/idempotency";
import {
  consumeResult as consumeTrackedResult,
  defaultRouteFor,
  getAllJobs,
  getActiveJobs,
  isTerminalStatus,
  saveResult,
  subscribe,
  trackJob,
  updateJob,
} from "@/services/generationTracker";
import { SOFT_TIMEOUT_MS, nextPollDelay, pollOnce } from "@/services/generationPolling";

const GenerationContext = createContext(null);

function inferKind(payload) {
  const options = payload?.design_options || {};
  if (options.mockup_type) return "mockup";
  if (options.brand_profile_page) return "company-profile";
  if (payload?.studio_id === "logo") return "logo";
  if (payload?.studio_id === "templates") return "template";
  if (payload?.studio_id === "ai-images") return "image";
  return "chat";
}

export function GenerationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;
  const [jobs, setJobs] = useState([]);
  const stateRef = useRef({ userId: null, unchanged: new Map(), timer: null, running: false, stopped: false });

  const refresh = useCallback(() => {
    setJobs(userId ? getAllJobs(userId) : []);
  }, [userId]);

  useEffect(() => {
    refresh();
    return subscribe((changedUserId) => {
      if (!changedUserId || changedUserId === userId) refresh();
    });
  }, [userId, refresh]);

  // ---- polling ------------------------------------------------------------------------------
  const scheduleRef = useRef(() => {});

  const tick = useCallback(async () => {
    const st = stateRef.current;
    if (!userId || st.running || st.stopped) return;
    st.running = true;
    try {
      const active = getActiveJobs(userId);
      await Promise.all(active.map(async (job) => {
        const outcome = await pollOnce(job, (id) => jobService.pollGenerationDetailed(id));
        const now = Date.now();
        if (outcome.kind === "done") {
          st.unchanged.delete(job.jobId);
          clearGenerationRequestForJob(job.jobId);
          saveResult(userId, job.jobId, { status: outcome.data?.status === "completed" ? "completed" : "generated", data: outcome.data });
        } else if (outcome.kind === "failed") {
          st.unchanged.delete(job.jobId);
          clearGenerationRequestForJob(job.jobId);
          saveResult(userId, job.jobId, { status: "failed", error: outcome.error, data: { detail: outcome.detail || "" } });
        } else {
          st.unchanged.set(job.jobId, (st.unchanged.get(job.jobId) || 0) + 1);
          const age = now - Number(job.createdAt || now);
          updateJob(userId, job.jobId, {
            lastPolledAt: now,
            attempts: Number(job.attempts || 0) + 1,
            lastError: outcome.kind === "transient" ? outcome.error : null,
            softTimeoutShown: age >= SOFT_TIMEOUT_MS,
          });
        }
      }));
    } finally {
      st.running = false;
      scheduleRef.current();
    }
  }, [userId]);

  const schedule = useCallback((immediate = false) => {
    const st = stateRef.current;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    if (!userId || st.stopped) return;
    const active = getActiveJobs(userId);
    if (!active.length) return;
    const visible = typeof document === "undefined" || document.visibilityState !== "hidden";
    const worst = Math.min(...active.map((job) => st.unchanged.get(job.jobId) || 0));
    const delay = immediate ? 0 : nextPollDelay(worst, { visible });
    st.timer = setTimeout(() => { st.timer = null; tick(); }, delay);
  }, [userId, tick]);
  scheduleRef.current = () => schedule(false);

  const pollNow = useCallback(() => {
    const st = stateRef.current;
    st.unchanged.clear();
    schedule(true);
  }, [schedule]);

  // Start / stop with the signed-in user, keep scheduling when jobs change.
  useEffect(() => {
    const st = stateRef.current;
    st.stopped = false;
    st.userId = userId;
    if (!userId) return undefined;
    schedule(true);
    const unsubscribe = subscribe((changedUserId) => {
      if (!changedUserId || changedUserId === userId) {
        if (!st.timer && !st.running) schedule(false);
      }
    });
    return () => {
      st.stopped = true;
      if (st.timer) clearTimeout(st.timer);
      st.timer = null;
      unsubscribe();
    };
  }, [userId, schedule]);

  // Immediate poll whenever the app comes back (web + Capacitor).
  useEffect(() => {
    if (!userId) return undefined;
    const onVisible = () => { if (document.visibilityState === "visible") pollNow(); };
    const onResume = () => pollNow();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    let removeNative = null;
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => { if (isActive) pollNow(); });
        if (cancelled) handle.remove(); else removeNative = () => handle.remove();
      } catch {
        // Not running inside Capacitor.
      }
    })();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
      if (removeNative) removeNative();
    };
  }, [userId, pollNow]);

  // Reconcile with the server on startup/login: picks up jobs started elsewhere or after storage was cleared.
  useEffect(() => {
    if (!userId || !isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const serverJobs = await jobService.activeForUser();
        if (cancelled) return;
        const known = new Set(getAllJobs(userId).map((job) => job.jobId));
        let added = false;
        for (const row of serverJobs) {
          if (known.has(row.id)) continue;
          const kind = inferKind(row.payload);
          // Plain text-chat jobs are handled by Chat itself; only recover generation jobs.
          if (kind === "chat" && row.payload?.action !== "generate") continue;
          trackJob(userId, {
            jobId: row.id,
            requestKey: row.request_key || null,
            kind,
            studioId: row.payload?.studio_id || null,
            projectId: row.project_id || null,
            context: { language: row.payload?.language || "ar", mockupId: row.payload?.design_options?.mockup_type || null, recovered: true },
            status: "processing",
            createdAt: Date.parse(row.created_at) || Date.now(),
          });
          added = true;
        }
        if (added) pollNow();
      } catch {
        // Best effort: the local tracker still works.
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isAuthenticated, pollNow]);

  // ---- public API ---------------------------------------------------------------------------
  const startGeneration = useCallback(async ({ kind = "chat", request, context = {}, title = "", route = null }) => {
    if (!userId) throw new Error("AUTH_LOGIN_REQUIRED");
    const data = await runEyadEngine({ ...request, action: "generate" });
    const projectId = data?.project?.id || request?.projectId || null;
    const jobId = data?.job_id || null;
    // Old (synchronous) server: the result is already here.
    if (data?.status === "generated" || data?.status === "completed") {
      const syntheticId = jobId || `local-${crypto.randomUUID()}`;
      trackJob(userId, {
        jobId: syntheticId, kind, studioId: request?.studioId || null, projectId, context, title,
        route: route || defaultRouteFor(kind, projectId), status: "processing",
      });
      saveResult(userId, syntheticId, { status: "generated", data });
      return { jobId: syntheticId, status: "generated", data, projectId };
    }
    if (!jobId) throw new Error(data?.error || "GENERATION_NOT_STARTED");
    trackJob(userId, {
      jobId, requestKey: null, kind, studioId: request?.studioId || null, projectId, context, title,
      route: route || defaultRouteFor(kind, projectId), status: "processing",
    });
    pollNow();
    return { jobId, status: "processing", data, projectId };
  }, [userId, pollNow]);

  /** Track a job that another module (presentation, video…) already started. */
  const trackExternalJob = useCallback((input) => {
    if (!userId) return null;
    const job = trackJob(userId, input);
    pollNow();
    return job;
  }, [userId, pollNow]);

  const consumeResult = useCallback((jobId) => (userId ? consumeTrackedResult(userId, jobId) : null), [userId]);

  const value = useMemo(
    () => ({ jobs, userId, startGeneration, trackExternalJob, consumeResult, pollNow }),
    [jobs, userId, startGeneration, trackExternalJob, consumeResult, pollNow],
  );
  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGenerations() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGenerations must be used within a GenerationProvider");
  return ctx;
}

export function useActiveGenerations() {
  const { jobs } = useGenerations();
  return useMemo(() => jobs.filter((job) => !isTerminalStatus(job.status)), [jobs]);
}

/**
 * Observe the newest tracked job of a screen.
 * `match(job)` narrows by kind/project/context (e.g. same mockupId). Returns a UI-friendly state:
 *  status: "idle" | "running" | "done" | "failed"
 */
export function useGenerationJob({ jobId = null, match = null } = {}) {
  const { jobs, consumeResult } = useGenerations();
  const job = useMemo(() => {
    if (jobId) return jobs.find((item) => item.jobId === jobId) || null;
    if (!match) return null;
    return jobs.find((item) => {
      try { return match(item); } catch { return false; }
    }) || null;
  }, [jobs, jobId, match]);

  const status = !job ? "idle"
    : !isTerminalStatus(job.status) ? "running"
      : job.status === "failed" ? "failed" : "done";

  const consume = useCallback(() => { if (job) consumeResult(job.jobId); }, [job, consumeResult]);

  return {
    job,
    jobId: job?.jobId || null,
    status,
    isActive: status === "running",
    result: job?.result?.status && job.result.status !== "failed" ? job.result.data : null,
    error: status === "failed" ? (job?.result?.error || "GENERATION_FAILED") : null,
    reconnecting: status === "running" && Boolean(job?.lastError),
    longerThanExpected: status === "running" && Boolean(job?.softTimeoutShown),
    consume,
  };
}

export default GenerationContext;

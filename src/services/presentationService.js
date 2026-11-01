import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase";

/**
 * Client for the `eyad-presentation` Edge Function.
 * The browser never sees the Gamma API key: this service only talks to our own
 * backend, which calls Gamma (https://developers.gamma.app) server-side.
 */
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/eyad-presentation`;
const REQUEST_TIMEOUT_MS = 45000;

export const POLL_INTERVAL_MS = 5000; // Gamma recommends polling every ~5 seconds
export const POLL_MAX_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 4;

export class PresentationError extends Error {
  constructor(code, { fields = null, detail = "", retryable = false, status = 0, jobId = null } = {}) {
    super(code);
    this.name = "PresentationError";
    this.code = code;
    this.fields = fields;
    this.detail = detail;
    this.retryable = retryable;
    this.status = status;
    this.jobId = jobId;
  }
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new PresentationError("AUTH_LOGIN_REQUIRED");
  return token;
}

async function callFunction(payload, { signal } = {}) {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  let response;
  try {
    response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new PresentationError("ABORTED");
    // No HTTP response at all: the request may or may not have reached the server.
    throw new PresentationError(error?.name === "AbortError" ? "REQUEST_TIMEOUT" : "NETWORK_ERROR", { retryable: true });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }

  let body = null;
  try { body = await response.json(); } catch { /* ignore */ }
  if (!response.ok || body?.error) {
    throw new PresentationError(body?.error || `HTTP_${response.status}`, {
      fields: body?.fields || null,
      detail: body?.detail || "",
      retryable: Boolean(body?.retryable) || response.status >= 500 || response.status === 429,
      status: response.status,
      jobId: body?.job_id || null,
    });
  }
  return body;
}

/** Starts a real Gamma generation. Resolves with the pending job (never with a fake result). */
export async function startPresentation({ settings, requestId, projectId = null }) {
  const body = await callFunction({ action: "start", request_id: requestId, project_id: projectId, settings });
  return body.job;
}

export async function getPresentationStatus(jobId, { signal } = {}) {
  const body = await callFunction({ action: "status", job_id: jobId }, { signal });
  return body.job;
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new PresentationError("ABORTED")); }, { once: true });
});

/**
 * Polls until Gamma reports `completed` or `failed`.
 * Resolves with the final job, or `{ ...job, status: "pending", timedOut: true }` if the
 * time budget is exhausted (the caller can resume polling later with the same job id).
 */
export async function waitForPresentation(jobId, { onUpdate, signal, intervalMs = POLL_INTERVAL_MS, maxMs = POLL_MAX_MS } = {}) {
  const startedAt = Date.now();
  let consecutiveErrors = 0;
  let lastJob = { id: jobId, status: "pending" };
  for (;;) {
    try {
      lastJob = await getPresentationStatus(jobId, { signal });
      consecutiveErrors = 0;
      onUpdate?.(lastJob);
      if (lastJob.status === "completed" || lastJob.status === "failed") return lastJob;
    } catch (error) {
      if (error.code === "ABORTED") throw error;
      if (!error.retryable) throw error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw error;
    }
    if (Date.now() - startedAt >= maxMs) return { ...lastJob, status: "pending", timedOut: true };
    await sleep(intervalMs, signal);
  }
}

/**
 * Pure helpers for observing server-owned generation jobs.
 * Rule: only a definitive server answer ends a job. Transport errors, 5xx, 429 and
 * provider hiccups are always "transient" and simply retried with backoff.
 */

export const TERMINAL_ERROR_CODES = new Set([
  "JOB_FAILED",
  "JOB_NOT_FOUND",
  "MOCKUP_GENERATION_TIMEOUT",
  "IMAGE_GENERATION_TIMEOUT",
  "IMAGE_PROVIDER_ERROR",
  "EYAD_JOB_RECONCILIATION_TIMEOUT",
  "WORKER_SHUTDOWN",
]);

export const TRANSIENT_ERROR_CODES = new Set([
  "NETWORK_ERROR",
  "NETWORK_TIMEOUT",
  "OPENAI_RESPONSE_POLL_FAILED",
  "JOB_READ_FAILED",
  "JOB_CLAIM_FAILED",
  "ASSET_UPLOAD_FAILED",
  "IMAGE_RESULT_MISSING",
  "GENERATION_FINALIZATION_FAILED",
  "PROJECT_OR_CONVERSATION_NOT_FOUND",
]);

export const SOFT_TIMEOUT_MS = 4 * 60 * 1000;
const BACKOFF_STEPS_MS = [2500, 2500, 5000, 5000, 10000, 15000];

/** Delay before the next poll. `unchangedCount` = consecutive polls without a state change. */
export function nextPollDelay(unchangedCount = 0, { visible = true } = {}) {
  const index = Math.max(0, Math.min(Number(unchangedCount) || 0, BACKOFF_STEPS_MS.length - 1));
  const base = BACKOFF_STEPS_MS[index];
  return visible ? base : Math.max(base, 15000);
}

/**
 * Classify one poll outcome.
 * input: { httpStatus, data, networkError }
 * returns { kind: "processing" | "done" | "failed" | "transient", data?, error?, detail? }
 */
export function classifyPoll({ httpStatus = 200, data = null, networkError = false } = {}) {
  if (networkError) return { kind: "transient", error: "NETWORK_ERROR" };
  const code = String(data?.error || "");
  const detail = String(data?.detail || "");

  if (httpStatus >= 200 && httpStatus < 300 && !code) {
    if (data?.status === "generated" || data?.status === "completed") return { kind: "done", data };
    if (data?.status === "failed") return { kind: "failed", error: String(data?.detail || data?.error || "GENERATION_FAILED"), detail };
    return { kind: "processing", data };
  }
  if (httpStatus === 404 && code === "JOB_NOT_FOUND") return { kind: "failed", error: "JOB_NOT_FOUND", detail };
  if (TERMINAL_ERROR_CODES.has(code)) return { kind: "failed", error: code, detail };
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) {
    return { kind: "transient", error: code || `HTTP_${httpStatus}`, detail };
  }
  if (TRANSIENT_ERROR_CODES.has(code)) return { kind: "transient", error: code, detail };
  // Unknown 4xx with a code: the request itself is wrong, retrying will not help.
  if (httpStatus >= 400 && code) return { kind: "failed", error: code, detail };
  return { kind: "transient", error: code || "UNKNOWN_POLL_RESULT", detail };
}

export function isTransientErrorMessage(message) {
  const text = String(message || "");
  return [...TRANSIENT_ERROR_CODES].some((code) => text.includes(code)) || /HTTP_5\d\d|HTTP_429/.test(text);
}

export function isRetryableSubmitError(error) {
  return Boolean(error?.retryable) || isTransientErrorMessage(error?.message);
}

/** Poll one job with an injected poll function (`(jobId) => { httpStatus, data, networkError }`). */
export async function pollOnce(job, pollFn) {
  let raw;
  try {
    raw = await pollFn(job.jobId);
  } catch {
    raw = { networkError: true };
  }
  return classifyPoll(raw || { networkError: true });
}

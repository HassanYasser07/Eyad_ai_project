import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase";
import { clearGenerationRequest, getGenerationRequestId, rememberGenerationRequestJob } from "@/services/idempotency";
import { jobService } from "@/services/jobService";

const ENGINE_URL = `${SUPABASE_URL}/functions/v1/eyad-engine`;
const REQUEST_TIMEOUT_MS = 150000;
const SUBMIT_TIMEOUT_MS = 45000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the EYAD engine edge function using fetch() directly (not supabase.functions.invoke)
 * so we can capture full network diagnostics: URL, HTTP status, response body,
 * elapsed time, timeout detection, and whether the connection was dropped.
 *
 * All diagnostics go to console.error/console.log. The user sees only a simple
 * Arabic message from Chat.jsx's catch block.
 */
export async function runEyadEngine({
  message,
  projectId = null,
  studioId = null,
  language = "ar",
  action = "chat",
  designOptions = {},
  referenceImage = null,
  attachments = [],
  requestId = null,
} = {}) {
  const stableRequestId = requestId || crypto.randomUUID();
  if (!message?.trim() && !attachments.length) throw new Error("MESSAGE_REQUIRED");

  // --- Auth: get access token (anonymous fallback) ---
  let accessToken = null;
  let { data: sessionData } = await supabase.auth.getSession();
  accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    const { data: anonymousData, error: anonymousError } =
      await supabase.auth.signInAnonymously();

    if (anonymousError || !anonymousData?.session?.access_token) {
      console.error("[EYAD Engine] anonymous auth failed", {
        error: anonymousError?.message,
        errorName: anonymousError?.name,
      });
      throw new Error("AUTH_LOGIN_REQUIRED");
    }

    accessToken = anonymousData.session.access_token;
  }

  const body = {
    message: message.trim(),
    project_id: projectId,
    studio_id: studioId,
    language: language === "en" ? "en" : "ar",
    action: action === "generate"
      ? "generate"
      : action === "vectorize_logo"
        ? "vectorize_logo"
        : "chat",
    design_options: designOptions,
    reference_image: referenceImage,
    attachments,
    request_id: stableRequestId,
  };
  const requestKey = await getGenerationRequestId(body);
  body.request_key = requestKey;

  const startTime = Date.now();
  // The server now answers `generate` within a couple of seconds (it keeps working in the
  // background), so a short timeout + a few idempotent retries (same request_key) is enough.
  // Chat keeps the long window because it still returns the planner reply directly.
  const isGenerate = body.action === "generate";
  const MAX_ATTEMPTS = isGenerate ? 3 : 1;
  const attemptTimeoutMs = isGenerate ? SUBMIT_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const RETRY_DELAYS_MS = [1000, 3000];
  let timeoutId = null;
  let response = null;
  let lastTransportError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      console.log("[EYAD Engine] sending request", {
        url: ENGINE_URL,
        action: body.action,
        attempt,
        hasMessage: Boolean(body.message),
        hasProjectId: Boolean(body.project_id),
        hasReferenceImage: Boolean(body.reference_image),
        attachmentCount: attachments?.length || 0,
        requestId: stableRequestId,
      });

      response = await fetch(ENGINE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // 5xx / 429 on submit are retried with the SAME request_key (server replays, no double charge).
      if (isGenerate && (response.status >= 500 || response.status === 429) && attempt < MAX_ATTEMPTS) {
        console.warn("[EYAD Engine] submit got retryable HTTP status", { status: response.status, attempt });
        response = null;
        await sleep(RETRY_DELAYS_MS[attempt - 1] || 3000);
        continue;
      }
      break;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      const isTimeout = fetchError?.name === "AbortError";
      lastTransportError = isTimeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR";

      console.error("[EYAD Engine] fetch() FAILED", {
        url: ENGINE_URL,
        attempt,
        elapsed_ms: elapsed,
        errorName: fetchError?.name,
        errorMessage: fetchError?.message,
        isTimeout,
        isNetworkError: true,
        reachedServer: false,
        hint: isTimeout
          ? `Request timed out after ${attemptTimeoutMs}ms. The server may already own the job: it is looked up by request_key below.`
          : "fetch() threw before any response was received (offline, app suspended, DNS/TLS, CORS or ad blocker).",
      });

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAYS_MS[attempt - 1] || 3000);
        continue;
      }
    }
  }

  if (!response) {
    // Every attempt failed on the transport level. The request may still have reached the
    // server (app suspended mid-flight): if a job exists for this key, hand it back as
    // "processing" so the caller observes it instead of showing a failure.
    if (isGenerate) {
      try {
        const existing = await jobService.byRequestKey(requestKey);
        if (existing?.id) {
          await rememberGenerationRequestJob(
            Object.fromEntries(Object.entries(body).filter(([key]) => key !== "request_key")),
            existing.id,
          );
          const status = existing.status === "completed" ? "completed" : existing.status === "failed" ? "failed" : "processing";
          return {
            ok: true,
            status,
            job_id: existing.id,
            project: existing.project_id ? { id: existing.project_id } : undefined,
            conversation: existing.conversation_id ? { id: existing.conversation_id } : undefined,
            message_id: existing.message_id || undefined,
            recovered: true,
          };
        }
      } catch {
        // fall through to the retryable error below
      }
    }
    const transportError = new Error(lastTransportError || "NETWORK_ERROR");
    transportError.retryable = true;
    throw transportError;
  }

  clearTimeout(timeoutId);
  const elapsed = Date.now() - startTime;
  const httpStatus = response.status;
  const corsOrigin = response.headers.get("access-control-allow-origin");

  // --- Read response body ---
  let responseText = null;
  try {
    responseText = await response.text();
  } catch (readError) {
    console.error("[EYAD Engine] response.text() FAILED", {
      url: ENGINE_URL,
      httpStatus,
      elapsed_ms: elapsed,
      errorName: readError?.name,
      errorMessage: readError?.message,
      reachedServer: true,
      hint: "The server sent a response but the connection dropped while reading the body.",
    });
    const readError2 = new Error("NETWORK_ERROR");
    readError2.retryable = true;
    throw readError2;
  }

  // --- Parse JSON ---
  let data = null;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error("[EYAD Engine] JSON parse FAILED", {
      url: ENGINE_URL,
      httpStatus,
      elapsed_ms: elapsed,
      responseText: responseText?.slice(0, 500),
      reachedServer: true,
      hint: "The server responded but the body is not valid JSON. This may be a Cloudflare error page or a relay error.",
    });
    throw new Error("INVALID_RESPONSE");
  }

  if (data?.job_id) await rememberGenerationRequestJob(
    Object.fromEntries(Object.entries(body).filter(([key]) => key !== "request_key")),
    data.job_id,
  );
  if (["generated", "completed", "failed"].includes(data?.status)) {
    await clearGenerationRequest(Object.fromEntries(Object.entries(body).filter(([key]) => key !== "request_key")));
  }

  // --- HTTP error ---
  if (!response.ok) {
    console.error("[EYAD Engine] HTTP ERROR", {
      url: ENGINE_URL,
      httpStatus,
      corsOrigin,
      elapsed_ms: elapsed,
      responseBody: data,
      reachedServer: true,
    });
    // Throw the structured error CODE (data.error) so the UI can show a
    // specific user-friendly message. The detailed error (data.detail) is
    // logged above for server-side debugging and stays in the job record.
    const errorCode = data?.error || `HTTP_${httpStatus}`;
    const errorDetail = data?.detail ? String(data.detail) : "";
    const httpError = new Error(errorDetail ? `${errorCode}: ${errorDetail}` : errorCode);
    httpError.httpStatus = httpStatus;
    httpError.retryable = httpStatus >= 500 || httpStatus === 429;
    throw httpError;
  }

  // --- Function-level error ---
  if (data?.error) {
    console.error("[EYAD Engine] function returned ERROR", {
      url: ENGINE_URL,
      httpStatus,
      elapsed_ms: elapsed,
      responseBody: data,
      reachedServer: true,
    });
    throw new Error(data.error || data.detail);
  }

  console.log("[EYAD Engine] SUCCESS", {
    url: ENGINE_URL,
    httpStatus,
    elapsed_ms: elapsed,
    status: data?.status,
    hasReply: Boolean(data?.reply),
    hasJobId: Boolean(data?.job_id),
    hasImage: Boolean(data?.image?.data_url),
    hasChoices: Array.isArray(data?.choices) && data.choices.length > 0,
  });

  return data;
}

export default runEyadEngine;

import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase";
import { clearGenerationRequest, getGenerationRequestId, rememberGenerationRequestJob } from "@/services/idempotency";

const ENGINE_URL = `${SUPABASE_URL}/functions/v1/eyad-engine`;
const REQUEST_TIMEOUT_MS = 120000;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response = null;

  try {
    console.log("[EYAD Engine] sending request", {
      url: ENGINE_URL,
      action: body.action,
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
  } catch (fetchError) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    const isTimeout = fetchError?.name === "AbortError";

    console.error("[EYAD Engine] fetch() FAILED", {
      url: ENGINE_URL,
      elapsed_ms: elapsed,
      errorName: fetchError?.name,
      errorMessage: fetchError?.message,
      isTimeout,
      isNetworkError: true,
      reachedServer: false,
      hint: isTimeout
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms. The edge function may still be processing on the server — check if a job was created.`
        : "fetch() threw before any response was received. The connection was never established or was dropped. Check: network connectivity, DNS, TLS, CORS, ad blockers, or the edge function URL.",
    });

    throw new Error(isTimeout ? "NETWORK_TIMEOUT" : "NETWORK_ERROR");
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
    throw new Error("NETWORK_ERROR");
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
    throw new Error(errorDetail ? `${errorCode}: ${errorDetail}` : errorCode);
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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildGammaRequest,
  mapGammaHttpError,
  normalizeGammaStatus,
  withoutTheme,
} from "./gammaRequest.mjs";

/**
 * eyad-presentation
 *
 * Secure bridge between the Eyad UI and Gamma's Generate API.
 *  - The Gamma key is read ONLY from the Edge Function secret GAMMA_API_KEY and is
 *    never returned, logged, or sent to the browser.
 *  - Optional secret GAMMA_THEME_IDS: JSON map { "<colorPackageId>": "<gamma themeId>" }.
 *    Gamma's public API cannot take raw colors; a theme is the only supported way to
 *    apply an exact palette. Packages without a mapping fall back to color guidance
 *    inside `additionalInstructions` (best-effort, reported to the client).
 *
 * Actions (POST JSON):
 *   { action: "start",  request_id, project_id?, settings }  -> creates a job + Gamma generation
 *   { action: "status", job_id }                             -> polls Gamma and returns the real state
 *
 * Gamma docs: https://developers.gamma.app/docs/generate-api-parameters-explained
 *             https://developers.gamma.app/guides/async-patterns-and-polling
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GAMMA_BASE = "https://public-api.gamma.app/v1.0";
const GAMMA_TIMEOUT_MS = 25_000;
const MAX_ACTIVE_JOBS_PER_USER = 2;
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const STALE_PENDING_MS = 30 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearer(req: Request) {
  const value = req.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function parseThemeIds(): Record<string, string> {
  const raw = Deno.env.get("GAMMA_THEME_IDS") || "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed || {})) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    console.error("[eyad-presentation] GAMMA_THEME_IDS is not valid JSON; ignoring it");
    return {};
  }
}

async function gammaFetch(path: string, apiKey: string, init: { method: string; body?: unknown }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GAMMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${GAMMA_BASE}${path}`, {
      method: init.method,
      headers: {
        "X-API-KEY": apiKey,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    let body: any = null;
    try { body = await response.json(); } catch { /* non-JSON body */ }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return { ok: false, status: aborted ? 504 : 0, body: null, networkError: true };
  } finally {
    clearTimeout(timer);
  }
}

function gammaDetail(body: any): string {
  const message = body?.message || body?.error?.message || (typeof body?.error === "string" ? body.error : "");
  return String(message || "").slice(0, 300);
}

// Persist only the known, already-validated form fields (never arbitrary client JSON).
function pickSettings(settings: any) {
  const cp = settings?.colorPackage || {};
  return {
    topic: String(settings?.topic || ""),
    purpose: String(settings?.purpose || ""),
    audience: String(settings?.audience || ""),
    customAudience: String(settings?.customAudience || ""),
    slideCount: String(settings?.slideCount || "auto"),
    language: String(settings?.language || ""),
    otherLanguage: String(settings?.otherLanguage || ""),
    additionalInstructions: String(settings?.additionalInstructions || ""),
    colorPackage: { id: String(cp.id || ""), name: String(cp.name || ""), colors: Array.isArray(cp.colors) ? cp.colors.map(String) : [] },
  };
}

function publicJob(row: any) {
  const meta = row?.gamma_meta || {};
  return {
    id: row.id,
    status: row.status,
    gamma_url: row.gamma_url || null,
    export_url: row.export_url || null,
    error_code: row.error_code || null,
    error_message: row.error_message || null,
    color_application: meta.colorApplication || null,
    theme_rejected: Boolean(meta.themeRejected),
    slide_count: meta.slideCount ?? null,
    slide_count_note: meta.slideCountNote || null,
    purpose_source: meta.purposeSource || null,
    created_at: row.created_at,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = getBearer(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  let publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!publishableKey) {
    try { publishableKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || ""; } catch { /* ignore */ }
  }
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !publishableKey) return json({ error: "BACKEND_AUTH_CONFIG_ERROR" }, 500);
  if (!serviceRoleKey) return json({ error: "BACKEND_SERVICE_ROLE_CONFIG_ERROR" }, 500);

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "INVALID_SESSION" }, 401);
  const user = userData.user;

  // Gamma generations cost credits: guests cannot trigger them.
  if (user.is_anonymous) return json({ error: "ACCOUNT_REQUIRED" }, 403);

  const gammaKey = Deno.env.get("GAMMA_API_KEY") || "";
  if (!gammaKey) return json({ error: "GAMMA_API_KEY_MISSING" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(body?.action || "");

  /* ------------------------------- start ------------------------------- */
  if (action === "start") {
    const requestId = String(body?.request_id || "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return json({ error: "INVALID_REQUEST_ID" }, 400);

    const built = buildGammaRequest(body?.settings, { themeIds: parseThemeIds() });
    if (!built.ok) return json({ error: "VALIDATION_FAILED", fields: built.errors }, 400);

    let projectId: string | null = null;
    if (body?.project_id) {
      const candidate = String(body.project_id);
      if (!UUID.test(candidate)) return json({ error: "INVALID_PROJECT_ID" }, 400);
      const { data: project } = await admin.from("projects").select("id").eq("id", candidate).eq("owner_id", user.id).maybeSingle();
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      projectId = candidate;
    }

    // Idempotency: the same request_id returns the same job instead of billing Gamma twice.
    const { data: existing } = await admin.from("gamma_presentation_jobs").select("*")
      .eq("owner_id", user.id).eq("request_id", requestId).maybeSingle();
    if (existing) {
      if (existing.generation_id || existing.status !== "pending") return json({ ok: true, job: publicJob(existing), reused: true });
      return json({ error: "REQUEST_IN_PROGRESS" }, 409);
    }

    // Cost guard: limit concurrent active generations per user.
    const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
    const { count } = await admin.from("gamma_presentation_jobs").select("id", { count: "exact", head: true })
      .eq("owner_id", user.id).eq("status", "pending").gte("created_at", since);
    if ((count || 0) >= MAX_ACTIVE_JOBS_PER_USER) return json({ error: "TOO_MANY_ACTIVE_JOBS" }, 429);

    const { data: inserted, error: insertError } = await admin.from("gamma_presentation_jobs").insert({
      owner_id: user.id,
      request_id: requestId,
      project_id: projectId,
      status: "pending",
      settings: pickSettings(body.settings),
      gamma_meta: built.meta,
    }).select("*").single();
    if (insertError || !inserted) {
      console.error("[eyad-presentation] job insert failed", insertError?.code);
      return json({ error: "JOB_CREATE_FAILED" }, 500);
    }

    const failJob = async (code: string, message: string) => {
      await admin.from("gamma_presentation_jobs").update({
        status: "failed", error_code: code, error_message: message.slice(0, 400), updated_at: new Date().toISOString(),
      }).eq("id", inserted.id);
    };

    let gammaRequest = built.request;
    let meta = { ...built.meta, themeRejected: false };
    let result = await gammaFetch("/generations", gammaKey, { method: "POST", body: gammaRequest });

    // If a configured theme id is rejected, retry once with palette guidance instead of failing.
    if (!result.ok && (result.status === 400 || result.status === 422) && gammaRequest.themeId) {
      gammaRequest = withoutTheme(gammaRequest, body.settings.colorPackage);
      meta = { ...meta, colorApplication: "instructions", themeIdUsed: null, themeRejected: true };
      result = await gammaFetch("/generations", gammaKey, { method: "POST", body: gammaRequest });
    }

    if (!result.ok || !result.body?.generationId) {
      const mapped = result.networkError ? { code: "GAMMA_UNAVAILABLE", http: 502 } : mapGammaHttpError(result.status);
      const detail = gammaDetail(result.body);
      console.error("[eyad-presentation] gamma create failed", { status: result.status, code: mapped.code });
      await failJob(mapped.code, detail || mapped.code);
      return json({ error: mapped.code, detail, job_id: inserted.id }, mapped.http);
    }

    const { data: updated } = await admin.from("gamma_presentation_jobs").update({
      generation_id: String(result.body.generationId),
      gamma_meta: meta,
      updated_at: new Date().toISOString(),
    }).eq("id", inserted.id).select("*").single();

    return json({ ok: true, job: publicJob(updated || { ...inserted, gamma_meta: meta, generation_id: result.body.generationId }) });
  }

  /* ------------------------------- status ------------------------------- */
  if (action === "status") {
    const jobId = String(body?.job_id || "");
    if (!UUID.test(jobId)) return json({ error: "INVALID_JOB_ID" }, 400);

    const { data: job } = await admin.from("gamma_presentation_jobs").select("*")
      .eq("id", jobId).eq("owner_id", user.id).maybeSingle();
    if (!job) return json({ error: "JOB_NOT_FOUND" }, 404);
    if (job.status !== "pending") return json({ ok: true, job: publicJob(job) });
    if (!job.generation_id) return json({ ok: true, job: publicJob(job) });

    const result = await gammaFetch(`/generations/${encodeURIComponent(job.generation_id)}`, gammaKey, { method: "GET" });

    if (!result.ok) {
      if (result.status === 404) {
        const { data: failed } = await admin.from("gamma_presentation_jobs").update({
          status: "failed", error_code: "GENERATION_NOT_FOUND", error_message: "Gamma could not find this generation.", updated_at: new Date().toISOString(),
        }).eq("id", job.id).select("*").single();
        return json({ ok: true, job: publicJob(failed || job) });
      }
      // Transient problem (network, 5xx, rate limit): keep the job pending; the client retries.
      const mapped = result.networkError ? { code: "GAMMA_UNAVAILABLE", http: 502 } : mapGammaHttpError(result.status);
      console.error("[eyad-presentation] gamma status failed", { status: result.status, code: mapped.code });
      return json({ error: mapped.code, retryable: true }, mapped.http);
    }

    const normalized = normalizeGammaStatus(result.body);
    if (normalized.status === "pending") {
      if (Date.now() - new Date(job.created_at).getTime() > STALE_PENDING_MS) {
        const { data: timedOut } = await admin.from("gamma_presentation_jobs").update({
          status: "failed", error_code: "GENERATION_TIMEOUT", error_message: "The presentation took too long to generate.", updated_at: new Date().toISOString(),
        }).eq("id", job.id).select("*").single();
        return json({ ok: true, job: publicJob(timedOut || job) });
      }
      return json({ ok: true, job: publicJob(job) });
    }

    const { data: finished } = await admin.from("gamma_presentation_jobs").update({
      status: normalized.status,
      gamma_url: normalized.gammaUrl,
      export_url: normalized.exportUrl,
      error_code: normalized.status === "failed" ? "GAMMA_GENERATION_FAILED" : null,
      error_message: normalized.errorMessage,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).select("*").single();

    return json({ ok: true, job: publicJob(finished || job) });
  }

  return json({ error: "UNKNOWN_ACTION" }, 400);
});

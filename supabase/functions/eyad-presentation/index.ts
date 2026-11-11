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
 *  - Templates live in Supabase (presentation_templates). The client only sends a template id;
 *    the Gamma template / theme ids are read here with the service role and never trusted
 *    from the browser.
 *
 * Actions (POST JSON):
 *   { action: "start",  request_id, project_id?, template_id?, settings }  -> creates a project (or uses project_id) + job + Gamma generation
 *   { action: "status", job_id }                             -> polls Gamma; on completion stores the .pptx in the private
 *                                                               "presentation-files" bucket as version 1 of the project
 *   { action: "download",    project_id, version_id? }       -> short-lived Signed URL of a saved version (latest by default)
 *   { action: "save_init",   project_id?, mode, replace_version_id?, file_name, size } -> Signed UPLOAD URL for a new file
 *   { action: "save_commit", project_id, version_id, mode, replace_version_id?, file_name, new_project? } -> registers the upload
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

// Presentation files: private bucket only, reached through Signed URLs.
const BUCKET = "presentation-files";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_PPTX_BYTES = 100 * 1024 * 1024; // same as the bucket's file_size_limit
const MAX_VERSIONS_PER_PROJECT = 30;
const SIGNED_URL_TTL_S = 600;
const EXPORT_DOWNLOAD_TIMEOUT_MS = 90_000;

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
// The attached file's text is NOT stored, only its name and size.
function pickSettings(settings: any, templateId: string | null) {
  return {
    topic: String(settings?.topic || ""),
    fileName: String(settings?.fileName || "").slice(0, 200),
    fileChars: String(settings?.fileText || "").length,
    detail: String(settings?.detail || "standard"),
    slideCount: String(settings?.slideCount || "auto"),
    language: String(settings?.language || "auto"),
    templateId,
  };
}

function publicJob(row: any, version: any = null) {
  const meta = row?.gamma_meta || {};
  return {
    id: row.id,
    status: row.status,
    project_id: row.project_id || null,
    gamma_url: row.gamma_url || null,
    export_url: row.export_url || null,
    error_code: row.error_code || null,
    error_message: row.error_message || null,
    theme_rejected: Boolean(meta.themeRejected),
    slide_count: meta.slideCount ?? null,
    slide_count_note: meta.slideCountNote || null,
    language_source: meta.languageSource || null,
    template_mode: meta.templateMode || null,
    // The .pptx kept in our private bucket (what the Eyad editor opens).
    pptx_ready: Boolean(version),
    version_id: version?.id || null,
    version_no: version?.version_no ?? null,
    pptx_error: version ? null : (row.pptx_error || null),
    created_at: row.created_at,
  };
}

function publicVersion(row: any) {
  return {
    id: row.id,
    project_id: row.project_id,
    version_no: row.version_no,
    source: row.source,
    label: row.label || null,
    file_name: row.file_name || null,
    size_bytes: row.size_bytes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const storagePathFor = (userId: string, projectId: string, fileId: string) => `${userId}/${projectId}/${fileId}.pptx`;

function titleFrom(text: string, fallback: string) {
  const line = String(text || "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
  const clean = line.replace(/\.pptx$/i, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return clean || fallback;
}

async function isPptxStart(res: Response): Promise<boolean> {
  // First bytes of a .pptx are the ZIP signature "PK".
  try {
    const reader = res.body?.getReader();
    if (!reader) return true;
    const { value } = await reader.read();
    await reader.cancel();
    return !value || value.length < 2 || (value[0] === 0x50 && value[1] === 0x4b);
  } catch { return true; }
}

/** Merges `patch` into projects.metadata.project_data.presentation (never touches other project_data keys). */
async function patchProjectPresentation(admin: any, userId: string, projectId: string, patch: Record<string, unknown>, projectUpdate: Record<string, unknown> = {}) {
  const { data: project } = await admin.from("projects").select("metadata").eq("id", projectId).eq("owner_id", userId).maybeSingle();
  if (!project) return false;
  const metadata = project.metadata || {};
  const projectData = metadata.project_data || {};
  const now = new Date().toISOString();
  const { error } = await admin.from("projects").update({
    ...projectUpdate,
    metadata: {
      ...metadata,
      project_data: {
        ...projectData,
        last_studio_id: "presentations",
        presentation: { ...(projectData.presentation || {}), ...patch, updated_at: now },
      },
    },
    updated_at: now,
  }).eq("id", projectId).eq("owner_id", userId);
  return !error;
}

/** Inserts a version with the next version_no. Retries on a (project_id, version_no) race; idempotent per job_id. */
async function insertVersion(admin: any, row: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: last } = await admin.from("presentation_versions").select("version_no")
      .eq("project_id", row.project_id).order("version_no", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await admin.from("presentation_versions")
      .insert({ ...row, version_no: (last?.version_no || 0) + 1 }).select("*").single();
    if (!error) return { data };
    if (error.code === "23505") {
      if (row.job_id) {
        const { data: existing } = await admin.from("presentation_versions").select("*").eq("job_id", row.job_id).maybeSingle();
        if (existing) return { data: existing };
      }
      continue;
    }
    return { error };
  }
  return { error: { code: "VERSION_CONFLICT" } };
}

async function versionForJob(admin: any, job: any) {
  const { data } = await admin.from("presentation_versions").select("*").eq("job_id", job.id).maybeSingle();
  return data || null;
}

/**
 * Gamma finished: copy its exported .pptx into the private bucket and register it as a project version.
 * Idempotent (deterministic path per job + unique job_id), so overlapping polls cannot duplicate it.
 * Never throws: a failure is recorded in pptx_error and the job stays "completed" (the Gamma link still works).
 */
async function storeGammaPptx(admin: any, job: any): Promise<{ version: any | null; error: string | null }> {
  const existing = await versionForJob(admin, job);
  if (existing) return { version: existing, error: null };

  const fail = async (code: string) => {
    await admin.from("gamma_presentation_jobs").update({ pptx_error: code, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (job.project_id) await patchProjectPresentation(admin, job.owner_id, job.project_id, { status: "ready", job_id: job.id, gamma_url: job.gamma_url || null, pptx_error: code });
    return { version: null, error: code };
  };

  if (!job.project_id) return fail("NO_PROJECT");
  if (!job.export_url) return fail("NO_EXPORT_URL");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPORT_DOWNLOAD_TIMEOUT_MS);
  let bytes: Uint8Array;
  try {
    const res = await fetch(job.export_url, { signal: controller.signal });
    if (!res.ok) return await fail(`EXPORT_DOWNLOAD_${res.status}`);
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_PPTX_BYTES) return await fail("EXPORT_TOO_LARGE");
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return await fail("EXPORT_DOWNLOAD_FAILED");
  } finally {
    clearTimeout(timer);
  }
  if (bytes.length === 0 || bytes.length > MAX_PPTX_BYTES) return fail("EXPORT_FILE_INVALID");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return fail("EXPORT_NOT_PPTX");

  const path = storagePathFor(job.owner_id, job.project_id, job.id);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: PPTX_MIME, upsert: true });
  if (uploadError) {
    console.error("[eyad-presentation] pptx upload failed", uploadError.message);
    return fail("STORAGE_UPLOAD_FAILED");
  }

  const fileName = `${titleFrom(String(job.settings?.topic || job.settings?.fileName || ""), "Presentation")}.pptx`;
  const { data: version, error: insertError } = await insertVersion(admin, {
    id: job.id, owner_id: job.owner_id, project_id: job.project_id, source: "gamma", label: null,
    file_name: fileName, storage_path: path, size_bytes: bytes.length, job_id: job.id,
  });
  if (insertError || !version) {
    console.error("[eyad-presentation] version insert failed", insertError?.code);
    await admin.storage.from(BUCKET).remove([path]);
    return fail("VERSION_CREATE_FAILED");
  }

  await admin.from("gamma_presentation_jobs").update({ pptx_path: path, pptx_error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
  await patchProjectPresentation(admin, job.owner_id, job.project_id, {
    status: "ready", job_id: job.id, gamma_url: job.gamma_url || null, pptx_error: null,
    latest_version_id: version.id, latest_version_no: version.version_no, file_name: version.file_name,
  }, { status: "completed" });
  return { version, error: null };
}

async function jobView(admin: any, job: any) {
  if (job.status === "completed") {
    const { version } = await storeGammaPptx(admin, job); // no-op when already stored
    const fresh = version ? job : (await admin.from("gamma_presentation_jobs").select("*").eq("id", job.id).maybeSingle()).data || job;
    return publicJob(fresh, version);
  }
  return publicJob(job, null);
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

  // Only generation (start / status-while-pending) needs the Gamma key; opening and saving files does not.
  const gammaKey = Deno.env.get("GAMMA_API_KEY") || "";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const action = String(body?.action || "");

  /* ------------------------------- start ------------------------------- */
  if (action === "start") {
    if (!gammaKey) return json({ error: "GAMMA_API_KEY_MISSING" }, 503);
    const requestId = String(body?.request_id || "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return json({ error: "INVALID_REQUEST_ID" }, 400);

    // Optional template: looked up with the service role so Gamma ids never come from the browser.
    let template: any = null;
    let templateId: string | null = null;
    if (body?.template_id) {
      const candidate = String(body.template_id);
      if (!UUID.test(candidate)) return json({ error: "INVALID_TEMPLATE_ID" }, 400);
      const { data: row } = await admin.from("presentation_templates").select("*")
        .eq("id", candidate).eq("is_active", true).maybeSingle();
      if (!row) return json({ error: "TEMPLATE_NOT_FOUND" }, 404);
      template = row;
      templateId = candidate;
    }

    const built = buildGammaRequest(body?.settings, { template });
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
      if (existing.generation_id || existing.status !== "pending") return json({ ok: true, job: await jobView(admin, existing), reused: true });
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
      settings: pickSettings(body.settings, templateId),
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

    // Every generation belongs to a project: the one that is open (?project=), or a new "presentations" project.
    let createdProjectId: string | null = null;
    if (!projectId) {
      const language = built.meta.languageCode && !String(built.meta.languageCode).startsWith("ar") ? "en" : "ar";
      const fallbackName = language === "ar" ? "عرض تقديمي" : "Presentation";
      const name = titleFrom(String(body?.settings?.topic || ""), titleFrom(String(body?.settings?.fileName || ""), fallbackName));
      const { data: createdProject, error: projectError } = await admin.from("projects").insert({
        owner_id: user.id, name, studio_type: "presentations", status: "in_progress", language,
        metadata: { project_data: { last_studio_id: "presentations" } },
      }).select("id").single();
      if (projectError || !createdProject) {
        console.error("[eyad-presentation] project create failed", projectError?.code);
        await failJob("PROJECT_CREATE_FAILED", "Could not create the project.");
        return json({ error: "PROJECT_CREATE_FAILED", job_id: inserted.id }, 500);
      }
      projectId = createdProject.id;
      createdProjectId = createdProject.id;
    }
    await admin.from("gamma_presentation_jobs").update({ project_id: projectId }).eq("id", inserted.id);
    inserted.project_id = projectId;

    // Ask Gamma for a .pptx export too: the Eyad editor opens that file (the link is short-lived, so it is copied on completion).
    let gammaRequest = { ...built.request, exportAs: "pptx" };
    let meta = { ...built.meta, themeRejected: false };
    let result = await gammaFetch(built.endpoint, gammaKey, { method: "POST", body: gammaRequest });

    // If the template's theme id is rejected, retry once without it instead of failing.
    if (!result.ok && (result.status === 400 || result.status === 422) && gammaRequest.themeId) {
      gammaRequest = withoutTheme(gammaRequest);
      meta = { ...meta, themeIdUsed: null, themeRejected: true };
      result = await gammaFetch(built.endpoint, gammaKey, { method: "POST", body: gammaRequest });
    }

    // Last resort: if Gamma refuses the export option itself, generate without it (the deck still exists on Gamma;
    // the project card then offers a retry, but no .pptx can be copied for that job).
    if (!result.ok && (result.status === 400 || result.status === 422) && gammaRequest.exportAs) {
      const { exportAs: _dropped, ...withoutExport } = gammaRequest;
      gammaRequest = withoutExport as typeof gammaRequest;
      meta = { ...meta, exportRejected: true };
      result = await gammaFetch(built.endpoint, gammaKey, { method: "POST", body: gammaRequest });
    }

    if (!result.ok || !result.body?.generationId) {
      const mapped = result.networkError ? { code: "GAMMA_UNAVAILABLE", http: 502 } : mapGammaHttpError(result.status);
      const detail = gammaDetail(result.body);
      console.error("[eyad-presentation] gamma create failed", { status: result.status, code: mapped.code });
      await failJob(mapped.code, detail || mapped.code);
      // Nothing was generated: do not leave an empty project behind (only one this request created).
      if (createdProjectId) await admin.from("projects").delete().eq("id", createdProjectId).eq("owner_id", user.id);
      return json({ error: mapped.code, detail, job_id: inserted.id }, mapped.http);
    }

    const { data: updated } = await admin.from("gamma_presentation_jobs").update({
      generation_id: String(result.body.generationId),
      gamma_meta: meta,
      updated_at: new Date().toISOString(),
    }).eq("id", inserted.id).select("*").single();

    await patchProjectPresentation(admin, user.id, projectId!, { status: "generating", job_id: inserted.id });
    return json({ ok: true, job: publicJob(updated || { ...inserted, gamma_meta: meta, generation_id: result.body.generationId }) });
  }

  /* ------------------------------- status ------------------------------- */
  if (action === "status") {
    const jobId = String(body?.job_id || "");
    if (!UUID.test(jobId)) return json({ error: "INVALID_JOB_ID" }, 400);

    const { data: job } = await admin.from("gamma_presentation_jobs").select("*")
      .eq("id", jobId).eq("owner_id", user.id).maybeSingle();
    if (!job) return json({ error: "JOB_NOT_FOUND" }, 404);
    if (job.status !== "pending") return json({ ok: true, job: await jobView(admin, job) });
    if (!job.generation_id) return json({ ok: true, job: publicJob(job) });
    if (!gammaKey) return json({ error: "GAMMA_API_KEY_MISSING" }, 503);

    // A failed generation never deletes the project; its card says what happened (older versions, if any, stay usable).
    const markPresentationFailed = async (failedJob: any) => {
      if (!failedJob?.project_id) return;
      const { count: versionCount } = await admin.from("presentation_versions").select("id", { count: "exact", head: true })
        .eq("project_id", failedJob.project_id).eq("owner_id", user.id);
      await patchProjectPresentation(admin, user.id, failedJob.project_id, { status: (versionCount || 0) > 0 ? "ready" : "failed", job_id: failedJob.id, pptx_error: null });
    };

    const result = await gammaFetch(`/generations/${encodeURIComponent(job.generation_id)}`, gammaKey, { method: "GET" });

    if (!result.ok) {
      if (result.status === 404) {
        const { data: failed } = await admin.from("gamma_presentation_jobs").update({
          status: "failed", error_code: "GENERATION_NOT_FOUND", error_message: "Gamma could not find this generation.", updated_at: new Date().toISOString(),
        }).eq("id", job.id).select("*").single();
        await markPresentationFailed(failed || job);
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
        await markPresentationFailed(timedOut || job);
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

    if ((finished || job).status === "failed") {
      await markPresentationFailed(finished || job);
      return json({ ok: true, job: publicJob(finished || job) });
    }
    // Completed: copy the .pptx into the private bucket and register it as the project's first version.
    return json({ ok: true, job: await jobView(admin, finished || job) });
  }

  /* ------------------------------- download ------------------------------- */
  // Short-lived Signed URL for one saved version (the latest saved one when version_id is omitted).
  if (action === "download") {
    const projectId = String(body?.project_id || "");
    if (!UUID.test(projectId)) return json({ error: "INVALID_PROJECT_ID" }, 400);
    let query = admin.from("presentation_versions").select("*").eq("project_id", projectId).eq("owner_id", user.id);
    if (body?.version_id) {
      const versionId = String(body.version_id);
      if (!UUID.test(versionId)) return json({ error: "INVALID_VERSION_ID" }, 400);
      query = query.eq("id", versionId);
    }
    const { data: rows } = await query.order("updated_at", { ascending: false }).limit(1);
    const version = rows?.[0];
    if (!version) return json({ error: "VERSION_NOT_FOUND" }, 404);
    const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(version.storage_path, SIGNED_URL_TTL_S);
    if (signError || !signed?.signedUrl) {
      console.error("[eyad-presentation] sign failed", signError?.message);
      return json({ error: "FILE_UNAVAILABLE" }, 404);
    }
    return json({ ok: true, url: signed.signedUrl, expires_in: SIGNED_URL_TTL_S, version: publicVersion(version) });
  }

  /* ------------------------------- save_init ------------------------------- */
  // Step 1 of saving an edited deck: validate, then hand out a Signed UPLOAD URL for a brand-new object.
  if (action === "save_init") {
    const mode = String(body?.mode || "new");
    if (mode !== "new" && mode !== "replace") return json({ error: "INVALID_MODE" }, 400);
    const size = Number(body?.size || 0);
    if (!Number.isFinite(size) || size <= 0) return json({ error: "EMPTY_FILE" }, 400);
    if (size > MAX_PPTX_BYTES) return json({ error: "FILE_TOO_LARGE" }, 413);

    let projectId: string;
    let newProject = false;
    if (body?.project_id) {
      projectId = String(body.project_id);
      if (!UUID.test(projectId)) return json({ error: "INVALID_PROJECT_ID" }, 400);
      const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
    } else {
      // A deck that is not in Projects yet (e.g. a template): the project is created when the upload is committed.
      if (mode === "replace") return json({ error: "NOTHING_TO_REPLACE" }, 400);
      projectId = crypto.randomUUID();
      newProject = true;
    }

    if (mode === "replace") {
      const replaceId = String(body?.replace_version_id || "");
      if (!UUID.test(replaceId)) return json({ error: "INVALID_VERSION_ID" }, 400);
      const { data: target } = await admin.from("presentation_versions").select("id")
        .eq("id", replaceId).eq("project_id", projectId).eq("owner_id", user.id).maybeSingle();
      if (!target) return json({ error: "VERSION_NOT_FOUND" }, 404);
    } else if (!newProject) {
      const { count } = await admin.from("presentation_versions").select("id", { count: "exact", head: true })
        .eq("project_id", projectId).eq("owner_id", user.id);
      if ((count || 0) >= MAX_VERSIONS_PER_PROJECT) return json({ error: "TOO_MANY_VERSIONS" }, 409);
    }

    const versionId = crypto.randomUUID();
    const path = storagePathFor(user.id, projectId, versionId);
    const { data: upload, error: uploadError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (uploadError || !upload?.token) {
      console.error("[eyad-presentation] signed upload failed", uploadError?.message);
      return json({ error: "UPLOAD_NOT_AVAILABLE" }, 500);
    }
    return json({ ok: true, project_id: projectId, version_id: versionId, path, token: upload.token, new_project: newProject });
  }

  /* ------------------------------- save_commit ------------------------------- */
  // Step 2: the browser uploaded the file; verify it really is in our bucket, then register / replace the version.
  if (action === "save_commit") {
    const mode = String(body?.mode || "new");
    if (mode !== "new" && mode !== "replace") return json({ error: "INVALID_MODE" }, 400);
    const projectId = String(body?.project_id || "");
    const fileId = String(body?.version_id || "");
    if (!UUID.test(projectId)) return json({ error: "INVALID_PROJECT_ID" }, 400);
    if (!UUID.test(fileId)) return json({ error: "INVALID_VERSION_ID" }, 400);

    // A retried commit (lost response) returns the version that was already registered.
    const { data: already } = await admin.from("presentation_versions").select("*").eq("id", fileId).eq("owner_id", user.id).maybeSingle();
    if (already) return json({ ok: true, project_id: projectId, version: publicVersion(already), reused: true });

    const path = storagePathFor(user.id, projectId, fileId); // always rebuilt here, never taken from the browser
    const { data: listed } = await admin.storage.from(BUCKET).list(`${user.id}/${projectId}`, { search: `${fileId}.pptx`, limit: 5 });
    const object = (listed || []).find((f: any) => f.name === `${fileId}.pptx`);
    if (!object) return json({ error: "UPLOAD_NOT_FOUND" }, 404);
    const size = Number(object.metadata?.size || 0);
    if (size <= 0 || size > MAX_PPTX_BYTES) {
      await admin.storage.from(BUCKET).remove([path]);
      return json({ error: "FILE_INVALID" }, 400);
    }
    // The file must really be a .pptx (ZIP): check its first bytes through a short-lived signed URL.
    const { data: probe } = await admin.storage.from(BUCKET).createSignedUrl(path, 60);
    if (probe?.signedUrl) {
      try {
        const head = await fetch(probe.signedUrl, { headers: { Range: "bytes=0-3" } });
        if (head.ok && !(await isPptxStart(head))) {
          await admin.storage.from(BUCKET).remove([path]);
          return json({ error: "FILE_INVALID" }, 400);
        }
      } catch { /* best effort */ }
    }

    const fileName = `${titleFrom(String(body?.file_name || ""), "Presentation")}.pptx`;
    const now = new Date().toISOString();

    if (body?.new_project) {
      const name = titleFrom(String(body?.file_name || ""), "Presentation");
      const { error: createError } = await admin.from("projects").insert({
        id: projectId, owner_id: user.id, name, studio_type: "presentations", status: "completed", language: "ar",
        metadata: { project_data: { last_studio_id: "presentations" } },
      });
      if (createError) {
        console.error("[eyad-presentation] project create (save) failed", createError.code);
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: createError.code === "23505" ? "PROJECT_EXISTS" : "PROJECT_CREATE_FAILED" }, createError.code === "23505" ? 409 : 500);
      }
    } else {
      const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      if (!project) { await admin.storage.from(BUCKET).remove([path]); return json({ error: "PROJECT_NOT_FOUND" }, 404); }
    }

    let saved: any = null;
    if (mode === "replace") {
      const replaceId = String(body?.replace_version_id || "");
      if (!UUID.test(replaceId)) { await admin.storage.from(BUCKET).remove([path]); return json({ error: "INVALID_VERSION_ID" }, 400); }
      const { data: target } = await admin.from("presentation_versions").select("*")
        .eq("id", replaceId).eq("project_id", projectId).eq("owner_id", user.id).maybeSingle();
      if (!target) { await admin.storage.from(BUCKET).remove([path]); return json({ error: "VERSION_NOT_FOUND" }, 404); }
      const { data: updated, error: updateError } = await admin.from("presentation_versions")
        .update({ storage_path: path, size_bytes: size, file_name: fileName, updated_at: now })
        .eq("id", replaceId).eq("owner_id", user.id).select("*").single();
      if (updateError || !updated) {
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: "VERSION_UPDATE_FAILED" }, 500);
      }
      if (target.storage_path && target.storage_path !== path) await admin.storage.from(BUCKET).remove([target.storage_path]);
      saved = updated;
    } else {
      const { data: inserted, error: insertError } = await insertVersion(admin, {
        id: fileId, owner_id: user.id, project_id: projectId, source: "user", label: null,
        file_name: fileName, storage_path: path, size_bytes: size, job_id: null,
      });
      if (insertError || !inserted) {
        console.error("[eyad-presentation] version insert (save) failed", insertError?.code);
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: "VERSION_CREATE_FAILED" }, 500);
      }
      saved = inserted;
    }

    await patchProjectPresentation(admin, user.id, projectId, {
      status: "ready", latest_version_id: saved.id, latest_version_no: saved.version_no, file_name: saved.file_name, pptx_error: null,
    }, { status: "completed" });
    return json({ ok: true, project_id: projectId, version: publicVersion(saved) });
  }

  return json({ error: "UNKNOWN_ACTION" }, 400);
});

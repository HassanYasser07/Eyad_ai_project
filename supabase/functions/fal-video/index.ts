import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL_CONFIG: Record<string, { text: string; image: string; ratios: string[]; durations: number[]; maxImages: number }> = {
  "minimax-h3-turbo": {
    text: "minimax/h3-max-turbo/text-to-video",
    image: "minimax/h3-max-turbo/reference-to-video",
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    durations: [5, 6, 8, 10, 12, 15], maxImages: 5,
  },
  "kling-2.5": {
    text: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    image: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    ratios: ["16:9", "9:16", "1:1"], durations: [5, 10], maxImages: 1,
  },
  "seedance-2.0": {
    text: "bytedance/seedance-2.0/text-to-video",
    image: "bytedance/seedance-2.0/reference-to-video",
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], maxImages: 5,
  },
};

// Resolve the Fal API key from the runtime environment. Secret *display* names in the
// Supabase dashboard are the runtime env-var names, but we also tolerate case/punctuation
// variants (e.g. "Fal-API-key") by scanning the environment. Values are never logged or returned.
const FAL_ENV_NAMES = ["FAL_KEY", "FAL_API_KEY", "Fal-API-key"];
const normalizeEnvName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const ACCEPTED_FAL_NAMES = new Set(["falkey", "falapikey"]);

function resolveFalKey() {
  const presence: Record<string, boolean> = {};
  let key = "";
  for (const name of FAL_ENV_NAMES) {
    let value: string | undefined;
    try { value = Deno.env.get(name); } catch { value = undefined; }
    const present = typeof value === "string" && value.trim().length > 0;
    presence[name] = present;
    if (!key && present) key = (value as string).trim();
  }
  let falLikeNames: string[] = [];
  try {
    const all = Deno.env.toObject();
    falLikeNames = Object.keys(all).filter((n) => normalizeEnvName(n).includes("fal"));
    if (!key) {
      for (const n of falLikeNames) {
        const v = all[n];
        if (ACCEPTED_FAL_NAMES.has(normalizeEnvName(n)) && typeof v === "string" && v.trim()) { key = v.trim(); break; }
      }
    }
  } catch { /* env enumeration not permitted */ }
  return { key, presence, falLikeNames };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const { key: falKey, presence: falEnvPresence, falLikeNames } = resolveFalKey();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!falKey) {
    // Names only (never values) so the logs show what the runtime actually exposes.
    console.error("FAL_KEY_NOT_CONFIGURED", { expected_present: falEnvPresence, fal_like_env_names: falLikeNames });
    return json({ error: "FAL_KEY_NOT_CONFIGURED", diagnostics: { expected_present: falEnvPresence, fal_like_env_count: falLikeNames.length } }, 500);
  }
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: "BACKEND_CONFIG_ERROR" }, 500);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user || userData.user.is_anonymous) return json({ error: "AUTH_LOGIN_REQUIRED" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const modelId = String(body?.model || "");
  const config = MODEL_CONFIG[modelId];
  if (!config) return json({ error: "UNSUPPORTED_MODEL" }, 400);
  const action = String(body?.action || "");

  if (action === "submit") {
    const prompt = String(body?.prompt || "").trim();
    const duration = Number(body?.duration);
    const aspect = String(body?.aspect_ratio || "");
    const images = Array.isArray(body?.image_urls) ? body.image_urls.filter((url: unknown) => typeof url === "string" && /^https:\/\//i.test(url)) : [];
    if (!prompt) return json({ error: "PROMPT_REQUIRED" }, 400);
    if (prompt.length > 4000) return json({ error: "PROMPT_TOO_LONG" }, 400);
    if (!config.durations.includes(duration)) return json({ error: "UNSUPPORTED_DURATION" }, 400);
    if (!config.ratios.includes(aspect)) return json({ error: "UNSUPPORTED_ASPECT_RATIO" }, 400);
    if (images.length > config.maxImages || images.length > 5) return json({ error: "TOO_MANY_REFERENCE_IMAGES" }, 400);

    let endpoint = images.length ? config.image : config.text;
    let input: Record<string, unknown> = { prompt, duration, aspect_ratio: aspect };
    if (modelId === "minimax-h3-turbo") {
      input = { ...input, resolution: "768P", prompt_expansion_mode: "balanced", enable_safety_checker: true };
      if (images.length) input.reference_image_urls = images;
    } else if (modelId === "kling-2.5") {
      input = { ...input, negative_prompt: "blur, distort, low quality", cfg_scale: 0.5 };
      if (images.length) input.image_url = images[0];
    } else if (modelId === "seedance-2.0") {
      input = { ...input, resolution: "720p", generate_audio: true };
      if (images.length) {
        input.image_urls = images;
        input.prompt = `${prompt}\nUse the supplied reference images in order: ${images.map((_, i) => `@Image${i + 1}`).join(", ")}.`;
      }
    }

    const submitResponse = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: "POST", headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    const submitData = await submitResponse.json().catch(() => ({}));
    if (!submitResponse.ok) {
      console.error("FAL_VIDEO_SUBMIT_FAILED", submitResponse.status, submitData);
      return json({ error: submitData?.detail || submitData?.message || "FAL_SUBMIT_FAILED" }, 502);
    }
    return json({ ok: true, model_path: endpoint, has_images: images.length > 0, request_id: submitData.request_id, status: "IN_QUEUE" });
  }

  if (action === "status") {
    const requestId = String(body?.request_id || "");
    const endpoint = String(body?.model_path || "");
    if (![config.text, config.image].includes(endpoint)) return json({ error: "INVALID_MODEL_ENDPOINT" }, 400);
    if (!requestId || !/^[a-zA-Z0-9_-]{8,120}$/.test(requestId)) return json({ error: "INVALID_REQUEST_ID" }, 400);
    const statusResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${encodeURIComponent(requestId)}/status`, { headers: { Authorization: `Key ${falKey}` } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return json({ error: statusData?.detail || "FAL_STATUS_FAILED" }, 502);
    if (statusData.status !== "COMPLETED") return json({ status: statusData.status || "IN_PROGRESS" });
    const resultResponse = await fetch(`https://queue.fal.run/${endpoint}/requests/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Key ${falKey}` } });
    const result = await resultResponse.json().catch(() => ({}));
    if (!resultResponse.ok) return json({ error: result?.detail || "FAL_RESULT_FAILED" }, 502);
    return json({ status: "COMPLETED", result });
  }
  return json({ error: "UNKNOWN_ACTION" }, 400);
});

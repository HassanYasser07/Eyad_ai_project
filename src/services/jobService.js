import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase";
import { clearGenerationRequestForJob } from "@/services/idempotency";

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}

const POLL_TIMEOUT_MS = 25000;

async function currentSession() {
  let { data } = await supabase.auth.getSession();
  if (!data?.session?.access_token) {
    try { ({ data } = await supabase.auth.refreshSession()); } catch { /* offline */ }
  }
  return data?.session || null;
}

export const jobService = {
  /**
   * Structured poll used by the background generation provider.
   * Never throws: returns { httpStatus, data } or { networkError: true } so the caller can
   * tell a definitive server answer from a transport hiccup.
   */
  async pollGenerationDetailed(jobId) {
    try {
      const session = await currentSession();
      if (!session?.access_token) return { networkError: true };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(`${SUPABASE_URL}/functions/v1/eyad-engine`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message: "poll", action: "poll_generation", job_id: jobId, language: "ar" }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      let data = null;
      try { data = await response.json(); } catch { /* non JSON (gateway page): treated as transient by the classifier */ }
      if (response.ok && data && ["generated", "completed", "failed"].includes(data.status)) clearGenerationRequestForJob(jobId);
      if (data?.error === "JOB_FAILED") clearGenerationRequestForJob(jobId);
      return { httpStatus: response.status, data };
    } catch {
      return { networkError: true };
    }
  },

  async byRequestKey(requestKey) {
    if (!requestKey) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return null;
    const { data, error } = await supabase.from("eyad_jobs").select("id,status,project_id,conversation_id,message_id,request_key")
      .eq("owner_id", userId).eq("request_key", requestKey).maybeSingle();
    if (error) return null;
    return data || null;
  },

  async activeForUser() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return [];
    const { data, error } = await supabase.from("eyad_jobs").select("id,status,project_id,request_key,payload,created_at")
      .eq("owner_id", userId).in("status", ["queued", "processing"])
      .order("created_at", { ascending: false }).limit(20);
    if (error) return [];
    return data || [];
  },

  async pollGeneration(jobId) {
    const user = await requireUser();
    let { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      const { data: anonymousData } = await supabase.auth.signInAnonymously();
      accessToken = anonymousData?.session?.access_token || null;
    }
    if (!accessToken) return null;

    const { data, error } = await supabase.functions.invoke("eyad-engine", {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        message: "poll",
        action: "poll_generation",
        job_id: jobId,
        language: "ar",
      },
    });
    if (error) {
      const { data: currentJob } = await supabase.from("eyad_jobs").select("id,status")
        .eq("id", jobId).eq("owner_id", user.id).maybeSingle();
      if (["completed", "failed"].includes(currentJob?.status)) clearGenerationRequestForJob(jobId);
      return null;
    }
    if (["generated", "completed", "failed"].includes(data?.status)) clearGenerationRequestForJob(jobId);
    return data;
  },

  async get(id) {
    const user = await requireUser();
    const { data, error } = await supabase.from("eyad_jobs").select("*")
      .eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async activeForProject(projectId) {
    const user = await requireUser();
    const { data, error } = await supabase.from("eyad_jobs").select("*")
      .eq("project_id", projectId).eq("owner_id", user.id)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async latestForProject(projectId) {
    const user = await requireUser();
    const { data, error } = await supabase.from("eyad_jobs").select("*")
      .eq("project_id", projectId).eq("owner_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async latestForUser() {
    const user = await requireUser();
    const { data, error } = await supabase.from("eyad_jobs").select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  },
};

export default jobService;

import { supabase } from "@/lib/supabase";
import { clearGenerationRequestForJob } from "@/services/idempotency";

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}

export const jobService = {
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

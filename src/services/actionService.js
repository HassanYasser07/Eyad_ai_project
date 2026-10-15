import { supabase } from "@/lib/supabase";

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}

export const actionService = {
  async create({ projectId = null, actionType, payload = {}, status = "queued" }) {
    const user = await currentUser();
    const { data, error } = await supabase.from("actions").insert({
      owner_id: user.id,
      project_id: projectId,
      action_type: actionType,
      payload,
      status,
    }).select("*").single();
    if (error) throw error;
    return data;
  },

  async update(id, patch = {}) {
    const user = await currentUser();
    const { data, error } = await supabase.from("actions").update(patch)
      .eq("id", id).eq("owner_id", user.id).select("*").single();
    if (error) throw error;
    return data;
  },

  async list(projectId, limit = 50) {
    const user = await currentUser();
    const query = supabase.from("actions").select("*").eq("owner_id", user.id)
      .order("created_at", { ascending: false }).limit(limit);
    if (projectId) query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
};

export default actionService;

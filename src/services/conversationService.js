import { supabase } from "@/lib/supabase";

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}

export const conversationService = {
  async getActive(projectId) {
    const user = await currentUser();
    const { data, error } = await supabase.from("conversations").select("*")
      .eq("owner_id", user.id).eq("project_id", projectId).eq("status", "active")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async getOrCreate(projectId, context = {}) {
    const user = await currentUser();
    const { data: existing, error: readError } = await supabase.from("conversations")
      .select("*").eq("owner_id", user.id).eq("project_id", projectId)
      .eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (readError) throw readError;
    if (existing) return existing;

    const { data, error } = await supabase.from("conversations").insert({
      owner_id: user.id,
      project_id: projectId,
      title: context.title || "EYAD AI",
      context,
      status: "active",
    }).select("*").single();
    if (error) throw error;
    return data;
  },

  async addMessage(conversationId, message) {
    const user = await currentUser();
    const { data, error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      owner_id: user.id,
      role: message.role,
      content: message.content ?? null,
      parts: message.parts || [],
      model: message.model ?? null,
      input_tokens: message.input_tokens ?? null,
      output_tokens: message.output_tokens ?? null,
      credit_cost: message.credit_cost ?? 0,
      metadata: message.metadata || {},
    }).select("*").single();
    if (error) throw error;
    return data;
  },

  async listMessages(conversationId, limit = 100) {
    const user = await currentUser();
    const { data, error } = await supabase.from("messages").select("*")
      .eq("conversation_id", conversationId).eq("owner_id", user.id)
      .order("created_at", { ascending: true }).limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default conversationService;

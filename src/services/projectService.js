/**
 * EYAD Studio — Supabase project data service.
 * Supabase is the source of truth for project lifecycle data.
 */
import { supabase } from "@/lib/supabase";

const toRow = (data = {}, ownerId) => ({
  owner_id: ownerId,
  name: data.title || data.name || "Untitled project",
  description: data.description ?? null,
  studio_type: data.studio_type || data.studioType || null,
  status: data.status || "draft",
  language: data.language || "ar",
  metadata: {
    ...(data.metadata || {}),
    project_data: data.project_data || data.projectData || data.data || {},
  },
});

const fromRow = (row) => ({
  id: row.id,
  title: row.name,
  studio_type: row.studio_type || row.metadata?.studio_type || null,
  status: row.status || "draft",
  project_data: {
    ...(row.metadata?.project_data || {}),
    latest_asset_id: row.metadata?.latest_asset_id || row.metadata?.project_data?.latest_asset_id || null,
    latest_asset_url: row.metadata?.latest_asset_url || row.metadata?.project_data?.latest_asset_url || null,
    latest_generation_id: row.metadata?.latest_generation_id || row.metadata?.project_data?.latest_generation_id || null,
    last_studio_id: row.metadata?.last_studio_id || row.metadata?.project_data?.last_studio_id || null,
    current_handoff: row.metadata?.current_handoff || row.metadata?.project_data?.current_handoff || null,
    logo_brief: row.metadata?.logo_brief || row.metadata?.project_data?.logo_brief || null,
    intelligence_context: row.metadata?.intelligence_context || row.metadata?.project_data?.intelligence_context || null,
    latest_asset_id: row.metadata?.latest_asset_id || row.metadata?.project_data?.latest_asset_id || null,
    latest_asset_url: row.metadata?.latest_asset_url || row.metadata?.project_data?.latest_asset_url || null,
    latest_generation_id: row.metadata?.latest_generation_id || row.metadata?.project_data?.latest_generation_id || null,
    approved_asset: row.metadata?.approved_asset || row.metadata?.project_data?.approved_asset || null,
    assets: row.metadata?.assets || row.metadata?.project_data?.assets || [],
  },
  created_by_id: row.owner_id,
  created_date: row.created_at,
  updated_date: row.updated_at,
  description: row.description,
  language: row.language,
});

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}

export const projectService = {
  async list(limit = 20) {
    const user = await requireUser();
    const { data, error } = await supabase.from("projects").select("*")
      .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(fromRow);
  },

  // Lightweight list for the Chat History drawer. Sorted by most recent
  // activity (updated_at desc) and enriched with the last message preview
  // from each project's active conversation.
  async listForHistory(limit = 30) {
    const user = await requireUser();
    const { data: projects, error } = await supabase.from("projects").select("*")
      .eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(limit);
    if (error) throw error;
    if (!projects?.length) return [];

    const projectIds = projects.map((p) => p.id);
    const { data: conversations } = await supabase.from("conversations")
      .select("id,project_id,title").eq("owner_id", user.id)
      .in("project_id", projectIds).eq("status", "active")
      .order("updated_at", { ascending: false });

    const conversationIds = (conversations || []).map((c) => c.id);
    let messagesByConversation = {};
    if (conversationIds.length) {
      const { data: messages } = await supabase.from("messages")
        .select("conversation_id,content,role,created_at").eq("owner_id", user.id)
        .in("conversation_id", conversationIds).order("created_at", { ascending: false });
      for (const msg of (messages || [])) {
        if (!messagesByConversation[msg.conversation_id]) {
          messagesByConversation[msg.conversation_id] = msg;
        }
      }
    }

    const conversationByProject = {};
    for (const conv of (conversations || [])) {
      if (!conversationByProject[conv.project_id]) conversationByProject[conv.project_id] = conv;
    }

    return projects.map((row) => {
      const conv = conversationByProject[row.id];
      const lastMsg = conv ? messagesByConversation[conv.id] : null;
      return {
        ...fromRow(row),
        conversationTitle: conv?.title || null,
        lastMessagePreview: lastMsg?.content
          ? String(lastMsg.content).replace(/\s+/g, " ").trim().slice(0, 80)
          : null,
        lastActivity: row.updated_at || row.created_at,
      };
    });
  },

  async get(id) {
    const user = await requireUser();
    const { data: row, error } = await supabase.from("projects").select("*")
      .eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    return row ? fromRow(row) : null;
  },

  async create(data = {}) {
    const user = await requireUser();
    const { data: row, error } = await supabase.from("projects").insert(toRow(data, user.id)).select("*").single();
    if (error) throw error;
    return fromRow(row);
  },

  async update(id, data = {}) {
    const user = await requireUser();
    const { data: current, error: readError } = await supabase.from("projects")
      .select("metadata,studio_type").eq("id", id).eq("owner_id", user.id).single();
    if (readError) throw readError;

    const payload = {};
    if (data.title !== undefined || data.name !== undefined) payload.name = data.title ?? data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.status !== undefined) payload.status = data.status;
    if (data.language !== undefined) payload.language = data.language;
    if (data.studio_type !== undefined || data.studioType !== undefined) {
      payload.studio_type = data.studio_type ?? data.studioType;
    }
    if (data.project_data !== undefined || data.projectData !== undefined || data.data !== undefined || data.metadata !== undefined) {
      payload.metadata = {
        ...(current?.metadata || {}),
        ...(data.metadata || {}),
        project_data: data.project_data ?? data.projectData ?? data.data ?? current?.metadata?.project_data ?? {},
      };
    }

    const { data: row, error } = await supabase.from("projects").update(payload)
      .eq("id", id).eq("owner_id", user.id).select("*").single();
    if (error) throw error;
    return fromRow(row);
  },

  async setStatus(id, status) {
    return this.update(id, { status });
  },

  async remove(id) {
    const user = await requireUser();
    const { error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
    if (error) throw error;
    return { id };
  },
};

export default projectService;
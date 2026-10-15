import { supabase } from "@/lib/supabase";

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}

export const assetService = {
  async get(id) {
    const user = await requireUser();
    const { data, error } = await supabase.from("assets").select("*")
      .eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const url = data.storage_path
      ? supabase.storage.from("eyad-assets").getPublicUrl(data.storage_path).data.publicUrl
      : data.metadata?.asset_url || null;
    return { ...data, url };
  },

  async selectAsset(projectId, assetId, messageId = null) {
    const user = await requireUser();
    if (!projectId || !assetId) throw new Error("ASSET_SELECTION_REQUIRED");

    const { data: asset, error: assetError } = await supabase.from("assets").select("*")
      .eq("id", assetId).eq("project_id", projectId).eq("owner_id", user.id).maybeSingle();
    if (assetError) throw assetError;
    if (!asset) throw new Error("ASSET_NOT_FOUND");

    const url = asset.storage_path
      ? supabase.storage.from("eyad-assets").getPublicUrl(asset.storage_path).data.publicUrl
      : asset.metadata?.asset_url || null;

    const { data: project } = await supabase.from("projects").select("metadata")
      .eq("id", projectId).eq("owner_id", user.id).maybeSingle();

    const nextProjectMetadata = {
      ...(project?.metadata || {}),
      latest_asset_id: asset.id,
      latest_asset_name: asset.name || null,
      latest_asset_url: url,
      selected_asset_id: asset.id,
    };

    const { error: projectError } = await supabase.from("projects").update({
      metadata: nextProjectMetadata,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId).eq("owner_id", user.id);
    if (projectError) throw projectError;

    if (messageId) {
      const { data: message } = await supabase.from("messages").select("metadata")
        .eq("id", messageId).eq("owner_id", user.id).maybeSingle();
      const nextMetadata = {
        ...(message?.metadata || {}),
        selected_asset_id: asset.id,
        selected_asset_url: url,
      };
      const { error: messageError } = await supabase.from("messages").update({
        metadata: nextMetadata,
      }).eq("id", messageId).eq("owner_id", user.id);
      if (messageError) throw messageError;
    }

    return { ...asset, url };
  },

  async uploadLogo({ projectId, file }) {
    const user = await requireUser();
    if (!projectId || !file) throw new Error("LOGO_UPLOAD_REQUIRED");
    const id = crypto.randomUUID();
    const safeName = (file.name || "uploaded-logo").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = user.id + "/" + projectId + "/logos/" + id + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("eyad-assets").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("eyad-assets").getPublicUrl(path);
    const url = publicData.publicUrl;
    const { data: asset, error } = await supabase.from("assets").insert({
      id,
      owner_id: user.id,
      project_id: projectId,
      kind: "logo",
      name: safeName,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      metadata: { source: "visual-identity-upload", asset_url: url },
    }).select("*").single();
    if (error) {
      await supabase.storage.from("eyad-assets").remove([path]);
      throw error;
    }
    const { data: project } = await supabase.from("projects").select("metadata").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
    const currentProjectData = project?.metadata?.project_data || {};
    const nextProjectData = {
      ...currentProjectData,
      brand_identity: {
        ...(currentProjectData.brand_identity || {}),
        logo: { asset_id: id, url, name: safeName },
      },
      approved_asset_id: id,
      latest_asset_id: id,
      latest_asset_url: url,
    };
    const nextMetadata = { ...(project?.metadata || {}), project_data: nextProjectData, latest_asset_id: id, latest_asset_url: url };
    const { error: projectError } = await supabase.from("projects").update({ metadata: nextMetadata, updated_at: new Date().toISOString() }).eq("id", projectId).eq("owner_id", user.id);
    if (projectError) throw projectError;
    return { ...asset, url };
  },

  async uploadImageAsset({ projectId, file, name = "mockup.png", metadata = {} }) {
    const user = await requireUser();
    if (!projectId || !file) throw new Error("IMAGE_ASSET_UPLOAD_REQUIRED");
    const id = crypto.randomUUID();
    const safeName = String(name || "mockup.png").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${projectId}/mockups/${id}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("eyad-assets").upload(path, file, {
      contentType: file.type || "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("eyad-assets").getPublicUrl(path);
    const url = publicData.publicUrl;
    const { data: asset, error } = await supabase.from("assets").insert({
      id,
      owner_id: user.id,
      project_id: projectId,
      kind: "image",
      name: safeName,
      storage_path: path,
      mime_type: file.type || "image/png",
      size_bytes: file.size || null,
      metadata: { source: "visual-identity-mockup", asset_url: url, ...metadata },
    }).select("*").single();
    if (error) {
      await supabase.storage.from("eyad-assets").remove([path]);
      throw error;
    }
    return { ...asset, url };
  },

  async createImageVersion({ projectId, sourceAssetId, blob, width, height, metadata = {} }) {
    const user = await requireUser();
    const id = crypto.randomUUID();
    const path = `${user.id}/${projectId || "unassigned"}/${id}.png`;

    const { error: uploadError } = await supabase.storage.from("eyad-assets").upload(path, blob, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from("eyad-assets").getPublicUrl(path);
    const url = publicData.publicUrl;

    const { data: asset, error } = await supabase.from("assets").insert({
      id,
      owner_id: user.id,
      project_id: projectId || null,
      kind: "logo",
      name: `logo-version-${id.slice(0, 8)}.png`,
      storage_path: path,
      mime_type: "image/png",
      size_bytes: blob.size,
      width: width || null,
      height: height || null,
      metadata: {
        source: "logo-studio",
        source_asset_id: sourceAssetId || null,
        asset_url: url,
        ...metadata,
      },
    }).select("*").single();

    if (error) {
      await supabase.storage.from("eyad-assets").remove([path]);
      throw error;
    }

    if (projectId) {
      const { data: project } = await supabase.from("projects").select("metadata")
        .eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      await supabase.from("projects").update({
        metadata: {
          ...(project?.metadata || {}),
          latest_asset_id: id,
          latest_asset_url: url,
          last_studio_id: "logo",
        },
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("owner_id", user.id);
    }

    return { ...asset, url };
  },
};

export default assetService;

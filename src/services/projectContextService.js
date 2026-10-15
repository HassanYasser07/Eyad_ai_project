/**
 * EYAD — Unified Creative Project Context
 * One handoff contract shared by every Studio.
 */
import { projectService } from "@/services/projectService";
import { getBrandIdentity } from "@/services/brandService";

export const STUDIO_NEXT_ACTIONS = {
  logo: ["brand-kit", "presentations"],
  "brand-kit": ["templates", "ai-images", "company-profile", "presentations"],
  templates: ["ai-images", "video", "presentations", "company-profile"],
  "ai-images": ["templates", "video", "brand-kit"],
  video: ["templates", "presentations", "ai-images"],
  presentations: ["company-profile", "templates", "brand-kit"],
  "company-profile": ["presentations", "templates", "brand-kit"],
  marketplace: ["templates", "ai-images", "brand-kit"],
};

export async function getProjectContext(projectId) {
  if (!projectId) return null;
  const project = await projectService.get(projectId);
  if (!project) return null;
  const pd = project.project_data || {};
  const brand = await getBrandIdentity(projectId);
  return {
    projectId,
    project,
    brand,
    business: pd.business_info || pd.mockup_business_info || {},
    lastStudioId: pd.last_studio_id || null,
    latestAsset: {
      id: pd.latest_asset_id || null,
      url: pd.latest_asset_url || null,
      generationId: pd.latest_generation_id || null,
    },
    approvedAsset: pd.approved_asset || null,
    currentHandoff: pd.current_handoff || null,
    assets: pd.assets || [],
  };
}

export async function setStudioHandoff(projectId, { fromStudio, toStudio, asset = null, intent = null, metadata = {} } = {}) {
  if (!projectId) throw new Error("PROJECT_ID_REQUIRED");
  const current = await projectService.get(projectId);
  const pd = current?.project_data || {};
  const handoff = {
    from_studio: fromStudio || pd.last_studio_id || null,
    to_studio: toStudio || null,
    asset: asset || null,
    intent: intent || null,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  };
  await projectService.update(projectId, {
    project_data: {
      ...pd,
      last_studio_id: fromStudio || pd.last_studio_id || null,
      current_handoff: handoff,
    },
  });
  return handoff;
}

export async function saveStudioOutput(projectId, { studioId, asset, approved = false, metadata = {} } = {}) {
  if (!projectId) throw new Error("PROJECT_ID_REQUIRED");
  const current = await projectService.get(projectId);
  const pd = current?.project_data || {};
  const assetRecord = {
    ...(asset || {}),
    studio_id: studioId || null,
    approved: Boolean(approved),
    created_at: new Date().toISOString(),
    metadata: metadata || {},
  };
  const assets = Array.isArray(pd.assets) ? pd.assets : [];
  await projectService.update(projectId, {
    project_data: {
      ...pd,
      last_studio_id: studioId || pd.last_studio_id || null,
      latest_asset_id: assetRecord.id || pd.latest_asset_id || null,
      latest_asset_url: assetRecord.url || assetRecord.data_url || pd.latest_asset_url || null,
      latest_generation_id: assetRecord.generation_id || pd.latest_generation_id || null,
      approved_asset: approved ? assetRecord : pd.approved_asset || null,
      assets: [...assets.slice(-49), assetRecord],
    },
  });
  return assetRecord;
}

export function getNextStudioIds(studioId, { completed = false } = {}) {
  const ids = STUDIO_NEXT_ACTIONS[studioId] || [];
  return completed ? ids : ids.slice(0, 4);
}

export function buildStudioHandoffUrl(studioId, projectId, extra = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  params.set("from", extra.from || "");
  if (extra.assetId) params.set("asset", extra.assetId);
  if (extra.intent) params.set("intent", extra.intent);
  return "/studios/" + studioId + "?" + params.toString();
}

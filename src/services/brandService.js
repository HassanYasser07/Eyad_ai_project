/**
 * EYAD AI — Brand Source of Truth service.
 *
 * Every studio reads the approved identity from project_data.brand_identity.
 * This service keeps the persisted shape stable and gives generation services
 * a compact, provider-neutral brand context.
 */
import { projectService } from "@/services/projectService";

export function normalizeBrandIdentity(identity = {}, fallback = {}) {
  const source = identity || {};
  return {
    brand_name: String(source.brand_name || fallback.brand_name || "").trim(),
    logo: source.logo
      ? {
          asset_id: source.logo.asset_id || null,
          url: source.logo.url || null,
          name: source.logo.name || null,
          svg_url: source.logo.svg_url || source.logo.svgUrl || null,
        }
      : null,
    palette: source.palette ? { ...source.palette } : null,
    typography: source.typography
      ? {
          arabic: source.typography.arabic ? { ...source.typography.arabic } : null,
          english: source.typography.english ? { ...source.typography.english } : null,
        }
      : null,
    background: source.background ? { ...source.background } : null,
    updated_at: source.updated_at || null,
  };
}

export async function getBrandIdentity(projectId) {
  if (!projectId) return null;
  const project = await projectService.get(projectId);
  const identity = normalizeBrandIdentity(project?.project_data?.brand_identity, {
    brand_name: project?.project_data?.logo_brief?.name || project?.title || "",
  });
  return identity.brand_name || identity.logo || identity.palette || identity.typography || identity.background
    ? identity
    : null;
}

export async function saveBrandIdentity(projectId, identity) {
  if (!projectId) throw new Error("PROJECT_ID_REQUIRED");
  const current = await projectService.get(projectId);
  const currentProjectData = current?.project_data || {};
  const normalized = normalizeBrandIdentity(identity, {
    brand_name: currentProjectData.logo_brief?.name || current?.title || "",
  });
  await projectService.update(projectId, {
    project_data: {
      ...currentProjectData,
      brand_identity: {
        ...normalized,
        updated_at: new Date().toISOString(),
      },
      mockup_business_info: {
        ...(currentProjectData.mockup_business_info || {}),
        companyName: normalized.brand_name,
      },
    },
  });
  return normalized;
}

export function buildBrandPromptContext(identity) {
  if (!identity) return "";
  const parts = [];
  if (identity.brand_name) parts.push("Brand name: " + identity.brand_name);
  if (identity.palette?.swatches?.length) {
    parts.push("Approved brand palette: " + identity.palette.swatches.filter(Boolean).join(", "));
  }
  if (identity.typography?.english?.family) parts.push("Approved English font: " + identity.typography.english.family);
  if (identity.typography?.arabic?.family) parts.push("Approved Arabic font: " + identity.typography.arabic.family);
  if (identity.background?.name) parts.push("Approved brand background: " + (identity.background.name.en || identity.background.name.ar || identity.background.id || ""));
  if (identity.logo?.url) parts.push("An approved logo reference is available and must be preserved when the studio request uses the brand.");
  return parts.length ? "\\nBRAND SOURCE OF TRUTH:\\n" + parts.join("\\n") : "";
}

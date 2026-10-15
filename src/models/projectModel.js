/**
 * EYAD Studio — Project model helpers.
 * Pure functions; no backend SDK dependencies.
 */

export const PROJECT_STATUSES = ["draft", "in_progress", "completed", "archived"];

export function normalizeProject(raw) {
  if (!raw) return null;

  const metadata = raw.metadata || {};
  return {
    id: raw.id,
    title: raw.title || raw.name || "Untitled project",
    studioType: raw.studio_type || metadata.studio_type || null,
    status: PROJECT_STATUSES.includes(raw.status) ? raw.status : "draft",
    data: raw.project_data || metadata.project_data || metadata || {},
    owner: raw.created_by_id || raw.owner_id,
    createdAt: raw.created_date || raw.created_at,
    updatedAt: raw.updated_date || raw.updated_at,
  };
}

export function createProjectInput({ title, studioType, status = "draft", data = {} }) {
  return {
    title,
    studio_type: studioType,
    status,
    project_data: data,
  };
}

export default { PROJECT_STATUSES, normalizeProject, createProjectInput };

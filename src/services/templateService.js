import { supabase } from "@/lib/supabase";

/**
 * Reads the presentation templates gallery from Supabase.
 * Tables: presentation_template_categories, presentation_templates
 * (supabase/migrations/20261110120000_presentation_templates.sql and
 *  20261111120000_presentation_templates_pptx.sql for the optional pptx_path column).
 * Only the display columns are readable from the browser; the Gamma ids stay server-side.
 */
const CATEGORY_COLUMNS = "id, slug, name_en, name_ar, sort_order";
const BASE_TEMPLATE_COLUMNS = "id, category_id, title_en, title_ar, description_en, description_ar, slide_count, thumbnail_url, accent_colors, sort_order";
const TEMPLATE_COLUMNS = `${BASE_TEMPLATE_COLUMNS}, pptx_path`;
const MAX_TEMPLATES = 500;
const TEMPLATE_BUCKET = "presentation-templates";
const MAX_TEMPLATE_BYTES = 100 * 1024 * 1024;

const selectTemplates = (columns) => supabase.from("presentation_templates").select(columns)
  .eq("is_active", true).order("sort_order", { ascending: true }).limit(MAX_TEMPLATES);

export async function fetchTemplateGallery() {
  const categoriesPromise = supabase.from("presentation_template_categories").select(CATEGORY_COLUMNS)
    .eq("is_active", true).order("sort_order", { ascending: true });
  let templatesResult = await selectTemplates(TEMPLATE_COLUMNS);
  // The pptx_path migration may not have been applied yet: keep the gallery working without it.
  if (templatesResult.error && /pptx_path/i.test(templatesResult.error.message || "")) {
    templatesResult = await selectTemplates(BASE_TEMPLATE_COLUMNS);
  }
  const categoriesResult = await categoriesPromise;
  if (categoriesResult.error) throw categoriesResult.error;
  if (templatesResult.error) throw templatesResult.error;
  return { categories: categoriesResult.data || [], templates: templatesResult.data || [] };
}

const templateFileUrl = (path) => (/^https?:\/\//i.test(path) ? path : supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(path).data.publicUrl);

/** Downloads a template's .pptx and returns { bytes, name } ready for the editor's `initialFile`. */
export async function fetchTemplatePptx(template, title = "") {
  if (!template?.pptx_path) throw new Error("TEMPLATE_HAS_NO_FILE");
  const response = await fetch(templateFileUrl(template.pptx_path));
  if (!response.ok) throw new Error(`TEMPLATE_DOWNLOAD_FAILED_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_TEMPLATE_BYTES) throw new Error("TEMPLATE_FILE_INVALID");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("TEMPLATE_FILE_INVALID"); // .pptx is a ZIP ("PK")
  const base = String(title || template.title_en || "template").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim().slice(0, 80) || "template";
  return { bytes, name: `${base}.pptx` };
}

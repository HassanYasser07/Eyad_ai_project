import { supabase } from "@/lib/supabase";
import projectService from "@/services/projectService";
import { getStudioById } from "@/studios/studioRegistry";

const ROUTES = [
  { studio: "logo", patterns: [/\b(logo|شعار|لوجو|لوجو الشركة|علامة تجارية)\b/i] },
  { studio: "brand-kit", patterns: [/\b(brand|identity|هوية|هوية بصرية|براند)\b/i] },
  { studio: "company-profile", patterns: [/\b(company profile|profile|بروفايل|بروفايل شركة|ملف الشركة)\b/i] },
  { studio: "ai-images", patterns: [/\b(image|images|photo|picture|صورة|صور|تصميم صورة)\b/i] },
  { studio: "video", patterns: [/\b(video|فيديو|ريل|reel|motion)\b/i] },
  { studio: "presentations", patterns: [/\b(presentation|presentations|عرض تقديمي|برزنتيشن|باوربوينت|pptx)\b/i] },
  { studio: "marketplace", patterns: [/\b(marketplace|سوق|متجر|بيع|شراء)\b/i] },
];

function normalize(text = "") {
  return String(text).trim().replace(/\s+/g, " ");
}

export function detectStudio(text = "") {
  const input = normalize(text);
  for (const route of ROUTES) {
    if (route.patterns.some((pattern) => pattern.test(input))) return route.studio;
  }
  return null;
}

export function createIntent(text = "") {
  const input = normalize(text);
  const studioId = detectStudio(input);
  const studio = studioId ? getStudioById(studioId) : null;

  return {
    input,
    studioId,
    studio,
    needsClarification: !studioId,
    action: studioId ? "create" : "clarify",
  };
}

export async function createProjectFromIntent(text, options = {}) {
  const intent = createIntent(text);
  if (!intent.studioId) {
    return { ok: false, intent, reason: "STUDIO_NOT_DETECTED" };
  }

  const title =
    options.title ||
    intent.input.slice(0, 80) ||
    intent.studio?.name?.en ||
    "Untitled project";

  const project = await projectService.create({
    title,
    description: intent.input,
    studio_type: intent.studioId,
    language: options.language || "ar",
    project_data: {
      source: "eyad-core",
      initial_prompt: intent.input,
      intent: {
        studio_id: intent.studioId,
        action: intent.action,
      },
    },
  });

  return { ok: true, intent, project };
}

export async function getProjectContext(projectId) {
  const project = await projectService.get(projectId);
  if (!project) return null;

  const [{ data: conversation }, { data: assets }, { data: generations }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,title,context,status,created_at,updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assets")
      .select("id,kind,name,storage_path,mime_type,size_bytes,width,height,metadata,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("generations")
      .select("id,studio_type,provider,model,prompt,input,output,status,error,credit_cost,created_at,completed_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    project,
    conversation: conversation || null,
    assets: assets || [],
    generations: generations || [],
  };
}

/**
 * EYAD AI — Creative Action Registry
 *
 * The chat is the command center. Every generated asset exposes the same
 * action contract so the user can continue the workflow without hunting
 * through the app.
 */

export function getCreativeActions(studioId, language = "ar") {
  const ar = language !== "en";

  const actions = [
    {
      id: "open_studio",
      label: ar ? "فتح في الاستوديو" : "Open in Studio",
      icon: "Wand2",
      kind: "route",
      studioId: studioId || "ai-images",
    },
    {
      id: "visual_identity",
      label: ar ? "الانتقال إلى الهوية البصرية" : "Move to Visual Identity",
      icon: "Palette",
      kind: "route",
      studioId: "brand-kit",
    },
    {
      id: "ai_images",
      label: ar ? "فتح في ستوديو الصور" : "Open in AI Images",
      icon: "Image",
      kind: "route",
      studioId: "ai-images",
    },
    {
      id: "presentation",
      label: ar ? "تحويل إلى عرض تقديمي" : "Turn into Presentation",
      icon: "Presentation",
      kind: "route",
      studioId: "presentations",
    },
    {
      id: "regenerate",
      label: ar ? "إنشاء نسخة أخرى" : "Generate Another Version",
      icon: "RefreshCw",
      kind: "command",
      command: ar ? "اعمل نسخة أخرى من التصميم بنفس الفكرة" : "Create another version of this design with the same idea",
    },
    {
      id: "download",
      label: ar ? "تنزيل" : "Download",
      icon: "Download",
      kind: "download",
    },
  ];

  return actions;
}

export default getCreativeActions;

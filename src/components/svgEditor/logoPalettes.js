/**
 * Curated palettes for LOGOS.
 *
 * A logo rarely needs more than a few colors, so every palette has just four values:
 *   [ background, primary, secondary, accent ]
 *
 *   background – the artboard color (light or dark)
 *   primary    – the dominant brand color: main shapes and wordmark
 *   secondary  – the supporting color
 *   accent     – the highlight, used sparingly
 *
 * `applyLogoPalette()` (svgDocument.js) maps the logo's own colors onto these by dominance, so the
 * structure of the logo is preserved and its most-used color always becomes the primary one.
 */
export const LOGO_PALETTES = [
  // ── Light backgrounds ──
  { id: "royal-navy", name: "Royal Navy", colors: ["#FFFFFF", "#0F2C59", "#2563EB", "#F59E0B"] },
  { id: "fresh-mint", name: "Fresh Mint", colors: ["#F7FCFA", "#0B5D4B", "#19A98C", "#F6C453"] },
  { id: "coral-studio", name: "Coral Studio", colors: ["#FFFFFF", "#1F2A44", "#FF6B5E", "#FFC857"] },
  { id: "graphite-gold", name: "Graphite & Gold", colors: ["#FAFAF7", "#1C1C1E", "#6B6B70", "#C9A227"] },
  { id: "emerald-trust", name: "Emerald Trust", colors: ["#FFFFFF", "#064E3B", "#10B981", "#F59E0B"] },
  { id: "violet-tech", name: "Violet Tech", colors: ["#FFFFFF", "#3B1D8F", "#7C3AED", "#22D3EE"] },
  { id: "sunset-warm", name: "Sunset Warm", colors: ["#FFF8F1", "#7C2D12", "#EA580C", "#FBBF24"] },
  { id: "berry-bold", name: "Berry Bold", colors: ["#FFF7FA", "#6B0F3A", "#D6336C", "#F59F00"] },
  { id: "ocean-teal", name: "Ocean Teal", colors: ["#F4FBFC", "#0B3C49", "#0E8FA3", "#F2B134"] },
  { id: "forest-craft", name: "Forest Craft", colors: ["#F8F6EF", "#1F3D2B", "#4D7C4F", "#D98E32"] },
  { id: "slate-minimal", name: "Slate Minimal", colors: ["#FFFFFF", "#0F172A", "#475569", "#3B82F6"] },
  { id: "crimson-classic", name: "Crimson Classic", colors: ["#FFFFFF", "#7F1D1D", "#DC2626", "#1E293B"] },
  { id: "sky-fresh", name: "Sky Fresh", colors: ["#F5FAFF", "#0C4A6E", "#0EA5E9", "#FB923C"] },
  { id: "lavender-soft", name: "Lavender Soft", colors: ["#FBF9FF", "#4C2A85", "#8B6FD6", "#F4A9C0"] },
  { id: "terracotta-earth", name: "Terracotta Earth", colors: ["#FBF5EE", "#4A2C20", "#B5532F", "#D9A441"] },
  { id: "mono-black", name: "Mono Black", colors: ["#FFFFFF", "#000000", "#404040", "#8A8A8A"] },
  // ── Dark backgrounds ──
  { id: "midnight-neon", name: "Midnight Neon", colors: ["#0B1020", "#FFFFFF", "#38BDF8", "#A78BFA"] },
  { id: "obsidian-gold", name: "Obsidian Gold", colors: ["#111111", "#F5F1E6", "#C9A227", "#8A7A4A"] },
  { id: "deep-forest", name: "Deep Forest", colors: ["#0F2A22", "#F2F7F2", "#3DDC97", "#E9C46A"] },
  { id: "plum-night", name: "Plum Night", colors: ["#1E1233", "#FFFFFF", "#C084FC", "#F9A8D4"] },
  { id: "ink-blue", name: "Ink Blue", colors: ["#0D2137", "#FFFFFF", "#4EA8FF", "#FFB454"] },
  { id: "charcoal-coral", name: "Charcoal Coral", colors: ["#1F2328", "#FFFFFF", "#FF6B5E", "#FFC857"] },
  { id: "burgundy-luxe", name: "Burgundy Luxe", colors: ["#3A0F1F", "#FBEFE6", "#E7B66B", "#C94F6D"] },
  { id: "mono-white", name: "Mono White", colors: ["#000000", "#FFFFFF", "#BDBDBD", "#7A7A7A"] },
];

export const LOGO_PALETTE_NAMES_AR = {
  "royal-navy": "الأزرق الملكي",
  "fresh-mint": "النعناع المنعش",
  "coral-studio": "استوديو المرجان",
  "graphite-gold": "الجرافيت والذهب",
  "emerald-trust": "زمرد الثقة",
  "violet-tech": "بنفسجي تقني",
  "sunset-warm": "غروب دافئ",
  "berry-bold": "توت جريء",
  "ocean-teal": "فيروز المحيط",
  "forest-craft": "حِرفة الغابة",
  "slate-minimal": "أردوازي بسيط",
  "crimson-classic": "قرمزي كلاسيكي",
  "sky-fresh": "سماء منعشة",
  "lavender-soft": "خزامى ناعم",
  "terracotta-earth": "طين التيراكوتا",
  "mono-black": "أحادي أسود",
  "midnight-neon": "نيون منتصف الليل",
  "obsidian-gold": "سبج وذهب",
  "deep-forest": "غابة عميقة",
  "plum-night": "ليل البرقوق",
  "ink-blue": "أزرق الحبر",
  "charcoal-coral": "فحم ومرجان",
  "burgundy-luxe": "عنابي فاخر",
  "mono-white": "أحادي أبيض",
};

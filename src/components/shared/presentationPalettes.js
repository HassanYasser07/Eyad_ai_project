/** Curated 5-color presentation palettes. Color 1 is the canvas background. */
export const PRESENTATION_PALETTES = [
  { id: "ocean-mist", name: "Ocean Mist", colors: ["#F5FAFC", "#123047", "#176B87", "#0F766E", "#B45309"] },
  { id: "warm-editorial", name: "Warm Editorial", colors: ["#FFF7ED", "#7C2D12", "#9A3412", "#166534", "#1D4ED8"] },
  { id: "lavender-paper", name: "Lavender Paper", colors: ["#F7F5FF", "#312E81", "#5B21B6", "#0F766E", "#9F1239"] },
  { id: "sage-studio", name: "Sage Studio", colors: ["#F4F8F1", "#23412D", "#3F6212", "#155E75", "#9A3412"] },
  { id: "rose-modern", name: "Rose Modern", colors: ["#FFF5F7", "#881337", "#9D174D", "#1D4ED8", "#854D0E"] },
  { id: "coastal-sand", name: "Coastal Sand", colors: ["#FFFBEB", "#713F12", "#075985", "#0F766E", "#9F1239"] },
  { id: "blueprint", name: "Blueprint", colors: ["#EFF6FF", "#1E3A8A", "#1D4ED8", "#0F766E", "#9A3412"] },
  { id: "forest-paper", name: "Forest Paper", colors: ["#F0FDF4", "#14532D", "#166534", "#155E75", "#9A3412"] },
  { id: "citrus", name: "Citrus", colors: ["#FAFCEB", "#365314", "#3F6212", "#9A3412", "#075985"] },
  { id: "mono-luxe", name: "Mono Luxe", colors: ["#F8FAFC", "#111827", "#374151", "#6D28D9", "#B45309"] },
  { id: "midnight-ocean", name: "Midnight Ocean", colors: ["#102A43", "#F0F7FF", "#7DD3FC", "#6EE7B7", "#FDE68A"] },
  { id: "plum-night", name: "Plum Night", colors: ["#21152E", "#FFF1F2", "#F9A8D4", "#C4B5FD", "#93C5FD"] },
  { id: "deep-forest", name: "Deep Forest", colors: ["#10251D", "#F0FDF4", "#BEF264", "#67E8F9", "#FDBA74"] },
  { id: "charcoal-coral", name: "Charcoal Coral", colors: ["#202124", "#FAFAFA", "#FDA4AF", "#93C5FD", "#FCD34D"] },
  { id: "indigo-glow", name: "Indigo Glow", colors: ["#171A3B", "#F5F3FF", "#A5B4FC", "#67E8F9", "#F9A8D4"] },
  { id: "emerald-night", name: "Emerald Night", colors: ["#062C2A", "#ECFDF5", "#6EE7B7", "#FDE68A", "#7DD3FC"] },
  { id: "slate-sunset", name: "Slate Sunset", colors: ["#202B3C", "#F8FAFC", "#FDBA74", "#FCA5A5", "#93C5FD"] },
  { id: "burgundy-gold", name: "Burgundy Gold", colors: ["#3A1025", "#FFF7ED", "#FCD34D", "#FDA4AF", "#C4B5FD"] },
  { id: "arctic-night", name: "Arctic Night", colors: ["#0C2438", "#F0F9FF", "#7DD3FC", "#A7F3D0", "#F9A8D4"] },
  { id: "volcanic", name: "Volcanic", colors: ["#241B1B", "#FFF7ED", "#FDBA74", "#FCA5A5", "#FDE68A"] },
];

export function getPalette(id) {
  return PRESENTATION_PALETTES.find((palette) => palette.id === id) || PRESENTATION_PALETTES[0];
}

export function relativeLuminance(hex) {
  const rgb = String(hex || "#FFFFFF").replace("#", "").match(/.{2}/g) || ["FF", "FF", "FF"];
  const [r, g, b] = rgb.map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastText(hex) {
  return relativeLuminance(hex) > 0.179 ? "#111827" : "#FFFFFF";
}

export function paletteForegroundColors(palette) {
  const darkBackground = relativeLuminance(palette.colors[0]) < 0.20;
  return palette.colors.slice(1).map((color) => ({ color, text: contrastText(color), darkBackground }));
}

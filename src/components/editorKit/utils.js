export const COLOR_PRESETS = [
  "#111827", "#334155", "#64748b", "#ffffff", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
];

export function numericValue(value, fallback = 0) {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAngle(value) {
  const angle = numericValue(value, 0);
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

let colorProbe = null;
/** Resolves any CSS color (named, rgb(), hsl(), #rgb) to #rrggbb using the browser's own parser. */
function cssColorToHex(color) {
  if (typeof document === "undefined") return null;
  try {
    colorProbe = colorProbe || document.createElement("canvas").getContext("2d");
    if (!colorProbe) return null;
    colorProbe.fillStyle = "#000001";
    colorProbe.fillStyle = color;
    const first = colorProbe.fillStyle;
    colorProbe.fillStyle = "#000002";
    colorProbe.fillStyle = color;
    if (colorProbe.fillStyle !== first) return null; // the browser rejected the value
    if (/^#[0-9a-f]{6}$/i.test(first)) return first;
    const match = String(first).match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    return match ? `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : null;
  } catch {
    return null;
  }
}

export function normalizeColor(value) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((item) => item + item).join("")}`;
  if (color && !/^(none|transparent|url\()/i.test(color)) {
    const resolved = cssColorToHex(color);
    if (resolved) return resolved;
  }
  return "#000000";
}

/** A comparable identity for a paint value: "none", "url(#id)" or a lower-case #rrggbb. */
export function paintKey(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent") return "none";
  if (raw.startsWith("url(")) return raw.replace(/\s+/g, "");
  return normalizeColor(raw).toLowerCase();
}

/**
 * Derives every value the property controls need from the selected element.
 * Shared by the sidebar and the desktop context bar so both always agree.

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** "RRGGBB" | "#rrggbb" | null → "#rrggbb" (null/empty → fallback). */
export function hexToCss(hex, fallback = "#000000") {
  const raw = String(hex || "").replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toLowerCase()}` : fallback;
}

/** "#rrggbb" → "RRGGBB" (the PPTX model's colour format). */
export function cssToHex(css) {
  return String(css || "").replace(/^#/, "").toUpperCase();
}

export function formatNumber(n, decimals = 1) {
  return Number.isFinite(n) ? String(Number(n.toFixed(decimals))) : "";
}


/**
 * Central color-package definitions for the AI presentation generator.
 *
 * Each package has a stable id, a display name, and EXACTLY four Hex colors.
 * To add / edit / remove a package, change this file only. Nothing else in the
 * UI hard-codes colors.
 *
 * `gammaThemeId` is intentionally NOT stored here. Gamma's public API can only
 * apply colors through a pre-existing theme (`themeId`); the optional mapping
 * from package id -> Gamma theme id lives server-side in the
 * GAMMA_THEME_IDS secret (see supabase/functions/eyad-presentation).
 */
export const COLOR_PACKAGE_SIZE = 4;
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const PRESENTATION_COLOR_PACKAGES = [
  { id: "ocean-blue", name: "Ocean Blue", colors: ["#16324F", "#245C73", "#64B6AC", "#F4F7F5"] },
  { id: "purple-modern", name: "Purple Modern", colors: ["#392F5A", "#6C63FF", "#B8B8FF", "#F7F6FF"] },
  { id: "warm-minimal", name: "Warm Minimal", colors: ["#6B4226", "#B08968", "#DDBEA9", "#FFF8F0"] },
  { id: "forest-green", name: "Forest Green", colors: ["#203D32", "#52796F", "#CAD2C5", "#F6F5EF"] },
  { id: "bold-energy", name: "Bold Energy", colors: ["#182848", "#F26430", "#FFB703", "#F8F9FA"] },
];

export const DEFAULT_COLOR_PACKAGE_ID = "ocean-blue";

export function getColorPackage(id) {
  return PRESENTATION_COLOR_PACKAGES.find((pkg) => pkg.id === id) || null;
}

export function isValidColorPackage(pkg) {
  return Boolean(
    pkg &&
    typeof pkg.id === "string" && pkg.id &&
    typeof pkg.name === "string" && pkg.name &&
    Array.isArray(pkg.colors) &&
    pkg.colors.length === COLOR_PACKAGE_SIZE &&
    pkg.colors.every((color) => HEX_COLOR_PATTERN.test(color))
  );
}

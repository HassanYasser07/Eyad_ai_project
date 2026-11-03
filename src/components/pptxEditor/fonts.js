import { FONT_GROUPS, ensureEditorFonts } from "@/components/svgEditor/svgEditorControls";

/*
 * Fonts of the presentation editor.
 *
 * The list is built from the SVG editor's font groups (src/components/svgEditor/svgEditorControls.jsx), so both editors
 * always offer exactly the same fonts: add a font there and it shows up here too.
 *
 * Differences from the SVG editor, because a .pptx stores a plain family name (<a:latin typeface="...">) and not a CSS stack:
 *   - the stored value is the family name only ("Open Sans"), the generic fallback ("sans-serif") is added when rendering;
 *   - "System UI" is skipped (it is a CSS keyword, not a font name PowerPoint understands);
 *   - the families the editor offered before (Arial, Calibri, Verdana, Georgia, Times New Roman, Courier New) stay first,
 *     so existing decks keep their font and the picker feels familiar.
 */

export { ensureEditorFonts };

const SKIP = new Set(["system-ui"]);
const LEADING_SYSTEM = ["Arial", "Calibri", "Verdana", "Georgia", "Times New Roman", "Courier New"];

const stackParts = (stack) => String(stack).split(",").map((part) => part.trim());
const familyName = (stack) => stackParts(stack)[0].replace(/^['"]|['"]$/g, "");
const genericName = (stack) => stackParts(stack).slice(-1)[0];

const seen = new Set();
const take = (name) => {
  const key = name.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
};

/** [{ id, fonts: ["Arial", ...] }] — same group ids as the SVG editor (labels: `svgEditor.fontGroup.<id>`). */
export const PPTX_FONT_GROUPS = FONT_GROUPS.map((group) => {
  const names = group.fonts
    .filter(([value]) => !SKIP.has(String(value).split(",")[0].trim().toLowerCase()))
    .map(([value]) => familyName(value));
  const ordered = group.id === "system" ? [...LEADING_SYSTEM, ...names] : names;
  return { id: group.id, fonts: ordered.filter(take) };
}).filter((group) => group.fonts.length > 0);

export const PPTX_FONTS = PPTX_FONT_GROUPS.flatMap((group) => group.fonts);

/** family (lower case) -> generic CSS family of the SVG editor's stack ("sans-serif", "serif", "monospace", "cursive"). */
const GENERIC = new Map(
  FONT_GROUPS.flatMap((group) => group.fonts).map(([value]) => [familyName(value).toLowerCase(), genericName(value)]),
);
export const fontGeneric = (name) => GENERIC.get(String(name || "").toLowerCase()) || null;

const KNOWN = new Set(PPTX_FONTS.map((name) => name.toLowerCase()));
export const isKnownFont = (name) => KNOWN.has(String(name || "").toLowerCase());

/**
 * Options for the editor kit's <SelectField>: grouped like the SVG editor's picker. A font that is stored in the file but
 * is not in the list (a theme font such as "Calibri Light") stays selectable as a leading option, so it is never lost.
 */
export function fontSelectOptions(current, t) {
  const groups = PPTX_FONT_GROUPS.map((group) => ({
    label: t?.(`svgEditor.fontGroup.${group.id}`) || group.id,
    options: group.fonts.map((name) => ({ value: name, label: name })),
  }));
  return current && !isKnownFont(current) ? [{ value: current, label: current }, ...groups] : groups;
}

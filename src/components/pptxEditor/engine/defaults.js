/**
 * Starting font sizes for freshly created text. Kept in a dependency-free module so the
 * XML engine (what gets saved) and the canvas preview (what the user sees while typing)
 * always agree on the same numbers.
 */
export const NEW_TEXT_FONT_PT = 32;   // "Add text" box
export const NEW_SHAPE_FONT_PT = 28;  // first text typed into an empty (non-placeholder) shape

/** First text typed into an empty table cell. Wide tables get a smaller start so rows don't balloon. */
export function newCellFontPt(cols) {
  const n = Number(cols) || 0;
  if (n >= 7) return 16;
  if (n >= 5) return 20;
  return 24;
}

import { EMU_PER_PX } from "./engine/slideModel.js";
import { distributeEmu } from "./engine/geometry.js";

/**
 * Single source of truth for "how tall must this text frame be at width W?".
 *
 * The browser's own layout engine is the only reliable text-reflow oracle, so we
 * measure the element's real rendered text subtree: clone it into a hidden probe
 * that lives inside the same `.pptx-el` (inheriting fonts / insets / wrapping),
 * force the probe to the candidate width with `height:auto`, and read back the
 * wrapped content height. This is used by every geometry path (handle drag,
 * inspector fields, commit), so a frame can never be smaller than its text.
 *
 * @param {ParentNode} root  the canvas stage (scopes the lookup away from thumbnails)
 * @param {string} id        element id
 * @param {number} widthEmu  candidate frame width
 * @returns {number|null}    required frame height in EMU, or null when not measurable
 */
export function measureTextFrameHeight(root, id, widthEmu) {
  if (!root || typeof document === "undefined" || !Number.isFinite(widthEmu) || widthEmu <= 0) return null;
  const esc = (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(String(id)) : String(id).replace(/["\\]/g, "\\$&");
  const host = root.querySelector(`.pptx-el[data-id="${esc}"]`);
  const box = host && [...host.children].find((c) => c.classList?.contains("pptx-text"));
  if (!box) return null;
  const probe = box.cloneNode(true);
  probe.classList.remove("is-inline-editing");
  probe.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  Object.assign(probe.style, {
    position: "absolute", inset: "auto", left: "0px", top: "0px", right: "auto", bottom: "auto",
    width: `${widthEmu / EMU_PER_PX}px`, height: "auto", visibility: "hidden", pointerEvents: "none",
  });
  host.appendChild(probe);
  try {
    const content = probe.querySelector(".pptx-text-content");
    if (!content) return null;
    const css = window.getComputedStyle(probe);
    const pad = (Number.parseFloat(css.paddingTop) || 0) + (Number.parseFloat(css.paddingBottom) || 0);
    const natural = Math.max(content.scrollHeight, content.offsetHeight);
    if (!Number.isFinite(natural) || natural <= 0) return null;
    // +1px matches the live typing measurement so both paths agree exactly.
    return Math.ceil((natural + pad + 1) * EMU_PER_PX);
  } finally {
    probe.remove();
  }
}

/** Elements whose frame is derived from their text (not tables, groups, pictures, lines, empty boxes). */
export function isTextFitElement(el) {
  if (!el || el.kind === "table" || el.kind === "group" || el.kind === "image" || el.kind === "chart") return false;
  if (el.geom?.kind === "line") return false;
  return !!el.text && !el.text.isEmpty;
}

const esc = (id) => ((typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(String(id)) : String(id).replace(/["\\]/g, "\\$&"));

/**
 * Natural (content-driven) height of every table row, in EMU, when the columns are `colsEmu`.
 * The live <table> is cloned into an off-screen, un-transformed probe, its columns are forced to
 * the candidate widths and every row height is released, so the browser reports exactly how tall
 * each row must be for its re-wrapped cell text.
 */
export function measureTableRowHeights(root, id, colsEmu) {
  if (!root || typeof document === "undefined" || !colsEmu?.length) return null;
  const table = root.querySelector(`.pptx-el[data-id="${esc(id)}"] table.pptx-table`);
  if (!table) return null;
  const probe = table.cloneNode(true);
  probe.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  const total = colsEmu.reduce((a, b) => a + b, 0) / EMU_PER_PX;
  probe.style.width = `${total}px`; probe.style.height = "auto";
  [...probe.querySelectorAll("col")].forEach((c, i) => { c.style.width = `${(colsEmu[i] ?? 0) / EMU_PER_PX}px`; });
  [...probe.querySelectorAll("tr")].forEach((tr) => { tr.style.height = "0px"; });
  const stage = document.createElement("div");
  stage.className = "pptx-slide";
  Object.assign(stage.style, { position: "fixed", left: "-100000px", top: "0px", width: "auto", height: "auto", overflow: "visible", visibility: "hidden", pointerEvents: "none" });
  stage.appendChild(probe);
  document.body.appendChild(stage);
  try {
    return [...probe.querySelectorAll("tr")].map((tr) => Math.ceil(tr.getBoundingClientRect().height * EMU_PER_PX));
  } finally {
    stage.remove();
  }
}

/**
 * Fit a frame of width `w` / requested height `h` to its content. Returns the geometry the frame
 * must really have ({ h, tableGrid? }) or null if the element is not content-driven.
 *  - text frames: never shorter than the re-wrapped text
 *  - tables: columns scale with the width, rows scale with the height but never drop below
 *    the height their wrapped cell text needs; the frame height is the sum of the rows
 */
export function fitFrame(root, el, w, h) {
  if (el?.kind === "table" && el.table?.cols?.length && el.table.rows?.length) {
    const cols = distributeEmu(el.table.cols, Math.round(w));
    const natural = measureTableRowHeights(root, el.id, cols);
    if (!natural || natural.length !== el.table.rows.length) return null;
    const scaled = distributeEmu(el.table.rows.map((r) => r.h), Math.round(h));
    const rows = scaled.map((v, i) => Math.max(v, natural[i]));
    return { h: rows.reduce((a, b) => a + b, 0), tableGrid: { cols, rows } };
  }
  if (!isTextFitElement(el)) return null;
  const need = measureTextFrameHeight(root, el.id, w);
  return need == null ? null : { h: Math.max(h, need) };
}

/** Rows grown to fit their current content at the current column widths (e.g. after typing in a cell). */
export function fitTableToContent(root, el) {
  if (el?.kind !== "table" || !el.table) return null;
  const cols = el.table.cols.slice();
  const natural = measureTableRowHeights(root, el.id, cols);
  if (!natural || natural.length !== el.table.rows.length) return null;
  const rows = el.table.rows.map((r, i) => Math.max(r.h, natural[i]));
  const h = rows.reduce((a, b) => a + b, 0);
  return rows.some((v, i) => v !== el.table.rows[i].h) ? { w: cols.reduce((a, b) => a + b, 0), h, tableGrid: { cols, rows } } : null;
}

/**
 * Grid for a table whose column widths / row heights were set by the user (border drag).
 * Rows never go below the height their wrapped text needs at the given column widths, so shrinking a
 * column grows the affected rows and shrinking a row stops at its content. Returns null when the
 * table cannot be measured; callers then use the requested grid as is.
 */
export function fitTableGrid(root, el, cols, rows, knownNatural) {
  if (el?.kind !== "table") return null;
  // `knownNatural` lets a drag reuse a measurement it already has (e.g. row drags never change the columns),
  // so the table is not cloned and re-laid-out on every pointer move.
  const natural = knownNatural || measureTableRowHeights(root, el.id, cols);
  if (!natural || natural.length !== rows.length) return null;
  const fitted = rows.map((h, i) => Math.max(h, natural[i]));
  return { w: cols.reduce((a, b) => a + b, 0), h: fitted.reduce((a, b) => a + b, 0), tableGrid: { cols: cols.slice(), rows: fitted } };
}

const FIT_TOLERANCE = 2 * EMU_PER_PX;

/**
 * Geometry changes that make each element's frame match its rendered content after a formatting change
 * (letter spacing, line spacing, size, font, wrapping...). Only height (and, for centred / bottom anchored
 * text boxes, the matching y so the text stays where it was) is touched; x, width, rotation and every other
 * element stay as they are.
 *  - plain text boxes follow their text in both directions (same rule as typing)
 *  - shapes / placeholders only grow when their text no longer fits
 *  - tables grow rows that no longer fit their text
 * @returns {Array<object>} changes shaped like setBounds input ({id,x,y,w,h,rot,flipH,flipV,tableGrid?})
 */
export function fitContentChanges(root, model, ids) {
  if (!root || !model?.elements || !ids?.length) return [];
  const out = [];
  for (const id of ids) {
    const el = model.elements.find((x) => x.id === id);
    if (!el || el.hidden || el.readOnlyGeometry) continue;
    const b = { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot, flipH: el.flipH, flipV: el.flipV };
    if (el.kind === "table") {
      const fit = fitTableToContent(root, el);
      if (fit) out.push({ id, ...b, ...fit });
      continue;
    }
    if (!isTextFitElement(el)) continue;
    const need = measureTextFrameHeight(root, id, el.w);
    if (need == null) continue;
    const follows = el.kind === "text" && !el.ph;
    const limit = Math.max(1, (model.size?.h || el.y + el.h) - el.y);
    let h = follows ? need : Math.max(el.h, need);
    h = Math.min(Math.max(limit, 1), Math.ceil(h));
    if (!follows && h <= el.h) continue;
    if (Math.abs(h - el.h) <= FIT_TOLERANCE) continue;
    const anchor = el.text?.body?.anchor;
    let y = el.y;
    if (follows && !el.rot && (anchor === "ctr" || anchor === "b")) {
      const delta = el.h - h;
      y = Math.round(el.y + (anchor === "ctr" ? delta / 2 : delta));
    }
    out.push({ id, ...b, y, h });
  }
  return out;
}

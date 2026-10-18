/** Pure geometry helpers (EMU units). No DOM, no XML — unit-testable. */
export function rotatedBox(b) {
  const th = ((b.rot || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(th)), sin = Math.abs(Math.sin(th));
  const w = b.w * cos + b.h * sin, h = b.w * sin + b.h * cos;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
export function unionBox(boxes) {
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Point in a rotated rectangle (used for hit testing, not DOM). */
export function hitTest(b, px, py, pad = 0) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, th = (-(b.rot || 0) * Math.PI) / 180;
  const dx = px - cx, dy = py - cy;
  const lx = dx * Math.cos(th) - dy * Math.sin(th), ly = dx * Math.sin(th) + dy * Math.cos(th);
  return Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad;
}
/** items: [{id, box:{x,y,w,h}}] axis-aligned boxes; ref: box to align to. Returns {id: {dx, dy}}. */
export function computeAlign(items, mode, ref) {
  const out = {};
  for (const { id, box } of items) {
    let dx = 0, dy = 0;
    if (mode === "left") dx = ref.x - box.x;
    else if (mode === "center") dx = ref.x + ref.w / 2 - (box.x + box.w / 2);
    else if (mode === "right") dx = ref.x + ref.w - (box.x + box.w);
    else if (mode === "top") dy = ref.y - box.y;
    else if (mode === "middle") dy = ref.y + ref.h / 2 - (box.y + box.h / 2);
    else if (mode === "bottom") dy = ref.y + ref.h - (box.y + box.h);
    out[id] = { dx, dy };
  }
  return out;
}
export function computeDistribute(items, axis) {
  if (items.length < 3) return {};
  const key = axis === "h" ? "x" : "y", size = axis === "h" ? "w" : "h";
  const sorted = [...items].sort((a, b) => a.box[key] - b.box[key]);
  const first = sorted[0].box, last = sorted[sorted.length - 1].box;
  const total = last[key] + last[size] - first[key];
  const used = sorted.reduce((s, i) => s + i.box[size], 0);
  const gap = (total - used) / (sorted.length - 1);
  const out = {};
  let cursor = first[key] + first[size] + gap;
  for (let i = 1; i < sorted.length - 1; i++) {
    out[sorted[i].id] = axis === "h" ? { dx: cursor - sorted[i].box.x, dy: 0 } : { dx: 0, dy: cursor - sorted[i].box.y };
    cursor += sorted[i].box[size] + gap;
  }
  return out;
}
/**
 * Snap a moving box to guides. candidates: {xs:[], ys:[]} in EMU. Returns the
 * adjusted delta plus the guide lines that engaged.
 */
export function snapBox(box, candidates, threshold) {
  const xs = [box.x, box.x + box.w / 2, box.x + box.w], ys = [box.y, box.y + box.h / 2, box.y + box.h];
  let bestX = null, bestY = null;
  for (const c of candidates.xs) for (const v of xs) { const d = c - v; if (Math.abs(d) <= threshold && (bestX === null || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, at: c }; }
  for (const c of candidates.ys) for (const v of ys) { const d = c - v; if (Math.abs(d) <= threshold && (bestY === null || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, at: c }; }
  return { dx: bestX ? bestX.d : 0, dy: bestY ? bestY.d : 0, guideX: bestX ? bestX.at : null, guideY: bestY ? bestY.at : null };
}

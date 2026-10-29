import React from "react";
import { Copy, RotateCw, Trash2 } from "lucide-react";
import SlideView, { collectImagePaths } from "./SlideView.jsx";
import { useMediaUrls } from "./useMediaUrls.js";
import { EMU_PER_PX } from "./engine/slideModel.js";
import { hitTest, rotatedBox, unionBox, snapBox } from "./engine/geometry.js";
import { fitFrame, fitTableToContent, fitTableGrid } from "./textFit.js";
import TableHandles from "./TableHandles.jsx";

const MIN_SIZE = 91440;
const MIN_COL = 285750; // 30 px: narrowest column a border drag can produce
const MIN_ROW = 190500; // 20 px: shortest row (content may force more)
const GRID = 228600; // 0.25 in
const HANDLES = [["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5], ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5]];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const boundsOf = (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot, flipH: e.flipH, flipV: e.flipV });

const Canvas = React.forwardRef(function Canvas({ pkg, model, selection, onSelect, onSelectionComplete, onInteractionStart, onCommit, onEditText, onTextCommit, onTextCancel, onTableCellSelect, onAutoSizeText, textAutoSizeHeights, editingText, tableSelection, cellToolbar, onTableAdd, onTableSelectAll, onCopy, onDelete, onRotate, multi, grid, locked, labels, onZoom, compact }, ref) {
  const stageRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const [view, setView] = React.useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [draft, setDraft] = React.useState(null);
  const [guides, setGuides] = React.useState(null);
  const [marquee, setMarquee] = React.useState(null);
  const [cellFit, setCellFit] = React.useState(null); // live row/frame growth while typing in a table cell
  const cellToolbarRef = React.useRef(null);
  const [cellPos, setCellPos] = React.useState(null); // screen anchor of the floating cell toolbar
  const [tblDrag, setTblDrag] = React.useState(null); // { kind: "col"|"row", index } while a table border is dragged
  const urls = useMediaUrls(pkg, collectImagePaths(model));

  const W = model.size.w / EMU_PER_PX, H = model.size.h / EMU_PER_PX;
  const PAD = compact ? 10 : 32;
  const fit = Math.max(0.02, Math.min((size.w - PAD * 2) / W, (size.h - PAD * 2) / H));
  const s = fit * view.zoom;
  const ox = (size.w - W * s) / 2 + view.pan.x, oy = (size.h - H * s) / 2 + view.pan.y;

  // Everything the pointer handlers need, kept fresh without re-binding listeners.
  const R = React.useRef({});
  R.current = { s, ox, oy, fit, size, W, H, model, selection, multi, grid, locked, view, onSelect, onSelectionComplete, onInteractionStart, onCommit, onEditText, draft, editingText, tableSelection };
  const pointers = React.useRef(new Map());
  const gesture = React.useRef(null);
  const lastTap = React.useRef({ t: 0, id: null, x: 0, y: 0 });
  const lastPoint = React.useRef(null);
  const lastEmpty = React.useRef({ t: 0, x: 0, y: 0 });

  React.useEffect(() => { onZoom?.(Math.round(view.zoom * 100)); }, [view.zoom, onZoom]);
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const updateSize = () => {
      const r = el.getBoundingClientRect();
      const next = { w: r.width, h: r.height };
      setSize((current) => current.w === next.w && current.h === next.h ? current : next);
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSize) : null;
    ro?.observe(el);
    updateSize();
    return () => ro?.disconnect();
  }, []);
  // Typing in a table cell re-wraps its text: grow the row and the frame live (same measurement as on commit),
  // so the frame always equals the rendered table and every cell stays clickable.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    let raf = 0;
    const onInput = (e) => {
      const td = e.target?.closest?.("td[data-row]");
      if (!td) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const id = td.closest(".pptx-el-table")?.dataset.id;
        const el = R.current.model.elements.find((x) => x.id === id);
        const fit = el ? fitTableToContent(stage, el) : null;
        setCellFit(fit ? { id, h: fit.h, tableGrid: fit.tableGrid } : null);
      });
    };
    stage.addEventListener("input", onInput);
    return () => { cancelAnimationFrame(raf); stage.removeEventListener("input", onInput); };
  }, []);
  React.useEffect(() => { setCellFit(null); }, [model, editingText?.id, editingText?.row, editingText?.col]);
  // Reset view when the slide changes.
  React.useEffect(() => { setView({ zoom: 1, pan: { x: 0, y: 0 } }); }, [model.path]);

  const clampPan = React.useCallback((zoom, pan, sz = R.current.size) => {
    const sc = R.current.fit * zoom;
    const maxX = Math.max(0, (R.current.W * sc) / 2 + sz.w / 2 - 60), maxY = Math.max(0, (R.current.H * sc) / 2 + sz.h / 2 - 60);
    return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) };
  }, []);
  const zoomAt = React.useCallback((factor, cx, cy) => {
    setView((v) => {
      const { fit: f, size: sz, W: w, H: h } = R.current;
      const zoom = clamp(v.zoom * factor, 0.5, 8);
      const s0 = f * v.zoom, s1 = f * zoom;
      const o0x = (sz.w - w * s0) / 2 + v.pan.x, o0y = (sz.h - h * s0) / 2 + v.pan.y;
      const px = (cx - o0x) / s0, py = (cy - o0y) / s0;
      const pan = { x: cx - px * s1 - (sz.w - w * s1) / 2, y: cy - py * s1 - (sz.h - h * s1) / 2 };
      return { zoom, pan: zoom <= 1 ? clampPan(zoom, pan) : clampPan(zoom, pan) };
    });
  }, [clampPan]);

  const toSlide = (cx, cy) => {
    const r = stageRef.current.getBoundingClientRect(), { s: sc, ox: x0, oy: y0 } = R.current;
    return { x: ((cx - r.left - x0) / sc) * EMU_PER_PX, y: ((cy - r.top - y0) / sc) * EMU_PER_PX };
  };
  const stackAt = (pt, touch) => {
    const tol = ((touch ? 10 : 5) / R.current.s) * EMU_PER_PX;
    const out = [];
    const els = R.current.model.elements;
    for (let i = els.length - 1; i >= 0; i--) { const e = els[i]; if (!e.hidden && hitTest(R.current.overrides?.get(e.id) || boundsOf(e), pt.x, pt.y, e.h < 20000 || e.w < 20000 ? tol * 1.5 : 0)) out.push(e); }
    return out;
  };

  // Content-driven geometry for `id` at width `w` / requested height `h` (text frames and tables).
  const fitOf = (id, w, h) => {
    const el = R.current.model.elements.find((x) => x.id === id);
    return el ? fitFrame(stageRef.current, el, w, h) : null;
  };

  React.useImperativeHandle(ref, () => ({
    // Re-flow guard for any geometry commit (handles, inspector fields): a text frame whose
    // size changed can never end up shorter than its wrapped text.
    fitChanges: (changes) => changes.map((c) => {
      const el = R.current.model.elements.find((x) => x.id === c.id);
      if (!el || (c.w === el.w && c.h === el.h) || c.tableGrid) return c; // moves/rotates and pre-fitted drafts pass through
      const fit = fitOf(c.id, c.w, c.h);
      return fit && (fit.h > c.h || fit.tableGrid) ? { ...c, ...fit } : c;
    }),
    // Rows grown to fit freshly typed cell text; null when nothing needs to change.
    fitTable: (id) => { const el = R.current.model.elements.find((x) => x.id === id); return el ? fitTableToContent(stageRef.current, el) : null; },
    zoomBy: (f) => zoomAt(f, R.current.size.w / 2, R.current.size.h / 2),
    fit: () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) setSize((current) => current.w === rect.width && current.h === rect.height ? current : { w: rect.width, h: rect.height });
      setView({ zoom: 1, pan: { x: 0, y: 0 } });
    },
    selectBehind: () => {
      const { selection: sel, model: m } = R.current;
      const cur = m.elements.find((e) => e.id === sel[0]);
      const pt = lastPoint.current || (cur ? { x: cur.x + cur.w / 2, y: cur.y + cur.h / 2 } : null);
      if (!pt) return;
      const stack = stackAt(pt, true);
      if (!stack.length) return;
      const i = stack.findIndex((e) => e.id === sel[0]);
      const next = [stack[(i + 1) % stack.length].id];
      R.current.onSelect(next);
      R.current.onSelectionComplete?.(next);
    },
  }), [zoomAt]);

  // Non-passive listeners: wheel zoom/pan and iOS pinch must be able to preventDefault.
  React.useEffect(() => {
    const el = stageRef.current;
    const wheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else setView((v) => (v.zoom > 1 ? { ...v, pan: clampPan(v.zoom, { x: v.pan.x - e.deltaX, y: v.pan.y - e.deltaY }) } : v));
    };
    const stop = (e) => e.preventDefault();
    el.addEventListener("wheel", wheel, { passive: false });
    for (const t of ["gesturestart", "gesturechange", "gestureend"]) el.addEventListener(t, stop);
    return () => { el.removeEventListener("wheel", wheel); for (const t of ["gesturestart", "gesturechange", "gestureend"]) el.removeEventListener(t, stop); };
  }, [zoomAt, clampPan]);

  const cancelGesture = () => { gesture.current = null; setDraft(null); setGuides(null); setMarquee(null); };

  const snapCandidates = (ids) => {
    const { model: m, grid: g } = R.current;
    const xs = [0, m.size.w / 2, m.size.w], ys = [0, m.size.h / 2, m.size.h];
    for (const e of m.elements) { if (ids.includes(e.id) || e.hidden) continue; const b = rotatedBox(boundsOf(e)); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); }
    return { xs, ys, grid: g?.snap };
  };
  const applySnap = (box, ids, thr) => {
    const c = snapCandidates(ids);
    let r = snapBox(box, c, thr);
    if (c.grid && r.guideX === null) { const near = (v) => Math.round(v / GRID) * GRID; const dx = near(box.x) - box.x; if (Math.abs(dx) <= thr) r = { ...r, dx }; }
    if (c.grid && r.guideY === null) { const near = (v) => Math.round(v / GRID) * GRID; const dy = near(box.y) - box.y; if (Math.abs(dy) <= thr) r = { ...r, dy }; }
    return r;
  };

  const startPinch = () => {
    const pts = [...pointers.current.values()].slice(0, 2);
    const r = stageRef.current.getBoundingClientRect();
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    setDraft(null); setGuides(null); setMarquee(null);
    gesture.current = { type: "pinch", d0: d, zoom0: R.current.view.zoom, pan0: R.current.view.pan, o0: { x: R.current.ox, y: R.current.oy }, s0: R.current.s, c0: { x: (pts[0].x + pts[1].x) / 2 - r.left, y: (pts[0].y + pts[1].y) / 2 - r.top } };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    R.current.onInteractionStart?.();
    stageRef.current.focus?.({ preventScroll: true });
    try { stageRef.current.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.current.size >= 2) { startPinch(); return; }
    const touch = e.pointerType !== "mouse";
    const pt = toSlide(e.clientX, e.clientY);
    lastPoint.current = pt;
    const { selection: sel, multi: multiMode } = R.current;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey || multiMode;
    const stack = stackAt(pt, touch);
    let target = null, tapId = null;
    if (e.button === 1) { gesture.current = { type: "pan", start: { x: e.clientX, y: e.clientY }, pan0: R.current.view.pan }; return; }
    if (e.altKey && stack.length) { const i = stack.findIndex((x) => sel.includes(x.id)); target = stack[(i + 1) % stack.length].id; }
    else if (!additive) {
      // Pressing inside the current selection arms a drag of THAT object (never of what covers it),
      // but a plain tap still selects whatever is visibly on top.
      const inSel = sel.find((id) => stack.some((x) => x.id === id));
      target = inSel ?? stack[0]?.id ?? null;
      if (inSel !== undefined && stack[0] && stack[0].id !== inSel) tapId = stack[0].id;
    } else target = stack[0]?.id ?? null;
    let toggleOff = false, pending = null;
    if (target) {
      // Selection is applied on tap or when a drag begins, never on the first touch, so a pinch that
      // starts on an object cannot change the selection.
      if (additive) { if (sel.includes(target)) toggleOff = true; else pending = [...sel, target]; }
      else if (!sel.includes(target)) pending = [target];
    }
    gesture.current = { type: target ? "press" : "empty", id: target, tapId, pending, start: { x: e.clientX, y: e.clientY }, touch, moved: false, toggleOff, additive, pan0: R.current.view.pan, wasSelected: !!target && sel.includes(target) };
  };

  const startHandle = (e, kind, id) => {
    e.stopPropagation();
    R.current.onInteractionStart?.();
    try { stageRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.current.size >= 2) { startPinch(); return; }
    const el = R.current.model.elements.find((x) => x.id === id);
    gesture.current = { type: "handle", kind, id, start: { x: e.clientX, y: e.clientY }, b0: boundsOf(el), isImage: el.kind === "image", moved: false };
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const g = gesture.current;
    if (!g) return;
    const { s: sc } = R.current;
    if (g.type === "pinch") {
      const pts = [...pointers.current.values()].slice(0, 2);
      if (pts.length < 2) return;
      const r = stageRef.current.getBoundingClientRect();
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const c = { x: (pts[0].x + pts[1].x) / 2 - r.left, y: (pts[0].y + pts[1].y) / 2 - r.top };
      const zoom = clamp(g.zoom0 * (d / g.d0), 0.5, 8), s1 = R.current.fit * zoom;
      const px = (g.c0.x - g.o0.x) / g.s0, py = (g.c0.y - g.o0.y) / g.s0;
      const pan = { x: c.x - px * s1 - (R.current.size.w - R.current.W * s1) / 2, y: c.y - py * s1 - (R.current.size.h - R.current.H * s1) / 2 };
      setView({ zoom, pan: clampPan(zoom, pan) });
      return;
    }
    if (g.type === "pan") { setView((v) => ({ ...v, pan: clampPan(v.zoom, { x: g.pan0.x + e.clientX - g.start.x, y: g.pan0.y + e.clientY - g.start.y }) })); return; }
    const dxs = e.clientX - g.start.x, dys = e.clientY - g.start.y;
    const moved = Math.hypot(dxs, dys) > (g.touch ? 7 : 4);
    if (g.type === "empty") {
      if (!moved && !g.moved) return;
      g.moved = true;
      if (g.touch || R.current.view.zoom > 1 && e.pointerType !== "mouse") setView((v) => ({ ...v, pan: clampPan(v.zoom, { x: g.pan0.x + dxs, y: g.pan0.y + dys }) }));
      else { const r = stageRef.current.getBoundingClientRect(); setMarquee({ x0: g.start.x - r.left, y0: g.start.y - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top }); }
      return;
    }
    if (g.type === "press") {
      if (!moved && !g.moved) return;
      const { selection: cur, model: m, locked: lk } = R.current;
      const sel = g.pending || cur;
      if (!g.moved && g.pending) R.current.onSelect(g.pending);
      const ids = (sel.includes(g.id) ? sel : [g.id]).filter((id) => { const el = m.elements.find((x) => x.id === id); return el && !lk.has(id) && !el.readOnlyGeometry; });
      if (!ids.length) { g.moved = true; return; }
      if (!g.moved) { g.moved = true; g.ids = ids; g.starts = new Map(ids.map((id) => [id, boundsOf(m.elements.find((x) => x.id === id))])); }
      let dx = (dxs / sc) * EMU_PER_PX, dy = (dys / sc) * EMU_PER_PX;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const boxes = [...g.starts.values()].map((b) => rotatedBox({ ...b, x: b.x + dx, y: b.y + dy }));
      const sn = e.altKey ? { dx: 0, dy: 0, guideX: null, guideY: null } : applySnap(unionBox(boxes), ids, (6 / sc) * EMU_PER_PX);
      dx += sn.dx; dy += sn.dy;
      setGuides({ x: sn.guideX, y: sn.guideY });
      setDraft(new Map([...g.starts].map(([id, b]) => [id, { ...b, x: b.x + dx, y: b.y + dy }])));
      return;
    }
    if (g.type === "handle") {
      if (!moved && !g.moved) return;
      g.moved = true;
      const b0 = g.b0, th = (b0.rot * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
      const ex = (dxs / sc) * EMU_PER_PX, ey = (dys / sc) * EMU_PER_PX;
      if (g.kind === "rotate") {
        const r = stageRef.current.getBoundingClientRect(), { ox: x0, oy: y0 } = R.current;
        const cx = r.left + x0 + ((b0.x + b0.w / 2) / EMU_PER_PX) * sc, cy = r.top + y0 + ((b0.y + b0.h / 2) / EMU_PER_PX) * sc;
        let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        deg = ((deg % 360) + 360) % 360;
        const snapped = Math.round(deg / 15) * 15;
        if (e.shiftKey || Math.abs(deg - snapped) < 3) deg = snapped % 360;
        setDraft(new Map([[g.id, { ...b0, rot: deg }]]));
        return;
      }
      const lx = ex * cos + ey * sin, ly = -ex * sin + ey * cos;
      const sx = g.kind.includes("e") ? 1 : g.kind.includes("w") ? -1 : 0, sy = g.kind.includes("s") ? 1 : g.kind.includes("n") ? -1 : 0;
      let w = Math.max(MIN_SIZE, b0.w + sx * lx), h = Math.max(MIN_SIZE, b0.h + sy * ly);
      const corner = sx !== 0 && sy !== 0;
      if (corner && (g.isImage ? !e.shiftKey : e.shiftKey)) { const ratio = b0.w / b0.h; if (Math.abs(w / b0.w - 1) > Math.abs(h / b0.h - 1)) h = w / ratio; else w = h * ratio; }
      // Re-flow: content re-wraps at the new width, so the frame may never be shorter than its
      // content (text) or its rows' content (tables). This gives vertical shrinking a natural floor.
      const fit = fitOf(g.id, w, h);
      let tableGrid;
      if (fit) { h = Math.max(h, fit.h); if (fit.tableGrid) { tableGrid = fit.tableGrid; h = fit.h; } }
      const dw = w - b0.w, dh = h - b0.h;
      // A height forced by text on a width-only handle grows downward (top edge stays put).
      const lcx = (sx * dw) / 2, lcy = ((sy || 1) * dh) / 2;
      const cx = b0.x + b0.w / 2 + lcx * cos - lcy * sin, cy = b0.y + b0.h / 2 + lcx * sin + lcy * cos;
      setDraft(new Map([[g.id, { ...b0, x: cx - w / 2, y: cy - h / 2, w, h, ...(tableGrid ? { tableGrid } : {}) }]]));
    }
  };

  const finish = (e, cancelled) => {
    pointers.current.delete(e.pointerId);
    try { stageRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const g = gesture.current;
    if (g?.type === "pinch") { if (pointers.current.size < 2) gesture.current = { type: "idle" }; if (!pointers.current.size) gesture.current = null; return; }
    if (g?.type === "idle") { if (!pointers.current.size) gesture.current = null; return; }
    if (pointers.current.size) return;
    gesture.current = null;
    const d = R.current.draft;
    setGuides(null);
    if (!g || cancelled) { setDraft(null); setMarquee(null); return; }
    if ((g.type === "press" || g.type === "handle") && g.moved && d) {
      const changes = [...d].map(([id, b]) => ({ id, ...b }));
      R.current.onCommit(changes, g.type === "handle" ? (g.kind === "rotate" ? "Rotate" : "Resize") : "Move");
      setDraft(null);
      if (R.current.selection.length) R.current.onSelectionComplete?.(R.current.selection);
      return;
    }
    setDraft(null);
    if (g.type === "press" && !g.moved) {
      let nextSelection = R.current.selection;
      if (g.toggleOff) {
        nextSelection = R.current.selection.filter((id) => id !== g.id);
        R.current.onSelect(nextSelection);
      }
      const tapped = g.tapId || g.id;
      if (g.tapId) { nextSelection = [g.tapId]; R.current.onSelect(nextSelection); }
      else if (g.pending) { nextSelection = g.pending; R.current.onSelect(nextSelection); }
      // Tapping a table cell puts the caret straight into that cell. A drag never gets here
      // (g.moved), so moving/resizing the table is unaffected.
      const tbl = R.current.model.elements.find((x) => x.id === tapped && x.kind === "table");
      const cellEl = tbl ? document.elementFromPoint(e.clientX, e.clientY)?.closest?.("td[data-row]") : null;
      if (cellEl && !R.current.locked.has(tapped)) {
        const cell = { row: Number(cellEl.dataset.row), col: Number(cellEl.dataset.col) };
        const cur = R.current.editingText;
        if (!(cur?.id === tapped && cur.row === cell.row && cur.col === cell.col)) R.current.onEditText(tapped, cell);
        lastTap.current = { t: 0, id: null, x: 0, y: 0 };
        return;
      }
      const now = Date.now(), lt = lastTap.current;
      const doubleTap = !g.toggleOff && lt.id === tapped && now - lt.t < 380 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 26;
      if (doubleTap) { lastTap.current = { t: 0, id: null, x: 0, y: 0 }; R.current.onEditText(tapped); }
      else {
        lastTap.current = { t: now, id: tapped, x: e.clientX, y: e.clientY };
        if (nextSelection.length) R.current.onSelectionComplete?.(nextSelection);
      }
    } else if (g.type === "empty") {
      if (!g.moved) {
        if (!g.additive) R.current.onSelect([]);
        const now = Date.now(), le = lastEmpty.current, r = stageRef.current.getBoundingClientRect();
        if (now - le.t < 350 && Math.hypot(e.clientX - le.x, e.clientY - le.y) < 30) {
          lastEmpty.current = { t: 0, x: 0, y: 0 };
          const z = R.current.view.zoom;
          if (Math.abs(z - 1) > 0.05) setView({ zoom: 1, pan: { x: 0, y: 0 } });
          else zoomAt(2.5, e.clientX - r.left, e.clientY - r.top);
        } else lastEmpty.current = { t: now, x: e.clientX, y: e.clientY };
      }
      else if (marquee) {
        const r = stageRef.current.getBoundingClientRect(), { ox: x0, oy: y0, s: sc, model: m } = R.current;
        const mx0 = Math.min(marquee.x0, marquee.x1), mx1 = Math.max(marquee.x0, marquee.x1), my0 = Math.min(marquee.y0, marquee.y1), my1 = Math.max(marquee.y0, marquee.y1);
        void r;
        const hit = m.elements.filter((el) => { if (el.hidden) return false; const b = rotatedBox(boundsOf(el)); const sx0 = x0 + (b.x / EMU_PER_PX) * sc, sy0 = y0 + (b.y / EMU_PER_PX) * sc, sx1 = sx0 + (b.w / EMU_PER_PX) * sc, sy1 = sy0 + (b.h / EMU_PER_PX) * sc; return sx0 < mx1 && sx1 > mx0 && sy0 < my1 && sy1 > my0; }).map((el) => el.id);
        R.current.onSelect(hit);
        if (hit.length) R.current.onSelectionComplete?.(hit);
      }
      setMarquee(null);
    }
  };

  const overrides = React.useMemo(() => {
    const combined = new Map(draft || []);
    if (textAutoSizeHeights?.size) {
      for (const element of model.elements) {
        const pendingHeight = textAutoSizeHeights.get(element.id);
        if (!Number.isFinite(pendingHeight) || pendingHeight <= element.h) continue;
        const base = combined.get(element.id) || boundsOf(element);
        if (pendingHeight > base.h) combined.set(element.id, { ...base, h: pendingHeight });
      }
    }
    if (cellFit && !combined.has(cellFit.id)) {
      const element = model.elements.find((item) => item.id === cellFit.id);
      if (element) combined.set(cellFit.id, { ...boundsOf(element), h: cellFit.h, tableGrid: cellFit.tableGrid });
    }
    return combined;
  }, [draft, textAutoSizeHeights, model, cellFit]);
  R.current.overrides = overrides;
  // Float the formatting bar above the picked table cell. Measured from the rendered <td> so it follows
  // zoom, pan, row growth and text edits; it is skipped entirely when no cell is picked (cellToolbar is null).
  const cellKey = cellToolbar && tableSelection ? `${tableSelection.id}:${tableSelection.row}:${tableSelection.col}` : null;
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    let next = null;
    if (cellKey && stage) {
      const hostSel = `.pptx-el-table[data-id="${tableSelection.id}"]`;
      const wholeTable = tableSelection.scope === "table";
      const target = wholeTable ? stage.querySelector(`${hostSel} table`) : stage.querySelector(`${hostSel} td[data-row="${tableSelection.row}"][data-col="${tableSelection.col}"]`);
      const bar = cellToolbarRef.current;
      if (target && bar) {
        const tel = model.elements.find((x) => x.id === tableSelection.id);
        const lastRow = (tel?.table?.rows?.length || 1) - 1;
        // Leave room for the "+" handles that sit just outside the table border.
        const gapAbove = wholeTable || tableSelection.row === 0 ? 38 : 8;
        const gapBelow = wholeTable || tableSelection.row >= lastRow ? 38 : 8;
        const sr = stage.getBoundingClientRect(), cr = target.getBoundingClientRect();
        const barW = Math.min(bar.offsetWidth, sr.width - 16), barH = bar.offsetHeight;
        const cx = cr.left - sr.left + cr.width / 2;
        const left = Math.round(Math.max(8 + barW / 2, Math.min(sr.width - 8 - barW / 2, cx)));
        const above = cr.top - sr.top - barH - gapAbove >= 4;
        const top = Math.round(above ? cr.top - sr.top - gapAbove : cr.bottom - sr.top + gapBelow);
        next = { left, top, above, maxW: Math.max(120, Math.round(sr.width - 16)) };
      }
    }
    setCellPos((cur) => (cur === next || (cur && next && cur.left === next.left && cur.top === next.top && cur.above === next.above && cur.maxW === next.maxW) ? cur : next));
  });
  const sel = model.elements.filter((e) => selection.includes(e.id));
  const frames = sel.map((e) => ({ el: e, b: overrides.get(e.id) || boundsOf(e) }));
  const toScreen = (b) => ({ cx: ox + ((b.x + b.w / 2) / EMU_PER_PX) * s, cy: oy + ((b.y + b.h / 2) / EMU_PER_PX) * s, w: (b.w / EMU_PER_PX) * s, h: (b.h / EMU_PER_PX) * s });
  const single = frames.length === 1 ? frames[0] : null;
  const union = frames.length > 1 ? unionBox(frames.map((f) => rotatedBox(f.b))) : null;
  // Controls around a single, unrotated, editable table.
  const tblSel = single && single.el.kind === "table" && single.el.table?.cols?.length && !locked.has(single.el.id) && !single.el.readOnlyGeometry && !single.b.rot && !single.b.flipH && !single.b.flipV
    ? { el: single.el, b: single.b, cols: single.b.tableGrid?.cols || single.el.table.cols, rows: single.b.tableGrid?.rows || single.el.table.rows.map((r) => r.h) }
    : null;
  R.current.tblSel = tblSel;
  // Drag a column / row border: only that column (or row) changes size, like PowerPoint; the frame grows or
  // shrinks with it. Rows never get shorter than their wrapped text, and the drag previews live via the draft.
  const startTableResize = (e, kind, index) => {
    const t = R.current.tblSel;
    e.stopPropagation();
    if (!t || (e.button !== undefined && e.button > 0)) return;
    const { el, cols, rows } = t, base = boundsOf(el), startX = e.clientX, startY = e.clientY, pointerId = e.pointerId;
    let last = null;
    setTblDrag({ kind, index });
    R.current.onInteractionStart?.();
    const move = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const sc = R.current.s;
      let c = cols.slice(), r = rows.slice();
      if (kind === "col") c[index] = Math.max(MIN_COL, Math.round(cols[index] + ((ev.clientX - startX) / sc) * EMU_PER_PX));
      else r[index] = Math.max(MIN_ROW, Math.round(rows[index] + ((ev.clientY - startY) / sc) * EMU_PER_PX));
      const fit = fitTableGrid(stageRef.current, el, c, r);
      if (fit) { c = fit.tableGrid.cols; r = fit.tableGrid.rows; }
      last = { ...base, w: c.reduce((a, b) => a + b, 0), h: r.reduce((a, b) => a + b, 0), tableGrid: { cols: c, rows: r } };
      setDraft(new Map([[el.id, last]]));
    };
    const end = (ev, cancelled) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setTblDrag(null);
      setDraft(null);
      if (!cancelled && last) R.current.onCommit([{ id: el.id, ...last }], "Resize table cells");
    };
    const up = (ev) => end(ev, false);
    const cancel = (ev) => end(ev, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  const quickActionBox = single ? rotatedBox(single.b) : union;
  const quickActionsEnabled = frames.length > 0 && frames.every(({ el }) => !locked.has(el.id) && !el.readOnlyGeometry);
  const quickActionWidth = 110;
  const stageWidth = stageRef.current?.clientWidth || 0;
  const quickActionRight = quickActionBox ? ox + ((quickActionBox.x + quickActionBox.w) / EMU_PER_PX) * s : 0;
  // Anchor the toolbar above the frame while keeping its full width inside the canvas,
  // including when the selected object sits against the left or right slide edge.
  const quickActionLeft = quickActionBox
    ? Math.max(quickActionWidth + 8, Math.min(quickActionRight, Math.max(quickActionWidth + 8, stageWidth - 8)))
    : 0;

  return (
    <div ref={stageRef} className="pptx-stage" tabIndex={0} role="application" aria-label={labels.canvas}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(e) => finish(e, false)} onPointerCancel={(e) => { cancelGesture(); finish(e, true); }} onContextMenu={(e) => e.preventDefault()}>
      <div className="pptx-holder" style={{ transform: `translate(${ox}px,${oy}px) scale(${s})` }}>
        <SlideView model={model} urls={urls} overrides={overrides} geometryDrafts={draft} hints labels={labels} editingText={editingText} tableSelection={tableSelection}
          onTableCellSelect={onTableCellSelect} onAutoSizeText={onAutoSizeText} onEditText={onEditText} onTextCommit={onTextCommit} onTextCancel={onTextCancel} />
        {grid?.show && <div className="pptx-grid" style={{ backgroundSize: `${GRID / EMU_PER_PX}px ${GRID / EMU_PER_PX}px`, width: W, height: H }} />}
      </div>
      <div className="pptx-overlay" data-testid="pptx-overlay">
        {guides?.x != null && <div className="pptx-guide v" style={{ left: ox + (guides.x / EMU_PER_PX) * s }} />}
        {guides?.y != null && <div className="pptx-guide h" style={{ top: oy + (guides.y / EMU_PER_PX) * s }} />}
        {frames.map(({ el, b }) => {
          const f = toScreen(b), isLocked = locked.has(el.id) || el.readOnlyGeometry;
          return (
            <div key={el.id} className={`pptx-frame ${single ? "single" : "multi"} ${isLocked ? "locked" : ""}`} data-testid="pptx-frame" data-id={el.id}
              style={{ left: f.cx - f.w / 2, top: f.cy - f.h / 2, width: f.w, height: f.h, transform: `rotate(${b.rot || 0}deg)` }}>
              {single && !isLocked && (
                <>
                  {HANDLES.filter(([k]) => !((k === "n" || k === "s") && f.h < 76) && !((k === "e" || k === "w") && f.w < 76)).map(([k, hx, hy]) => (
                    <div key={k} className={`pptx-handle h-${k}`} data-handle={k} style={{ left: `${hx * 100}%`, top: `${hy * 100}%` }} onPointerDown={(e) => startHandle(e, k, el.id)}><i /></div>
                  ))}
                  <div className="pptx-rot-line" />
                  <div className="pptx-handle h-rotate" data-handle="rotate" style={{ left: "50%", top: 0 }} onPointerDown={(e) => startHandle(e, "rotate", el.id)}><i /></div>
                </>
              )}
              {single && isLocked && <span className="pptx-lock-pill">{labels.locked}</span>}
            </div>
          );
        })}
        {quickActionBox && quickActionsEnabled && <div className={`pptx-selection-actions ${cellToolbar ? "is-below" : ""}`} style={{ left: quickActionLeft, top: cellToolbar ? oy + ((quickActionBox.y + quickActionBox.h) / EMU_PER_PX) * s : Math.max(52, oy + (quickActionBox.y / EMU_PER_PX) * s) }} aria-label={labels.selectionActions}>
          <button type="button" title={labels.quickCopy} aria-label={labels.quickCopy} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onCopy?.(); }}><Copy size={15} aria-hidden="true" /></button>
          <button type="button" title={labels.quickRotate} aria-label={labels.quickRotate} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRotate?.(); }}><RotateCw size={15} aria-hidden="true" /></button>
          <button type="button" className="is-danger" title={labels.quickDelete} aria-label={labels.quickDelete} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete?.(); }}><Trash2 size={15} aria-hidden="true" /></button>
        </div>}
        {tblSel && <TableHandles x0={ox + (tblSel.b.x / EMU_PER_PX) * s} y0={oy + (tblSel.b.y / EMU_PER_PX) * s} s={s} cols={tblSel.cols} rows={tblSel.rows}
          canAdd={!tblSel.el.table.hasMerge} drag={tblDrag} selected={tableSelection?.id === tblSel.el.id && tableSelection.picked && tableSelection.scope === "table"} labels={labels}
          onSelectAll={() => onTableSelectAll?.(tblSel.el.id)} onAdd={(kind, boundary) => onTableAdd?.(kind, boundary)} onResizeStart={startTableResize} />}
        {cellToolbar && <div ref={cellToolbarRef} className={`pptx-cell-toolbar ${cellPos && !cellPos.above ? "is-below" : ""}`} role="toolbar" aria-label={labels.cellToolbar}
          style={{ left: cellPos ? cellPos.left : 0, top: cellPos ? cellPos.top : 0, maxWidth: cellPos ? cellPos.maxW : undefined, visibility: cellPos ? "visible" : "hidden" }}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>{cellToolbar}</div>}
        {union && <div className="pptx-union" style={{ left: ox + (union.x / EMU_PER_PX) * s, top: oy + (union.y / EMU_PER_PX) * s, width: (union.w / EMU_PER_PX) * s, height: (union.h / EMU_PER_PX) * s }}><span>{frames.length}</span></div>}
        {marquee && <div className="pptx-marquee" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />}
      </div>
    </div>
  );
});
export default Canvas;

/**
 * Slide editing operations. Each public function runs as ONE undoable
 * transaction and mutates the real slide XML — the canvas is re-derived from
 * it, so edits can never diverge from what gets exported.
 */
import { NS, kid, kids, path, attr, num, create, insertOrdered, ORDER, descendants, textOf, parseXml, serializeXml, PptxError } from "./xml.js";
import { REL } from "./package.js";
import { rotatedBox, unionBox, distributeEmu } from "./geometry.js";

const DRAWABLE = ["sp", "pic", "grpSp", "graphicFrame", "cxnSp", "AlternateContent", "contentPart"];
const R = Math.round;

// ---------- tree helpers ----------
export function treeOf(doc) { return path(doc.documentElement, "cSld", "spTree"); }
function cNvPr(node) {
  return path(node, "nvSpPr", "cNvPr") || path(node, "nvPicPr", "cNvPr") || path(node, "nvGrpSpPr", "cNvPr") || path(node, "nvGraphicFramePr", "cNvPr") || path(node, "nvCxnSpPr", "cNvPr") || descendants(node, "cNvPr")[0] || null;
}
export const idOf = (node) => attr(cNvPr(node), "id", "");
function drawable(tree) { return kids(tree).filter((n) => DRAWABLE.includes(n.localName)); }
/** Top-level objects with unique keys. Files with duplicate shape ids (e.g. PptxGenJS output) get "id~n" keys. */
export function keyedNodes(tree) {
  const seen = new Map();
  return drawable(tree).map((node) => {
    const id = idOf(node), k = seen.get(id) || 0;
    seen.set(id, k + 1);
    return { node, key: k ? `${id}~${k}` : id };
  });
}
const keyOf = (tree, node) => keyedNodes(tree).find((x) => x.node === node)?.key;
function findNode(tree, id) {
  const hit = keyedNodes(tree).find((x) => x.key === String(id));
  if (!hit) throw new PptxError("ELEMENT_MISSING", `Element ${id} not found`);
  return hit.node;
}
function nextId(tree) {
  let max = 1;
  for (const c of descendants(tree, "cNvPr")) max = Math.max(max, num(c, "id", 0));
  return max + 1;
}
function endAnchor(tree) { return kid(tree, "extLst"); }

function xfrmHolder(node) {
  switch (node.localName) {
    case "sp": case "pic": case "cxnSp": return "spPr";
    case "grpSp": return "grpSpPr";
    default: return null;
  }
}
function getXfrm(node) {
  if (node.localName === "graphicFrame") return kid(node, "xfrm");
  return path(node, xfrmHolder(node), "xfrm");
}
/** Write full bounds {x,y,w,h,rot,flipH,flipV} (EMU/deg). Materialises inherited geometry. */
export function writeBounds(doc, node, b) {
  if (node.localName === "AlternateContent") throw new PptxError("READONLY", "This object cannot be moved or resized.");
  let x = getXfrm(node);
  if (!x) {
    if (node.localName === "graphicFrame") {
      x = create(doc, "p", "xfrm");
      const anchor = kid(node, "nvGraphicFramePr");
      node.insertBefore(x, anchor ? anchor.nextSibling : node.firstChild);
    } else {
      const holderName = xfrmHolder(node);
      let holder = kid(node, holderName);
      if (!holder) { holder = create(doc, "p", holderName); const after = kid(node, "nvSpPr", "nvPicPr", "nvGrpSpPr", "nvCxnSpPr"); node.insertBefore(holder, after ? after.nextSibling : node.firstChild); }
      x = create(doc, "a", "xfrm");
      insertOrdered(holder, x, holderName === "spPr" ? ORDER.spPr : ORDER.grpSpPr);
    }
  }
  const set = (name, val) => { if (val) x.setAttribute(name, val); else x.removeAttribute(name); };
  set("rot", b.rot ? String(R(((b.rot % 360) + 360) % 360 * 60000)) : "");
  set("flipH", b.flipH ? "1" : "");
  set("flipV", b.flipV ? "1" : "");
  const sub = (name) => kid(x, name) || x.appendChild(create(doc, "a", name));
  const off = sub("off"), ext = sub("ext");
  if (node.localName === "grpSp" && !kid(x, "chOff")) {
    // Preserve identity mapping before resizing so children scale like PowerPoint.
    const ch1 = create(doc, "a", "chOff", { x: num(off, "x"), y: num(off, "y") });
    const ch2 = create(doc, "a", "chExt", { cx: num(ext, "cx"), cy: num(ext, "cy") });
    x.appendChild(ch1); x.appendChild(ch2);
  }
  off.setAttribute("x", String(R(b.x))); off.setAttribute("y", String(R(b.y)));
  ext.setAttribute("cx", String(Math.max(0, R(b.w)))); ext.setAttribute("cy", String(Math.max(0, R(b.h))));
  // keep schema order: off, ext, chOff, chExt
  for (const name of ["off", "ext", "chOff", "chExt"]) { const e = kid(x, name); if (e) x.appendChild(e); }
}

function mutateSlide(pkg, slidePath, label, fn) {
  return pkg.transact(label, () => {
    const doc = pkg.edit(slidePath);
    const tree = treeOf(doc);
    return fn(doc, tree);
  });
}

// ---------- geometry & structure ----------
export function setBounds(pkg, slidePath, changes, label = "Move") {
  return mutateSlide(pkg, slidePath, label, (doc, tree) => {
    for (const ch of changes) {
      const node = findNode(tree, ch.id);
      // Geometry edits must never rewrite text auto-fit settings. Automatically
      // injecting normAutofit here caused ordinary titles/body text to shrink
      // after a user narrowed a box, instead of wrapping and growing its frame.
      const prev = node.localName === "graphicFrame" ? readBoundsFromNode(node) : null;
      writeBounds(doc, node, ch);
      if (prev) syncTableGrid(node, prev, ch);
    }
  });
}

/**
 * A table frame is only ever the sum of its grid (gridCol widths x row heights). Resizing the
 * frame therefore has to resize the grid too, otherwise the frame and the rendered table
 * diverge (rows keep their old heights while text re-wraps in the new column widths).
 * `ch.tableGrid` ({cols, rows} in EMU) carries the already text-fitted grid from the editor;
 * without it the grid is scaled proportionally, which keeps the file self-consistent.
 */
function syncTableGrid(node, prev, ch) {
  const tbl = path(node, "graphic", "graphicData", "tbl");
  if (!tbl) return;
  const gridCols = kids(kid(tbl, "tblGrid"), "gridCol"), trs = kids(tbl, "tr");
  const g = ch.tableGrid;
  let cols = null, rows = null;
  if (g && g.cols?.length === gridCols.length && g.rows?.length === trs.length) {
    cols = g.cols; rows = g.rows;
  } else {
    if (Math.round(ch.w) !== Math.round(prev.w)) cols = distributeEmu(gridCols.map((c) => num(c, "w")), Math.round(ch.w));
    if (Math.round(ch.h) !== Math.round(prev.h)) rows = distributeEmu(trs.map((r) => num(r, "h")), Math.round(ch.h));
  }
  if (cols) gridCols.forEach((c, i) => c.setAttribute("w", String(Math.round(cols[i]))));
  if (rows) trs.forEach((r, i) => r.setAttribute("h", String(Math.round(rows[i]))));
}

/** Hide/show selected drawing objects using DrawingML's non-visual hidden flag. */
export function setElementsHidden(pkg, slidePath, ids, hidden) {
  return mutateSlide(pkg, slidePath, hidden ? "Hide layer" : "Show layer", (doc, tree) => {
    for (const id of ids) {
      const meta = cNvPr(findNode(tree, id));
      if (!meta) continue;
      if (hidden) meta.setAttribute("hidden", "1");
      else meta.removeAttribute("hidden");
    }
  });
}

function stripTimingFor(doc, ids) {
  const root = doc.documentElement;
  const timing = kid(root, "timing");
  if (!timing) return;
  const hit = descendants(timing, "spTgt").some((t) => ids.has(attr(t, "spid", "")));
  if (hit) root.removeChild(timing);
}
export function deleteElements(pkg, slidePath, ids) {
  return mutateSlide(pkg, slidePath, "Delete", (doc, tree) => {
    const removed = new Set();
    for (const id of ids) {
      const n = findNode(tree, id);
      for (const c of descendants(n, "cNvPr")) removed.add(attr(c, "id", ""));
      tree.removeChild(n);
    }
    stripTimingFor(doc, removed);
  });
}

export function duplicateElements(pkg, slidePath, ids, { dx = 190500, dy = 190500 } = {}) {
  return mutateSlide(pkg, slidePath, "Duplicate", (doc, tree) => {
    const created = [];
    for (const id of ids) {
      const src = findNode(tree, id);
      const clone = src.cloneNode(true);
      renumber(clone, tree);
      const cur = readBoundsFromNode(src);
      tree.insertBefore(clone, endAnchor(tree));
      if (cur) writeBounds(doc, clone, { ...cur, x: cur.x + dx, y: cur.y + dy });
      created.push(keyOf(tree, clone));
    }
    return created;
  });
}
function renumber(node, tree) {
  let id = nextId(tree);
  for (const c of descendants(node, "cNvPr")) c.setAttribute("id", String(id++));
}
export function readBoundsFromNode(node) {
  const x = getXfrm(node);
  if (!x) return null;
  const off = kid(x, "off"), ext = kid(x, "ext");
  return { x: num(off, "x"), y: num(off, "y"), w: num(ext, "cx"), h: num(ext, "cy"), rot: num(x, "rot") / 60000, flipH: attr(x, "flipH") === "1", flipV: attr(x, "flipV") === "1" };
}

export function reorderElements(pkg, slidePath, ids, mode) {
  return mutateSlide(pkg, slidePath, "Arrange", (doc, tree) => {
    const sel = new Set(ids.map(String));
    const keyed = keyedNodes(tree), all = keyed.map((x) => x.node), keyOfNode = new Map(keyed.map((x) => [x.node, x.key]));
    const idOfNode = (n) => keyOfNode.get(n);
    const picked = all.filter((n) => sel.has(idOfNode(n)));
    if (!picked.length) return;
    if (mode === "front") for (const n of picked) tree.insertBefore(n, endAnchor(tree));
    else if (mode === "back") { const first = kid(tree, "grpSpPr"); let ref = first ? first.nextSibling : tree.firstChild; for (const n of picked) tree.insertBefore(n, ref); }
    else if (mode === "forward") {
      for (let i = all.length - 2; i >= 0; i--) if (sel.has(idOfNode(all[i])) && !sel.has(idOfNode(all[i + 1]))) { tree.insertBefore(all[i + 1], all[i]); [all[i], all[i + 1]] = [all[i + 1], all[i]]; }
    } else if (mode === "backward") {
      for (let i = 1; i < all.length; i++) if (sel.has(idOfNode(all[i])) && !sel.has(idOfNode(all[i - 1]))) { tree.insertBefore(all[i], all[i - 1]); [all[i], all[i - 1]] = [all[i - 1], all[i]]; }
    }
  });
}

/** Move one layer to a front-to-back layer index in one undoable transaction. */
export function moveElementToLayer(pkg, slidePath, id, targetLayerIndex) {
  return mutateSlide(pkg, slidePath, "Reorder layer", (doc, tree) => {
    const keyed = keyedNodes(tree);
    if (!keyed.length) return;
    const key = String(id);
    const sourceXmlIndex = keyed.findIndex((item) => item.key === key);
    if (sourceXmlIndex < 0) throw new PptxError("ELEMENT_MISSING", `Layer ${key} is no longer on this slide.`);

    // The Layers panel is front-to-back, while spTree stores objects back-to-front.
    // Reorder using the exact same front-to-back list users see, then write that order
    // back to the XML tree. This is safe with duplicate cNvPr ids because `keyed` uses
    // stable disambiguated keys such as "12~1".
    const frontToBack = [...keyed].reverse();
    const sourceUiIndex = frontToBack.findIndex((item) => item.key === key);
    const rawTarget = Number(targetLayerIndex);
    if (!Number.isFinite(rawTarget)) throw new PptxError("BAD_INDEX", "Invalid layer position.");
    const targetUiIndex = Math.max(0, Math.min(frontToBack.length - 1, Math.trunc(rawTarget)));
    if (sourceUiIndex === targetUiIndex) return;

    const [moving] = frontToBack.splice(sourceUiIndex, 1);
    frontToBack.splice(targetUiIndex, 0, moving);
    const xmlOrder = [...frontToBack].reverse();
    const anchor = endAnchor(tree);
    // Move only drawable nodes, preserving spTree metadata and extension nodes.
    for (const item of xmlOrder) tree.insertBefore(item.node, anchor);
  });
}

// ---------- text ----------
function txBodyOf(node, cell) {
  if (node.localName === "graphicFrame") {
    const tbl = path(node, "graphic", "graphicData", "tbl");
    const tr = kids(tbl, "tr")[cell?.row ?? 0];
    const tc = kids(tr, "tc")[cell?.col ?? 0];
    return tc ? kid(tc, "txBody") : null;
  }
  return kid(node, "txBody");
}
const RUN_TAGS = ["r", "fld", "br"];
function segmentsOf(p) {
  return kids(p, ...RUN_TAGS).map((n) => ({ node: n, text: n.localName === "br" ? "\u2028" : textOf(kid(n, "t")) }));
}
function setRunText(run, text) {
  let t = kid(run, "t");
  if (!t) { t = create(run.ownerDocument, "a", "t"); run.appendChild(t); }
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(run.ownerDocument.createTextNode(text));
}
function newRunLike(doc, like, text) {
  const run = create(doc, "a", "r");
  const rPr = like && kid(like, "rPr");
  if (rPr) run.appendChild(rPr.cloneNode(true));
  const t = create(doc, "a", "t");
  t.appendChild(doc.createTextNode(text));
  run.appendChild(t);
  return run;
}
function newBreakLike(doc, like) {
  const br = create(doc, "a", "br");
  const rPr = like && kid(like, "rPr");
  if (rPr) br.appendChild(rPr.cloneNode(true));
  return br;
}
/** Replace one paragraph's text with a minimal edit so run formatting survives. */
function editParagraph(doc, p, next) {
  const segs = segmentsOf(p);
  const old = segs.map((s) => s.text).join("");
  if (old === next) return;
  let pre = 0;
  const max = Math.min(old.length, next.length);
  while (pre < max && old[pre] === next[pre]) pre++;
  let suf = 0;
  while (suf < max - pre && old[old.length - 1 - suf] === next[next.length - 1 - suf]) suf++;
  const delFrom = pre, delTo = old.length - suf;
  const ins = next.slice(pre, next.length - suf);

  // 1. delete [delFrom, delTo)
  let pos = 0;
  for (const s of segs) {
    const start = pos, end = pos + s.text.length;
    pos = end;
    const a = Math.max(delFrom, start), b = Math.min(delTo, end);
    if (a >= b) continue;
    if (s.node.localName === "br") { p.removeChild(s.node); s.removed = true; continue; }
    const remaining = s.text.slice(0, a - start) + s.text.slice(b - start);
    s.text = remaining;
    setRunText(s.node, remaining);
  }
  if (!ins) { cleanupEmptyRuns(p); return; }

  // 2. insert at `pre` into the run that ends there (typing semantics), else the one containing it
  const live = segs.filter((s) => !s.removed);
  let acc = 0, target = null, offset = 0;
  const lens = live.map((s) => s.text.length);
  // positions in the post-deletion text
  for (let i = 0; i < live.length; i++) {
    const s = live[i];
    if (s.node.localName === "br") { acc += lens[i]; continue; }
    if (acc <= pre && pre <= acc + lens[i]) { target = s; offset = pre - acc; if (pre < acc + lens[i]) break; }
    acc += lens[i];
  }
  if (!target) {
    const lastRun = [...live].reverse().find((s) => s.node.localName !== "br");
    target = lastRun || null;
    offset = target ? target.text.length : 0;
    if (!target) {
      const end = kid(p, "endParaRPr");
      const like = end ? (() => { const r = create(doc, "a", "r"); const rp = end.cloneNode(true); const renamed = create(doc, "a", "rPr"); for (const at of Array.from(rp.attributes)) renamed.setAttribute(at.name, at.value); for (const ch of kids(rp)) renamed.appendChild(ch); r.appendChild(renamed); return r; })() : null;
      const pieces0 = ins.split("\u2028");
      let ref = end || null;
      pieces0.forEach((piece, i) => {
        if (i > 0) p.insertBefore(newBreakLike(doc, like), ref);
        if (piece) p.insertBefore(newRunLike(doc, like, piece), ref);
      });
      return;
    }
  }
  const pieces = ins.split("\u2028");
  const headText = target.text.slice(0, offset), tailText = target.text.slice(offset);
  setRunText(target.node, headText + pieces[0]);
  let ref = target.node.nextSibling;
  let last = target.node;
  for (let i = 1; i < pieces.length; i++) {
    const br = newBreakLike(doc, target.node);
    p.insertBefore(br, ref);
    last = br;
    if (pieces[i] || (i === pieces.length - 1 && tailText)) {
      const run = newRunLike(doc, target.node, pieces[i]);
      p.insertBefore(run, ref);
      last = run;
    }
  }
  if (tailText) {
    if (pieces.length > 1) setRunText(last, textOf(kid(last, "t")) + tailText);
    else setRunText(target.node, headText + pieces[0] + tailText);
  }
  cleanupEmptyRuns(p);
}
function cleanupEmptyRuns(p) {
  for (const n of kids(p, "r", "fld")) if (textOf(kid(n, "t")) === "" && kids(p, ...RUN_TAGS).length > 1) p.removeChild(n);
}

function applyParagraphTexts(doc, txBody, texts) {
  const cleanTexts = (Array.isArray(texts) ? texts : [texts]).map((value) => String(value ?? "").replace(/[\u200B\uFEFF]/g, ""));
  const paras = kids(txBody, "p");
  const n = Math.max(cleanTexts.length, 1);
  for (let i = 0; i < Math.min(paras.length, n); i++) editParagraph(doc, paras[i], cleanTexts[i] ?? "");
  for (let i = paras.length; i < n; i++) {
    const proto = paras[paras.length - 1];
    const clone = proto.cloneNode(true);
    for (const r of kids(clone, ...RUN_TAGS)) clone.removeChild(r);
    const rPr = kid(proto, ...RUN_TAGS) && kid(kid(proto, ...RUN_TAGS), "rPr");
    const end = kid(clone, "endParaRPr");
    if (cleanTexts[i]) {
      const run = create(doc, "a", "r");
      if (rPr) run.appendChild(rPr.cloneNode(true));
      const t = create(doc, "a", "t"); t.appendChild(doc.createTextNode(cleanTexts[i])); run.appendChild(t);
      clone.insertBefore(run, end);
    }
    txBody.appendChild(clone);
  }
  for (const p of kids(txBody, "p").slice(n)) txBody.removeChild(p);
}

export function setText(pkg, slidePath, id, texts, cell = null, fittedHeight = null, fallbackBounds = null) {
  return mutateSlide(pkg, slidePath, "Edit text", (doc, tree) => {
    const node = findNode(tree, id);
    let body = txBodyOf(node, cell);
    if (!body && node.localName === "sp") {
      body = create(doc, "p", "txBody");
      body.appendChild(create(doc, "a", "bodyPr"));
      body.appendChild(create(doc, "a", "lstStyle"));
      body.appendChild(create(doc, "a", "p"));
      const spPr = kid(node, "spPr");
      node.insertBefore(body, spPr ? spPr.nextSibling : null);
    }
    if (!body) throw new PptxError("NO_TEXT", "This object has no text.");
    const wasEmpty = !!cell && kids(body, "p").every((para) => !segmentsOf(para).some((seg) => seg.text));
    applyParagraphTexts(doc, body, texts);
    // First text typed into an empty table cell: centred both ways at a medium size (the default
    // cell text is small and top-left). Cells that already have content keep their own formatting.
    if (wasEmpty && kids(body, "p").some((para) => segmentsOf(para).some((seg) => seg.text))) centerNewCellText(doc, body);
    // Commit text and its auto-grown frame in the same undoable transaction.
    if (!cell && Number.isFinite(fittedHeight)) {
      const current = readBoundsFromNode(node) || fallbackBounds;
      if (current && fittedHeight > current.h) writeBounds(doc, node, { ...current, h: Math.round(fittedHeight) });
    }
  });
}

export const NEW_CELL_FONT_SZ = 2000; // 20 pt, hundredths of a point

function centerNewCellText(doc, body) {
  const tc = body.parentNode;
  let tcPr = kid(tc, "tcPr");
  if (!tcPr) { tcPr = create(doc, "a", "tcPr"); tc.insertBefore(tcPr, body.nextSibling); }
  tcPr.setAttribute("anchor", "ctr");
  for (const para of kids(body, "p")) {
    ensurePPr(doc, para).setAttribute("algn", "ctr");
    for (const run of kids(para, "r", "fld")) {
      const rPr = ensureRPr(doc, run);
      if (!rPr.hasAttribute("sz")) rPr.setAttribute("sz", String(NEW_CELL_FONT_SZ));
    }
    let end = kid(para, "endParaRPr");
    if (!end) { end = create(doc, "a", "endParaRPr"); para.appendChild(end); }
    if (!end.hasAttribute("sz")) end.setAttribute("sz", String(NEW_CELL_FONT_SZ));
  }
}

function ensureRPr(doc, run) {
  let rPr = kid(run, "rPr");
  if (!rPr) { rPr = create(doc, "a", "rPr"); run.insertBefore(rPr, run.firstChild); }
  return rPr;
}
function ensurePPr(doc, p) {
  let pPr = kid(p, "pPr");
  if (!pPr) { pPr = create(doc, "a", "pPr"); p.insertBefore(pPr, p.firstChild); }
  return pPr;
}
const HEX = /^[0-9A-Fa-f]{6}$/;
function solid(doc, hex, alpha) {
  if (!HEX.test(hex)) throw new PptxError("BAD_COLOR", "Invalid colour");
  const f = create(doc, "a", "solidFill");
  const c = create(doc, "a", "srgbClr", { val: hex.toUpperCase() });
  if (alpha !== undefined && alpha < 1) c.appendChild(create(doc, "a", "alpha", { val: R(alpha * 100000) }));
  f.appendChild(c);
  return f;
}

/** props: {size,bold,italic,underline,color,font,align,bullet,lineSpacing,anchor,autofit,wrap} applied to the whole text body. */
export function setTextProps(pkg, slidePath, ids, props, cell = null) {
  return mutateSlide(pkg, slidePath, "Format text", (doc, tree) => {
    for (const id of ids) {
      const node = findNode(tree, id);
      const bodies = [];
      if (node.localName === "graphicFrame" && !cell) {
        for (const tc of descendants(node, "tc")) { const b = kid(tc, "txBody"); if (b) bodies.push(b); }
      } else { const b = txBodyOf(node, cell); if (b) bodies.push(b); }
      for (const body of bodies) {
        for (const p of kids(body, "p")) {
          const pProps = ["align", "bullet", "lineSpacing"].some((k) => props[k] !== undefined);
          if (pProps) {
            const pPr = ensurePPr(doc, p);
            if (props.align) pPr.setAttribute("algn", props.align);
            if (props.lineSpacing !== undefined) {
              const ln = create(doc, "a", "lnSpc");
              ln.appendChild(create(doc, "a", "spcPct", { val: R(props.lineSpacing * 100000) }));
              insertOrdered(pPr, ln, ORDER.pPr, { replace: true });
            }
            if (props.bullet !== undefined) {
              for (const n of kids(pPr, "buNone", "buChar", "buAutoNum", "buFont")) pPr.removeChild(n);
              if (props.bullet) {
                if (!pPr.hasAttribute("marL") || num(pPr, "marL") === 0) { pPr.setAttribute("marL", "342900"); pPr.setAttribute("indent", "-342900"); }
                insertOrdered(pPr, create(doc, "a", "buFont", { typeface: "Arial" }), ORDER.pPr);
                insertOrdered(pPr, create(doc, "a", "buChar", { char: "•" }), ORDER.pPr);
              } else { pPr.setAttribute("marL", "0"); pPr.setAttribute("indent", "0"); insertOrdered(pPr, create(doc, "a", "buNone"), ORDER.pPr); }
            }
          }
          const targets = [...kids(p, "r", "fld", "br").map((r) => ensureRPr(doc, r))];
          const end = kid(p, "endParaRPr");
          if (end) targets.push(end);
          for (const rPr of targets) {
            if (props.size !== undefined) rPr.setAttribute("sz", String(R(props.size * 100)));
            if (props.bold !== undefined) rPr.setAttribute("b", props.bold ? "1" : "0");
            if (props.italic !== undefined) rPr.setAttribute("i", props.italic ? "1" : "0");
            if (props.underline !== undefined) rPr.setAttribute("u", props.underline ? "sng" : "none");
            if (props.strike !== undefined) rPr.setAttribute("strike", props.strike ? "sngStrike" : "noStrike");
            if (props.color) insertOrdered(rPr, solid(doc, props.color), ORDER.rPr, { replace: true });
            if (props.highlight !== undefined) {
              for (const node of kids(rPr, "highlight")) rPr.removeChild(node);
              if (props.highlight) {
                if (!HEX.test(String(props.highlight))) throw new PptxError("BAD_COLOR", "Invalid highlight colour");
                const highlight = create(doc, "a", "highlight");
                highlight.appendChild(create(doc, "a", "srgbClr", { val: String(props.highlight).toUpperCase() }));
                insertOrdered(rPr, highlight, ORDER.rPr, { replace: true });
              }
            }
            if (props.font) insertOrdered(rPr, create(doc, "a", "latin", { typeface: String(props.font).slice(0, 80) }), ORDER.rPr, { replace: true });
          }
        }
        const bodyPr = kid(body, "bodyPr");
        if (bodyPr) {
          if (props.anchor) bodyPr.setAttribute("anchor", props.anchor);
          if (props.wrap) bodyPr.setAttribute("wrap", props.wrap);
          if (props.autofit) {
            const name = { shrink: "normAutofit", resize: "spAutoFit", none: "noAutofit" }[props.autofit];
            for (const n of kids(bodyPr, "noAutofit", "normAutofit", "spAutoFit")) bodyPr.removeChild(n);
            insertOrdered(bodyPr, create(doc, "a", name), ORDER.bodyPr);
          }
        }
      }
    }
  });
}

// ---------- shape styling ----------
function spPrOf(doc, node) {
  let spPr = kid(node, "spPr");
  if (!spPr) {
    spPr = create(doc, "p", "spPr");
    const after = kid(node, "nvSpPr", "nvPicPr", "nvCxnSpPr");
    node.insertBefore(spPr, after ? after.nextSibling : node.firstChild);
  }
  return spPr;
}
/** fill: {none:true} | {hex, alpha?} ; line: {none:true} | {hex?, w?(EMU)} */
export function setShapeStyle(pkg, slidePath, ids, { fill, line } = {}) {
  return mutateSlide(pkg, slidePath, "Style", (doc, tree) => {
    for (const id of ids) {
      const node = findNode(tree, id);
      if (!["sp", "pic", "cxnSp"].includes(node.localName)) continue;
      const spPr = spPrOf(doc, node);
      if (fill && node.localName === "sp") {
        const el = fill.none ? create(doc, "a", "noFill") : solid(doc, fill.hex, fill.alpha);
        for (const n of kids(spPr, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")) spPr.removeChild(n);
        insertOrdered(spPr, el, ORDER.spPr);
      }
      if (line) {
        let ln = kid(spPr, "ln");
        if (!ln) { ln = create(doc, "a", "ln"); insertOrdered(spPr, ln, ORDER.spPr); }
        if (line.w !== undefined) ln.setAttribute("w", String(R(line.w)));
        if (line.none || line.hex) {
          for (const n of kids(ln, "noFill", "solidFill", "gradFill", "pattFill")) ln.removeChild(n);
          insertOrdered(ln, line.none ? create(doc, "a", "noFill") : solid(doc, line.hex, line.alpha), ORDER.ln);
        }
        if (line.dash) insertOrdered(ln, create(doc, "a", "prstDash", { val: line.dash }), ORDER.ln, { replace: true });
      }
    }
  });
}
const DRAWINGML_COLOR_NODES = new Set(["srgbClr", "schemeClr", "prstClr", "sysClr", "scrgbClr"]);
function writeColorAlpha(doc, colorNode, opacity) {
  // Replace every alpha transform with one exact value while preserving tint/shade/etc.
  for (const transform of kids(colorNode, "alpha", "alphaMod", "alphaOff")) colorNode.removeChild(transform);
  if (opacity < 1) insertOrdered(colorNode, create(doc, "a", "alpha", { val: R(opacity * 100000) }), ORDER.color);
}
function writeTreeAlpha(doc, root, opacity) {
  let changed = false;
  const walk = (node) => {
    for (const child of kids(node)) {
      if (DRAWINGML_COLOR_NODES.has(child.localName)) {
        writeColorAlpha(doc, child, opacity);
        changed = true;
      } else walk(child);
    }
  };
  if (root) walk(root);
  return changed;
}
function writePictureAlpha(doc, blip, opacity) {
  if (!blip) return false;
  for (const effect of kids(blip, "alphaModFix")) blip.removeChild(effect);
  if (opacity < 1) insertOrdered(blip, create(doc, "a", "alphaModFix", { amt: R(opacity * 100000) }), ORDER.blip);
  return true;
}
function setFillOpacity(doc, owner, opacity) {
  if (!owner) return false;
  const fill = kid(owner, "solidFill", "gradFill", "pattFill", "blipFill", "grpFill", "noFill");
  if (!fill || fill.localName === "noFill") return false;
  if (fill.localName === "blipFill") return writePictureAlpha(doc, kid(fill, "blip"), opacity);
  return writeTreeAlpha(doc, fill, opacity);
}
function setStyleRefOpacity(doc, node, refName, opacity) {
  const style = kid(node, "style");
  const ref = style && kid(style, refName);
  return ref ? writeTreeAlpha(doc, ref, opacity) : false;
}
function setShapeOpacity(doc, node, spPr, opacity) {
  // Explicit local fills/lines take precedence. When PowerPoint uses a theme style
  // reference instead, materialise the alpha transform on that object's own style ref.
  const localFill = kid(spPr, "solidFill", "gradFill", "pattFill", "blipFill", "grpFill", "noFill");
  if (localFill) setFillOpacity(doc, spPr, opacity);
  else setStyleRefOpacity(doc, node, "fillRef", opacity);

  const localLine = kid(spPr, "ln");
  if (localLine) {
    const localLineFill = kid(localLine, "solidFill", "gradFill", "pattFill", "blipFill", "grpFill", "noFill");
    if (localLineFill) setFillOpacity(doc, localLine, opacity);
    else setStyleRefOpacity(doc, node, "lnRef", opacity);
  } else {
    setStyleRefOpacity(doc, node, "lnRef", opacity);
  }
}
/**
 * Set object opacity in the OOXML document (0..1). Pictures use a:alphaModFix;
 * shapes/connectors apply alpha to all fill stops and outline colours, preserving
 * their colour transforms and outline dash/width.
 */
export function setOpacity(pkg, slidePath, ids, opacity) {
  const value = Number(opacity);
  if (!Number.isFinite(value)) throw new PptxError("BAD_OPACITY", "Opacity must be a number between 0 and 1.");
  const alpha = Math.max(0, Math.min(1, value));
  return mutateSlide(pkg, slidePath, "Opacity", (doc, tree) => {
    for (const id of ids) {
      const node = findNode(tree, id);
      if (node.localName === "pic") {
        writePictureAlpha(doc, path(node, "blipFill", "blip"), alpha);
        // PowerPoint pictures can carry an independent border: keep it in sync too.
        const spPr = kid(node, "spPr");
        if (spPr) setFillOpacity(doc, kid(spPr, "ln"), alpha);
      } else if (node.localName === "sp" || node.localName === "cxnSp") {
        const spPr = spPrOf(doc, node);
        setShapeOpacity(doc, node, spPr, alpha);
      }
    }
  });
}


const normalizePaletteColor = (value) => String(value || "").replace(/^#/, "").toUpperCase();
const colorRgbLuminance = (hex) => {
  const rgb = normalizePaletteColor(hex).match(/.{2}/g) || ["FF", "FF", "FF"];
  const values = rgb.map((v) => parseInt(v, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};
const contrastInk = (hex) => colorRgbLuminance(hex) > 0.179 ? "111827" : "FFFFFF";

function replaceColorFill(doc, owner, hex) {
  if (!owner) return;
  for (const old of kids(owner, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")) owner.removeChild(old);
  insertOrdered(owner, solid(doc, normalizePaletteColor(hex)), ORDER.spPr);
}

function replaceLineColor(doc, spPr, hex) {
  if (!spPr) return;
  let line = kid(spPr, "ln");
  if (!line) { line = create(doc, "a", "ln"); insertOrdered(spPr, line, ORDER.spPr); }
  for (const old of kids(line, "noFill", "solidFill", "gradFill", "pattFill")) line.removeChild(old);
  insertOrdered(line, solid(doc, normalizePaletteColor(hex)), ORDER.ln);
}

function setTextBodyColor(doc, body, hex) {
  if (!body) return;
  // Run properties (including defRPr inside a:pPr) share DrawingML's run-property order.
  // ORDER.pPr applies to the paragraph-properties container, not to a:defRPr itself.
  for (const tag of ["rPr", "defRPr", "endParaRPr"]) {
    for (const runProps of descendants(body, tag)) {
      insertOrdered(runProps, solid(doc, normalizePaletteColor(hex)), ORDER.rPr, { replace: true });
    }
  }
  // Ensure empty paragraphs and runs that inherit formatting still receive the palette ink.
  for (const paragraph of descendants(body, "p")) {
    let pPr = kid(paragraph, "pPr");
    if (!pPr) {
      pPr = create(doc, "a", "pPr");
      paragraph.insertBefore(pPr, paragraph.firstChild);
    }
    let defaults = kid(pPr, "defRPr");
    if (!defaults) defaults = insertOrdered(pPr, create(doc, "a", "defRPr"), ORDER.pPr);
    insertOrdered(defaults, solid(doc, normalizePaletteColor(hex)), ORDER.rPr, { replace: true });
  }
}

/**
 * Apply a coordinated five-color palette to one slide as a single undoable edit.
 * Palette[0] is the slide background; remaining colors rotate across text and shapes.
 * Shape-contained text receives black/white ink chosen for contrast against its fill.
 */
export function applySlidePalette(pkg, slidePath, palette) {
  const colors = Array.isArray(palette?.colors) ? palette.colors.map(normalizePaletteColor) : [];
  if (colors.length !== 5 || colors.some((color) => !HEX.test(color))) {
    throw new PptxError("BAD_PALETTE", "A palette must contain five six-digit hexadecimal colors.");
  }
  return mutateSlide(pkg, slidePath, `Apply ${String(palette.name || "color")} palette`, (doc, tree) => {
    const cSld = kid(doc.documentElement, "cSld");
    if (!cSld) throw new PptxError("SLIDE_INVALID", "Slide is missing its common slide data.");
    const oldBg = kid(cSld, "bg");
    if (oldBg) cSld.removeChild(oldBg);
    const bg = create(doc, "p", "bg");
    const bgPr = create(doc, "p", "bgPr");
    bgPr.appendChild(solid(doc, colors[0]));
    bgPr.appendChild(create(doc, "a", "effectLst"));
    bg.appendChild(bgPr);
    cSld.insertBefore(bg, kid(cSld, "spTree") || cSld.firstChild);

    // Traverse the XML tree once so accent assignment follows the same z-order users see.
    const drawableNodes = [];
    const collectDrawableNodes = (parent) => {
      for (const child of kids(parent)) {
        if (["sp", "pic", "cxnSp"].includes(child.localName)) drawableNodes.push(child);
        collectDrawableNodes(child);
      }
    };
    collectDrawableNodes(tree);
    let visibleShapeIndex = 0;
    let textIndex = 0;
    for (const node of drawableNodes) {
      const tag = node.localName;
      // Do not synthesize a missing p:pic/p:spPr before blipFill: that would violate
      // the picture schema order. Normal shape and connector properties may be materialized.
      const spPr = kid(node, "spPr") || (tag === "sp" || tag === "cxnSp" ? spPrOf(doc, node) : null);
      const shapeColor = colors[1 + (visibleShapeIndex % 4)];
      const outlineColor = colors[1 + ((visibleShapeIndex + 1) % 4)];
      const isTextBox = tag === "sp" && attr(path(node, "nvSpPr", "cNvSpPr"), "txBox") === "1";
      const ph = tag === "sp" ? path(node, "nvSpPr", "nvPr", "ph") : null;
      const shapeFill = spPr && kids(spPr, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")[0];
      const isInheritedTextPlaceholder = !!ph && (!shapeFill || shapeFill.localName === "noFill");
      const isTextItem = isTextBox || isInheritedTextPlaceholder;
      const geom = kid(spPr, "prstGeom");
      const geomName = attr(geom, "prst", "");
      if (tag === "sp" && !isTextItem && geomName !== "line") replaceColorFill(doc, spPr, shapeColor);
      if (spPr && (tag === "cxnSp" || tag === "pic" || (tag === "sp" && geomName === "line") || (tag === "sp" && !isTextItem))) {
        replaceLineColor(doc, spPr, outlineColor);
      }

      const body = tag === "sp" ? kid(node, "txBody") : null;
      if (body) {
        const textColor = isTextItem ? colors[1 + (textIndex % 4)] : contrastInk(shapeColor);
        setTextBodyColor(doc, body, textColor);
        if (isTextItem) textIndex += 1;
      }
      visibleShapeIndex += 1;
    }

    // Tables are drawable graphic frames and should harmonize with the same palette.
    for (const frame of descendants(tree, "graphicFrame")) {
      const table = path(frame, "graphic", "graphicData", "tbl");
      if (!table) continue;
      const rows = descendants(table, "tr");
      let cellIndex = 0;
      for (const row of rows) {
        for (const cell of kids(row, "tc")) {
          const tcPr = kid(cell, "tcPr");
          if (tcPr) {
            for (const oldFill of kids(tcPr, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")) tcPr.removeChild(oldFill);
            const cellFill = solid(doc, colors[1 + (cellIndex % 4)]);
            const anchor = kid(tcPr, "extLst");
            tcPr.insertBefore(cellFill, anchor || null);
          }
          setTextBodyColor(doc, kid(cell, "txBody"), contrastInk(colors[1 + (cellIndex % 4)]));
          cellIndex += 1;
        }
      }
    }
  });
}

const PALETTE_SHAPE_FILLS = ["noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill"];
const PALETTE_LINE_FILLS = ["noFill", "solidFill", "gradFill", "pattFill"];

function elementPathFrom(root, target) {
  const segments = [];
  let node = target;
  while (node && node !== root) {
    const parent = node.parentNode;
    if (!parent) return null;
    const siblings = kids(parent, node.localName);
    segments.unshift({ tag: node.localName, index: siblings.indexOf(node) });
    node = parent;
  }
  return node === root ? segments : null;
}
function elementAtPath(root, segments) {
  let node = root;
  for (const segment of segments || []) {
    node = kids(node, segment.tag)[segment.index] || null;
    if (!node) return null;
  }
  return node;
}
function cloneChildren(owner, names) {
  return owner ? kids(owner, ...names).map((node) => node.cloneNode(true)) : [];
}
function captureTextColors(body) {
  if (!body) return null;
  const hosts = [];
  for (const tag of ["rPr", "defRPr", "endParaRPr"]) {
    for (const node of descendants(body, tag)) {
      hosts.push({ path: elementPathFrom(body, node), fills: cloneChildren(node, ["solidFill"]) });
    }
  }
  const paragraphs = descendants(body, "p").map((paragraph) => {
    const props = kid(paragraph, "pPr");
    return { path: elementPathFrom(body, paragraph), hadPPr: !!props, hadDefRPr: !!kid(props, "defRPr") };
  });
  return { hosts, paragraphs };
}
function restoreDirectColorChildren(doc, owner, names, snapshots, order) {
  if (!owner) return;
  for (const old of kids(owner, ...names)) owner.removeChild(old);
  for (const old of snapshots || []) {
    const restored = doc.importNode(old, true);
    if (owner.localName === "tcPr") owner.insertBefore(restored, kid(owner, "extLst") || null);
    else insertOrdered(owner, restored, order);
  }
}
function restoreTextColors(doc, body, snapshot) {
  if (!body || !snapshot) return;
  for (const saved of snapshot.hosts || []) {
    const host = elementAtPath(body, saved.path);
    if (host) restoreDirectColorChildren(doc, host, ["solidFill"], saved.fills, ORDER.rPr);
  }
  for (const saved of snapshot.paragraphs || []) {
    if (saved.hadDefRPr) continue;
    const paragraph = elementAtPath(body, saved.path);
    const props = paragraph && kid(paragraph, "pPr");
    const defaults = props && kid(props, "defRPr");
    if (defaults) {
      for (const old of kids(defaults, "solidFill")) defaults.removeChild(old);
      if (!defaults.attributes?.length && !kids(defaults).length) props.removeChild(defaults);
    }
    if (!saved.hadPPr && props && !props.attributes?.length && !kids(props).length) paragraph.removeChild(props);
  }
}
function collectPaletteDrawables(tree) {
  const entries = [], counts = new Map();
  const walk = (parent) => {
    for (const node of kids(parent)) {
      if (["sp", "pic", "cxnSp"].includes(node.localName)) {
        const id = idOf(node), count = counts.get(id) || 0;
        counts.set(id, count + 1);
        entries.push({ node, key: count ? `${id}~${count}` : id });
      }
      walk(node);
    }
  };
  walk(tree);
  return entries;
}
function collectPaletteFrames(tree) {
  const counts = new Map();
  return descendants(tree, "graphicFrame").map((node) => {
    const id = idOf(node), count = counts.get(id) || 0;
    counts.set(id, count + 1);
    return { node, key: count ? `${id}~${count}` : id };
  });
}

/** Capture only the colour properties that a coordinated palette changes; geometry and content are not snapshotted. */
export function captureSlidePaletteState(pkg, slidePath) {
  const doc = pkg.doc(slidePath);
  const cSld = doc && kid(doc.documentElement, "cSld");
  const tree = cSld && kid(cSld, "spTree");
  if (!doc || !cSld || !tree) throw new PptxError("SLIDE_INVALID", "Slide is missing its common slide data.");
  const objects = collectPaletteDrawables(tree).map(({ node, key }) => {
    const spPr = kid(node, "spPr"), line = spPr && kid(spPr, "ln");
    return {
      key, tag: node.localName, hadSpPr: !!spPr,
      fills: cloneChildren(spPr, PALETTE_SHAPE_FILLS),
      hadLine: !!line, lineFills: cloneChildren(line, PALETTE_LINE_FILLS),
      text: node.localName === "sp" ? captureTextColors(kid(node, "txBody")) : null,
    };
  });
  const tables = collectPaletteFrames(tree).map(({ node, key }) => {
    const tbl = path(node, "graphic", "graphicData", "tbl");
    if (!tbl) return null;
    return {
      key,
      rows: kids(tbl, "tr").map((row) => kids(row, "tc").map((cell) => {
        const props = kid(cell, "tcPr");
        return { hadTcPr: !!props, fills: cloneChildren(props, PALETTE_SHAPE_FILLS), text: captureTextColors(kid(cell, "txBody")) };
      })),
    };
  }).filter(Boolean);
  const background = kid(cSld, "bg");
  return { path: slidePath, background: background ? background.cloneNode(true) : null, objects, tables };
}

/** Restore palette-managed colours only, leaving text, geometry, rows/columns, and unrelated edits intact. */
export function restoreSlidePaletteStates(pkg, snapshots) {
  if (!Array.isArray(snapshots) || !snapshots.length) return;
  return pkg.transact("Restore palette colours", () => {
    for (const snapshot of snapshots) {
      if (!pkg.exists(snapshot.path)) continue;
      const doc = pkg.edit(snapshot.path);
      const cSld = kid(doc.documentElement, "cSld"), tree = cSld && kid(cSld, "spTree");
      if (!cSld || !tree) continue;
      const bg = kid(cSld, "bg");
      if (bg) cSld.removeChild(bg);
      if (snapshot.background) cSld.insertBefore(doc.importNode(snapshot.background, true), kid(cSld, "spTree") || cSld.firstChild);

      const currentObjects = new Map(collectPaletteDrawables(tree).map((entry) => [entry.key, entry.node]));
      for (const saved of snapshot.objects || []) {
        const node = currentObjects.get(saved.key);
        if (!node) continue;
        let spPr = kid(node, "spPr");
        if (!spPr && (node.localName === "sp" || node.localName === "cxnSp")) spPr = spPrOf(doc, node);
        if (spPr) {
          restoreDirectColorChildren(doc, spPr, PALETTE_SHAPE_FILLS, saved.fills, ORDER.spPr);
          const line = kid(spPr, "ln");
          if (saved.hadLine) {
            if (line) restoreDirectColorChildren(doc, line, PALETTE_LINE_FILLS, saved.lineFills, ORDER.ln);
          } else if (line) {
            restoreDirectColorChildren(doc, line, PALETTE_LINE_FILLS, [], ORDER.ln);
            if (!line.attributes?.length && !kids(line).length) spPr.removeChild(line);
          }
          if (!saved.hadSpPr && !spPr.attributes?.length && !kids(spPr).length) node.removeChild(spPr);
        }
        if (saved.text && node.localName === "sp") restoreTextColors(doc, kid(node, "txBody"), saved.text);
      }

      const currentFrames = new Map(collectPaletteFrames(tree).map((entry) => [entry.key, entry.node]));
      for (const saved of snapshot.tables || []) {
        const frame = currentFrames.get(saved.key);
        const tbl = frame && path(frame, "graphic", "graphicData", "tbl");
        if (!tbl) continue;
        const rows = kids(tbl, "tr");
        saved.rows.forEach((rowState, rowIndex) => {
          const row = rows[rowIndex];
          if (!row) return;
          const cells = kids(row, "tc");
          rowState.forEach((cellState, colIndex) => {
            const cell = cells[colIndex];
            if (!cell) return;
            const props = kid(cell, "tcPr");
            if (props && cellState.hadTcPr) restoreDirectColorChildren(doc, props, PALETTE_SHAPE_FILLS, cellState.fills, ORDER.spPr);
            restoreTextColors(doc, kid(cell, "txBody"), cellState.text);
          });
        });
      }
    }
  });
}

// ---------- insertion ----------
function importFragment(doc, xml) {
  const frag = parseXml(xml, "fragment").documentElement;
  const node = doc.importNode(frag, true);
  for (const a of ["xmlns:p", "xmlns:a", "xmlns:r"]) node.removeAttribute(a);
  return node;
}
const NSDECL = `xmlns:p="${NS.p}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"`;
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

export function addTextBox(pkg, slidePath, { x, y, w, h, text = "Text", size = 24 }) {
  text = String(text ?? "").replace(/[\u200B\uFEFF]/g, "");
  return mutateSlide(pkg, slidePath, "Add text", (doc, tree) => {
    const id = nextId(tree);
    const node = importFragment(doc, `<p:sp ${NSDECL}><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id - 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${R(x)}" y="${R(y)}"/><a:ext cx="${R(w)}" cy="${R(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${R(size * 100)}" dirty="0"/><a:t>${esc(text)}</a:t></a:r></a:p></p:txBody></p:sp>`);
    tree.insertBefore(node, endAnchor(tree));
    return String(id);
  });
}
export const SHAPE_PRESETS = ["rect", "roundRect", "ellipse", "triangle", "rtTriangle", "diamond", "parallelogram", "trapezoid", "pentagon", "hexagon", "octagon", "rightArrow", "leftArrow", "upArrow", "downArrow", "leftRightArrow", "upDownArrow", "quadArrow", "notchedRightArrow", "bentArrow", "chevron", "homePlate", "plus", "heart", "lightningBolt", "sun", "moon", "wedgeRectCallout", "star4", "star5", "star6", "star8", "line", "flowChartProcess", "flowChartPredefinedProcess", "flowChartAlternateProcess", "flowChartTerminator", "flowChartDecision", "flowChartConnector", "flowChartInputOutput", "flowChartPreparation", "flowChartManualInput", "flowChartOffpageConnector", "flowChartDocument"];

/** Insert an editable DrawingML table. Dimensions are EMUs; row/column counts are bounded for usability. */
export function addTable(pkg, slidePath, { x, y, w, h, rows = 3, cols = 3 } = {}) {
  const rowCount = Math.max(1, Math.min(12, Math.trunc(Number(rows) || 3)));
  const colCount = Math.max(1, Math.min(12, Math.trunc(Number(cols) || 3)));
  if (![x, y, w, h].every((v) => Number.isFinite(Number(v))) || w <= 0 || h <= 0) {
    throw new PptxError("BAD_TABLE_SIZE", "Table position and size must be positive numbers.");
  }
  return mutateSlide(pkg, slidePath, "Insert table", (doc, tree) => {
    const id = nextId(tree);
    const columnWidths = Array.from({ length: colCount }, (_, i) => i === colCount - 1 ? Math.round(w) - Math.floor(w / colCount) * (colCount - 1) : Math.floor(w / colCount));
    const rowHeights = Array.from({ length: rowCount }, (_, i) => i === rowCount - 1 ? Math.round(h) - Math.floor(h / rowCount) * (rowCount - 1) : Math.floor(h / rowCount));
    const grid = columnWidths.map((width) => `<a:gridCol w="${width}"/>`).join("");
    const cell = `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></a:txBody><a:tcPr marL="91440" marR="91440" marT="45720" marB="45720"/></a:tc>`;
    const tableRowsXml = rowHeights.map((height) => `<a:tr h="${height}">${Array.from({ length: colCount }, () => cell).join("")}</a:tr>`).join("");
    const xml = `<p:graphicFrame ${NSDECL}><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id - 1}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${R(x)}" y="${R(y)}"/><a:ext cx="${R(w)}" cy="${R(h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid>${grid}</a:tblGrid>${tableRowsXml}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    tree.insertBefore(importFragment(doc, xml), endAnchor(tree));
    return String(id);
  });
}
export function addShape(pkg, slidePath, { prst = "rect", x, y, w, h, hex = null }) {
  if (!SHAPE_PRESETS.includes(prst)) throw new PptxError("BAD_SHAPE", "Unsupported shape");
  return mutateSlide(pkg, slidePath, "Add shape", (doc, tree) => {
    const id = nextId(tree);
    const fill = hex ? `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>` : `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>`;
    const isLine = prst === "line";
    const xml = isLine
      ? `<p:cxnSp ${NSDECL}><p:nvCxnSpPr><p:cNvPr id="${id}" name="Line ${id - 1}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${R(x)}" y="${R(y)}"/><a:ext cx="${R(w)}" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="28575"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`
      : `<p:sp ${NSDECL}><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id - 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${R(x)}" y="${R(y)}"/><a:ext cx="${R(w)}" cy="${R(h)}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fill}<a:ln w="12700"><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
    tree.insertBefore(importFragment(doc, xml), endAnchor(tree));
    return String(id);
  });
}

const MIME = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif" };
function newMediaPath(pkg, ext) {
  let max = 0;
  for (const n of [...pkg.order, ...pkg.originalNames]) { const m = /^ppt\/media\/image(\d+)\./.exec(n); if (m) max = Math.max(max, Number(m[1])); }
  return `ppt/media/image${max + 1}.${ext}`;
}
export function addPicture(pkg, slidePath, { bytes, ext, x, y, w, h, name = "Picture" }) {
  ext = ext.toLowerCase() === "jpg" ? "jpeg" : ext.toLowerCase();
  if (!MIME[ext]) throw new PptxError("BAD_IMAGE", "Use PNG, JPEG or GIF images.");
  return mutateSlide(pkg, slidePath, "Add image", (doc, tree) => {
    const media = newMediaPath(pkg, ext);
    pkg.ensureDefault(ext, MIME[ext]);
    pkg.putBinary(media, bytes);
    const rid = pkg.addRel(slidePath, REL.image, media);
    const id = nextId(tree);
    const node = importFragment(doc, `<p:pic ${NSDECL}><p:nvPicPr><p:cNvPr id="${id}" name="${esc(name)} ${id - 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${R(x)}" y="${R(y)}"/><a:ext cx="${R(w)}" cy="${R(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
    tree.insertBefore(node, endAnchor(tree));
    return String(id);
  });
}
/** Swap the picture for a new media part (never overwrites media another slide may share). */
export function replacePicture(pkg, slidePath, id, { bytes, ext, keepSize = true, naturalRatio = null }) {
  ext = ext.toLowerCase() === "jpg" ? "jpeg" : ext.toLowerCase();
  if (!MIME[ext]) throw new PptxError("BAD_IMAGE", "Use PNG, JPEG or GIF images.");
  return mutateSlide(pkg, slidePath, "Replace image", (doc, tree) => {
    const node = findNode(tree, id);
    const blip = path(node, "blipFill", "blip");
    if (!blip) throw new PptxError("NOT_PICTURE", "Select a picture first.");
    const media = newMediaPath(pkg, ext);
    pkg.ensureDefault(ext, MIME[ext]);
    pkg.putBinary(media, bytes);
    const rid = pkg.addRel(slidePath, REL.image, media);
    blip.setAttributeNS(NS.r, "r:embed", rid);
    for (const n of kids(path(node, "blipFill"), "srcRect")) path(node, "blipFill").removeChild(n);
    if (keepSize && naturalRatio) {
      const b = readBoundsFromNode(node);
      if (b) writeBounds(doc, node, { ...b, h: b.w / naturalRatio });
    }
  });
}

// ---------- grouping ----------
export function groupElements(pkg, slidePath, ids) {
  return mutateSlide(pkg, slidePath, "Group", (doc, tree) => {
    const sel = ids.map(String);
    const nodes = keyedNodes(tree).filter((x) => sel.includes(x.key)).map((x) => x.node);
    if (nodes.length < 2) throw new PptxError("GROUP_MIN", "Select at least two objects to group.");
    if (nodes.some((n) => n.localName === "AlternateContent")) throw new PptxError("READONLY", "This selection cannot be grouped.");
    const boxes = nodes.map((n) => { const b = readBoundsFromNode(n); if (!b) throw new PptxError("GROUP_INHERITED", "Move the placeholder once before grouping it."); return rotatedBox(b); });
    const u = unionBox(boxes);
    const id = nextId(tree);
    const grp = importFragment(doc, `<p:grpSp ${NSDECL}><p:nvGrpSpPr><p:cNvPr id="${id}" name="Group ${id - 1}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${R(u.x)}" y="${R(u.y)}"/><a:ext cx="${R(u.w)}" cy="${R(u.h)}"/><a:chOff x="${R(u.x)}" y="${R(u.y)}"/><a:chExt cx="${R(u.w)}" cy="${R(u.h)}"/></a:xfrm></p:grpSpPr></p:grpSp>`);
    const top = nodes[nodes.length - 1];
    tree.insertBefore(grp, top.nextSibling);
    for (const n of nodes) grp.appendChild(n);
    return String(id);
  });
}
export function ungroupElement(pkg, slidePath, id) {
  return mutateSlide(pkg, slidePath, "Ungroup", (doc, tree) => {
    const grp = findNode(tree, id);
    if (grp.localName !== "grpSp") throw new PptxError("NOT_GROUP", "Select a group first.");
    const gx = getXfrm(grp);
    const own = readBoundsFromNode(grp);
    const ch = kid(gx, "chOff") ? { x: num(kid(gx, "chOff"), "x"), y: num(kid(gx, "chOff"), "y"), w: num(kid(gx, "chExt"), "cx"), h: num(kid(gx, "chExt"), "cy") } : own;
    const sx = ch.w ? own.w / ch.w : 1, sy = ch.h ? own.h / ch.h : 1;
    const gcx = own.x + own.w / 2, gcy = own.y + own.h / 2, th = (own.rot * Math.PI) / 180;
    const created = [];
    for (const child of kids(grp).filter((n) => DRAWABLE.includes(n.localName))) {
      const b = readBoundsFromNode(child);
      if (b) {
        let w = b.w * sx, h = b.h * sy, cx = own.x + (b.x - ch.x) * sx + w / 2, cy = own.y + (b.y - ch.y) * sy + h / 2, flipH = b.flipH, flipV = b.flipV, rot = b.rot;
        if (own.flipH) { cx = 2 * gcx - cx; flipH = !flipH; }
        if (own.flipV) { cy = 2 * gcy - cy; flipV = !flipV; }
        if (th) { const dx = cx - gcx, dy = cy - gcy; cx = gcx + dx * Math.cos(th) - dy * Math.sin(th); cy = gcy + dx * Math.sin(th) + dy * Math.cos(th); rot += own.rot; }
        writeBounds(doc, child, { x: cx - w / 2, y: cy - h / 2, w, h, rot, flipH, flipV });
      }
      tree.insertBefore(child, grp);
      created.push(child);
    }
    tree.removeChild(grp);
    return created.map((n) => keyOf(tree, n));
  });
}

// ---------- tables ----------
function tblOf(node) {
  const t = path(node, "graphic", "graphicData", "tbl");
  if (!t) throw new PptxError("NOT_TABLE", "Select a table first.");
  return t;
}
function clearCell(tc) {
  const body = kid(tc, "txBody");
  if (!body) return;
  const ps = kids(body, "p");
  for (const p of ps.slice(1)) body.removeChild(p);
  const p = ps[0];
  for (const r of kids(p, ...RUN_TAGS)) p.removeChild(r);
}
function stripExt(el) { for (const e of kids(el, "extLst")) el.removeChild(e); }
function guardMerge(tbl) {
  if (descendants(tbl, "tc").some((tc) => tc.hasAttribute("gridSpan") || tc.hasAttribute("rowSpan") || tc.hasAttribute("hMerge") || tc.hasAttribute("vMerge"))) {
    throw new PptxError("TABLE_MERGED", "Rows and columns cannot be changed in tables with merged cells.");
  }
}
function growFrame(doc, node, dx, dy) {
  const b = readBoundsFromNode(node);
  if (b) writeBounds(doc, node, { ...b, w: b.w + dx, h: b.h + dy });
}
/** `before` inserts the new row above `index` instead of below it (used by the top-edge "+" handle). */
export function tableRows(pkg, slidePath, id, op, index, before = false) {
  return mutateSlide(pkg, slidePath, "Table rows", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    guardMerge(tbl);
    const rows = kids(tbl, "tr");
    if (op === "add") {
      const src = rows[Math.min(index, rows.length - 1)];
      const clone = src.cloneNode(true);
      stripExt(clone);
      for (const tc of kids(clone, "tc")) { clearCell(tc); stripExt(tc); }
      tbl.insertBefore(clone, before ? src : src.nextSibling);
      growFrame(doc, node, 0, num(src, "h"));
    } else {
      if (rows.length <= 1) throw new PptxError("TABLE_MIN", "A table needs at least one row.");
      const row = rows[index];
      growFrame(doc, node, 0, -num(row, "h"));
      tbl.removeChild(row);
    }
  });
}
/** `before` inserts the new column left of `index` instead of right of it (used by the edge "+" handle). */
export function tableCols(pkg, slidePath, id, op, index, before = false) {
  return mutateSlide(pkg, slidePath, "Table columns", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    guardMerge(tbl);
    const grid = kid(tbl, "tblGrid"), cols = kids(grid, "gridCol");
    if (op === "add") {
      const src = cols[Math.min(index, cols.length - 1)];
      const c = src.cloneNode(true);
      stripExt(c);
      grid.insertBefore(c, before ? src : src.nextSibling);
      for (const tr of kids(tbl, "tr")) {
        const tcs = kids(tr, "tc"), at = tcs[Math.min(index, tcs.length - 1)], t = at.cloneNode(true);
        clearCell(t); stripExt(t);
        tr.insertBefore(t, before ? at : at.nextSibling);
      }
      growFrame(doc, node, num(src, "w"), 0);
    } else {
      if (cols.length <= 1) throw new PptxError("TABLE_MIN", "A table needs at least one column.");
      growFrame(doc, node, -num(cols[index], "w"), 0);
      grid.removeChild(cols[index]);
      for (const tr of kids(tbl, "tr")) tr.removeChild(kids(tr, "tc")[index]);
    }
  });
}

/** Table design flags mirror PowerPoint's Table Design options. */
export function setTableOptions(pkg, slidePath, id, options = {}) {
  return mutateSlide(pkg, slidePath, "Table design", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    let props = kid(tbl, "tblPr");
    if (!props) {
      props = create(doc, "a", "tblPr");
      tbl.insertBefore(props, kid(tbl, "tblGrid") || tbl.firstChild);
    }
    for (const key of ["firstRow", "lastRow", "firstCol", "lastCol", "bandRow", "bandCol"]) {
      if (options[key] === undefined) continue;
      props.setAttribute(key, options[key] ? "1" : "0");
    }
  });
}

/** Set or clear the fill of one selected table cell. */
export function setTableCellFill(pkg, slidePath, id, rowIndex, colIndex, hex) {
  if (hex !== null && hex !== undefined && !HEX.test(String(hex))) throw new PptxError("BAD_COLOR", "Invalid table cell colour.");
  return mutateSlide(pkg, slidePath, "Table cell fill", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    const row = kids(tbl, "tr")[Math.trunc(rowIndex)];
    const cell = row && kids(row, "tc")[Math.trunc(colIndex)];
    if (!cell) throw new PptxError("TABLE_CELL_MISSING", "The selected table cell no longer exists.");
    let props = kid(cell, "tcPr");
    if (!props) { props = create(doc, "a", "tcPr"); cell.appendChild(props); }
    for (const old of kids(props, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")) props.removeChild(old);
    if (hex) {
      const fill = solid(doc, String(hex).replace(/^#/, ""));
      props.insertBefore(fill, kid(props, "extLst") || null);
    }
  });
}

function tableCellsForScope(tbl, rowIndex, colIndex, scope = "cell") {
  const rows = kids(tbl, "tr");
  const row = rows[Math.trunc(Number(rowIndex))];
  const col = Math.trunc(Number(colIndex));
  if (scope === "table") return rows.flatMap((item) => kids(item, "tc"));
  if (scope === "row") {
    if (!row) throw new PptxError("TABLE_CELL_MISSING", "The selected table row no longer exists.");
    return kids(row, "tc");
  }
  if (scope === "column") {
    const cells = rows.map((item) => kids(item, "tc")[col]).filter(Boolean);
    if (!cells.length) throw new PptxError("TABLE_CELL_MISSING", "The selected table column no longer exists.");
    return cells;
  }
  const cell = row && kids(row, "tc")[col];
  if (!cell) throw new PptxError("TABLE_CELL_MISSING", "The selected table cell no longer exists.");
  return [cell];
}

/** Format the currently selected cell, row, column or entire table in one undoable edit. */
export function setTableRangeTextProps(pkg, slidePath, id, rowIndex, colIndex, scope = "cell", props = {}) {
  return mutateSlide(pkg, slidePath, "Format table text", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    for (const cell of tableCellsForScope(tbl, rowIndex, colIndex, scope)) {
      const body = kid(cell, "txBody");
      if (!body) continue;
      for (const paragraph of kids(body, "p")) {
        const pProps = ["align", "bullet", "lineSpacing"].some((key) => props[key] !== undefined);
        if (pProps) {
          const pPr = ensurePPr(doc, paragraph);
          if (props.align) pPr.setAttribute("algn", props.align);
          if (props.lineSpacing !== undefined) {
            const lineSpacing = create(doc, "a", "lnSpc");
            lineSpacing.appendChild(create(doc, "a", "spcPct", { val: R(props.lineSpacing * 100000) }));
            insertOrdered(pPr, lineSpacing, ORDER.pPr, { replace: true });
          }
        }
        const targets = [...kids(paragraph, "r", "fld", "br").map((run) => ensureRPr(doc, run))];
        const end = kid(paragraph, "endParaRPr");
        if (end) targets.push(end);
        for (const rPr of targets) {
          if (props.size !== undefined) rPr.setAttribute("sz", String(R(Number(props.size) * 100)));
          if (props.bold !== undefined) rPr.setAttribute("b", props.bold ? "1" : "0");
          if (props.italic !== undefined) rPr.setAttribute("i", props.italic ? "1" : "0");
          if (props.underline !== undefined) rPr.setAttribute("u", props.underline ? "sng" : "none");
          if (props.strike !== undefined) rPr.setAttribute("strike", props.strike ? "sngStrike" : "noStrike");
          if (props.color) insertOrdered(rPr, solid(doc, String(props.color).replace(/^#/, "")), ORDER.rPr, { replace: true });
          if (props.font) insertOrdered(rPr, create(doc, "a", "latin", { typeface: String(props.font).slice(0, 80) }), ORDER.rPr, { replace: true });
          if (props.highlight !== undefined) {
            for (const old of kids(rPr, "highlight")) rPr.removeChild(old);
            if (props.highlight) {
              if (!HEX.test(String(props.highlight).replace(/^#/, ""))) throw new PptxError("BAD_COLOR", "Invalid highlight colour");
              const highlight = create(doc, "a", "highlight");
              highlight.appendChild(create(doc, "a", "srgbClr", { val: String(props.highlight).replace(/^#/, "").toUpperCase() }));
              insertOrdered(rPr, highlight, ORDER.rPr, { replace: true });
            }
          }
        }
        const bodyPr = kid(body, "bodyPr");
        if (bodyPr && props.anchor) bodyPr.setAttribute("anchor", props.anchor);
      }
    }
  });
}

/** Apply/remove cell fills at cell, row, column or whole-table scope. */
export function setTableRangeCellFill(pkg, slidePath, id, rowIndex, colIndex, scope = "cell", hex = null) {
  const normalized = hex == null ? null : String(hex).replace(/^#/, "");
  if (normalized !== null && !HEX.test(normalized)) throw new PptxError("BAD_COLOR", "Invalid table cell colour.");
  return mutateSlide(pkg, slidePath, "Table fill", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    for (const cell of tableCellsForScope(tbl, rowIndex, colIndex, scope)) {
      let props = kid(cell, "tcPr");
      if (!props) { props = create(doc, "a", "tcPr"); cell.appendChild(props); }
      for (const old of kids(props, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")) props.removeChild(old);
      if (normalized) {
        const fill = solid(doc, normalized);
        props.insertBefore(fill, kid(props, "extLst") || null);
      }
    }
  });
}

export function setElementName(pkg, slidePath, id, name) {
  return mutateSlide(pkg, slidePath, "Rename", (doc, tree) => { cNvPr(findNode(tree, id)).setAttribute("name", String(name).slice(0, 120)); });
}
export function setAltText(pkg, slidePath, id, descr) {
  return mutateSlide(pkg, slidePath, "Alt text", (doc, tree) => { cNvPr(findNode(tree, id)).setAttribute("descr", String(descr).slice(0, 500)); });
}

// ---------- clipboard (elements, across slides) ----------
const REL_ATTRS = ["embed", "link", "id", "pict"];
function relAttrsOf(node) {
  const out = [];
  const walk = (n) => {
    for (const a of Array.from(n.attributes || [])) if (a.namespaceURI === NS.r && REL_ATTRS.includes(a.localName)) out.push({ el: n, attr: a });
    for (const c of kids(n)) walk(c);
  };
  walk(node);
  return out;
}
/** Serialise elements + the relationships they use. Charts/diagrams/embedded objects are not copyable. */
export function copyElements(pkg, slidePath, ids) {
  const doc = pkg.doc(slidePath), tree = treeOf(doc);
  const payload = { items: [], rels: {} };
  for (const id of ids) {
    const node = findNode(tree, id);
    for (const { attr: a } of relAttrsOf(node)) {
      const rel = pkg.relById(slidePath, a.value);
      if (!rel) continue;
      if (![REL.image, REL.hyperlink].includes(rel.type)) throw new PptxError("NOT_COPYABLE", "Charts, SmartArt and embedded objects cannot be copied between slides. Duplicate the slide instead.");
      payload.rels[a.value] = { type: rel.type, target: rel.resolved || rel.target, external: rel.mode === "External" };
    }
    payload.items.push(serializeNode(node));
  }
  return payload;
}
function serializeNode(node) {
  // Serialise via a throwaway document so namespace declarations travel with the fragment.
  const tmp = parseXml(`<p:wrap ${NSDECL}/>`, "wrap");
  tmp.documentElement.appendChild(tmp.importNode(node, true));
  return serializeXml(tmp);
}
export function pasteElements(pkg, slidePath, payload, { dx = 190500, dy = 190500 } = {}) {
  return mutateSlide(pkg, slidePath, "Paste", (doc, tree) => {
    const created = [];
    const map = new Map();
    for (const xml of payload.items) {
      const frag = parseXml(xml, "clipboard").documentElement;
      const src = kids(frag)[0];
      const node = doc.importNode(src, true);
      for (const { attr: a } of relAttrsOf(node)) {
        const info = payload.rels[a.value];
        if (!info) continue;
        const key = `${a.value}`;
        if (!map.has(key)) {
          const existing = pkg.readRels(slidePath).find((r) => r.type === info.type && (info.external ? r.target === info.target : r.resolved === info.target));
          map.set(key, existing ? existing.id : pkg.addRel(slidePath, info.type, info.target, { external: info.external }));
        }
      }
      for (const { el, attr: a } of relAttrsOf(node)) { const to = map.get(a.value); if (to) el.setAttributeNS(NS.r, `r:${a.localName}`, to); }
      renumber(node, tree);
      tree.insertBefore(node, endAnchor(tree));
      const b = readBoundsFromNode(node);
      if (b) writeBounds(doc, node, { ...b, x: b.x + dx, y: b.y + dy });
      created.push(keyOf(tree, node));
    }
    return created;
  });
}

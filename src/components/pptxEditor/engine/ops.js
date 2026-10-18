/**
 * Slide editing operations. Each public function runs as ONE undoable
 * transaction and mutates the real slide XML — the canvas is re-derived from
 * it, so edits can never diverge from what gets exported.
 */
import { NS, kid, kids, path, attr, num, create, insertOrdered, ORDER, descendants, textOf, parseXml, serializeXml, PptxError } from "./xml.js";
import { REL } from "./package.js";
import { rotatedBox, unionBox } from "./geometry.js";

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
    for (const ch of changes) writeBounds(doc, findNode(tree, ch.id), ch);
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
  const paras = kids(txBody, "p");
  const n = Math.max(texts.length, 1);
  for (let i = 0; i < Math.min(paras.length, n); i++) editParagraph(doc, paras[i], texts[i] ?? "");
  for (let i = paras.length; i < n; i++) {
    const proto = paras[paras.length - 1];
    const clone = proto.cloneNode(true);
    for (const r of kids(clone, ...RUN_TAGS)) clone.removeChild(r);
    const rPr = kid(proto, ...RUN_TAGS) && kid(kid(proto, ...RUN_TAGS), "rPr");
    const end = kid(clone, "endParaRPr");
    if (texts[i]) {
      const run = create(doc, "a", "r");
      if (rPr) run.appendChild(rPr.cloneNode(true));
      const t = create(doc, "a", "t"); t.appendChild(doc.createTextNode(texts[i])); run.appendChild(t);
      clone.insertBefore(run, end);
    }
    txBody.appendChild(clone);
  }
  for (const p of kids(txBody, "p").slice(n)) txBody.removeChild(p);
}

export function setText(pkg, slidePath, id, texts, cell = null) {
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
    applyParagraphTexts(doc, body, texts);
  });
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
            if (props.color) insertOrdered(rPr, solid(doc, props.color), ORDER.rPr, { replace: true });
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
          insertOrdered(ln, line.none ? create(doc, "a", "noFill") : solid(doc, line.hex), ORDER.ln);
        }
        if (line.dash) insertOrdered(ln, create(doc, "a", "prstDash", { val: line.dash }), ORDER.ln, { replace: true });
      }
    }
  });
}
export function setOpacity(pkg, slidePath, ids, opacity, currentHex = null) {
  return mutateSlide(pkg, slidePath, "Opacity", (doc, tree) => {
    for (const id of ids) {
      const node = findNode(tree, id);
      if (node.localName === "pic") {
        const blip = path(node, "blipFill", "blip");
        if (!blip) continue;
        for (const n of kids(blip, "alphaModFix")) blip.removeChild(n);
        if (opacity < 1) insertOrdered(blip, create(doc, "a", "alphaModFix", { amt: R(opacity * 100000) }), ORDER.blip);
      } else if (node.localName === "sp") {
        const spPr = spPrOf(doc, node);
        const sf = kid(spPr, "solidFill");
        let hex = currentHex;
        if (sf) { const c = kids(sf)[0]; if (c?.localName === "srgbClr") hex = attr(c, "val", hex); else if (c) { /* scheme colour: keep colour, add alpha */
            for (const a of kids(c, "alpha")) c.removeChild(a);
            if (opacity < 1) c.appendChild(create(doc, "a", "alpha", { val: R(opacity * 100000) }));
            continue; } }
        if (!hex) continue;
        for (const n of kids(spPr, "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill")) spPr.removeChild(n);
        insertOrdered(spPr, solid(doc, hex, opacity), ORDER.spPr);
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
  return mutateSlide(pkg, slidePath, "Add text", (doc, tree) => {
    const id = nextId(tree);
    const node = importFragment(doc, `<p:sp ${NSDECL}><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id - 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${R(x)}" y="${R(y)}"/><a:ext cx="${R(w)}" cy="${R(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${R(size * 100)}" dirty="0"/><a:t>${esc(text)}</a:t></a:r></a:p></p:txBody></p:sp>`);
    tree.insertBefore(node, endAnchor(tree));
    return String(id);
  });
}
export const SHAPE_PRESETS = ["rect", "roundRect", "ellipse", "triangle", "rightArrow", "star5", "line"];
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
export function tableRows(pkg, slidePath, id, op, index) {
  return mutateSlide(pkg, slidePath, "Table rows", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    guardMerge(tbl);
    const rows = kids(tbl, "tr");
    if (op === "add") {
      const src = rows[Math.min(index, rows.length - 1)];
      const clone = src.cloneNode(true);
      stripExt(clone);
      for (const tc of kids(clone, "tc")) { clearCell(tc); stripExt(tc); }
      tbl.insertBefore(clone, src.nextSibling);
      growFrame(doc, node, 0, num(src, "h"));
    } else {
      if (rows.length <= 1) throw new PptxError("TABLE_MIN", "A table needs at least one row.");
      const row = rows[index];
      growFrame(doc, node, 0, -num(row, "h"));
      tbl.removeChild(row);
    }
  });
}
export function tableCols(pkg, slidePath, id, op, index) {
  return mutateSlide(pkg, slidePath, "Table columns", (doc, tree) => {
    const node = findNode(tree, id), tbl = tblOf(node);
    guardMerge(tbl);
    const grid = kid(tbl, "tblGrid"), cols = kids(grid, "gridCol");
    if (op === "add") {
      const src = cols[Math.min(index, cols.length - 1)];
      const c = src.cloneNode(true);
      stripExt(c);
      grid.insertBefore(c, src.nextSibling);
      for (const tr of kids(tbl, "tr")) {
        const tcs = kids(tr, "tc"), t = tcs[Math.min(index, tcs.length - 1)].cloneNode(true);
        clearCell(t); stripExt(t);
        tr.insertBefore(t, tcs[Math.min(index, tcs.length - 1)].nextSibling);
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

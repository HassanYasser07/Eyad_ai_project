/**
 * Read-only view model of a slide, derived from the slide XML + layout + master
 * + theme. The model is for rendering and for UI state only; it is rebuilt from
 * the XML after every change, so the canvas can never drift from the document.
 */
import { NS, kid, kids, path, attr, num, bool, textOf, descendants } from "./xml.js";
import { REL } from "./package.js";
import { loadTheme, resolveColor, themeFont } from "./theme.js";
import { presetGeometry, customGeometry } from "./shapes.js";

export const EMU_PER_PX = 9525;
const IMG_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };
const URI = { table: "drawingml/2006/table", chart: "drawingml/2006/chart", diagram: "drawingml/2006/diagram" };

export function readPresentation(pkg) {
  const root = pkg.doc("ppt/presentation.xml").documentElement;
  const sz = kid(root, "sldSz");
  const rels = new Map(pkg.readRels("ppt/presentation.xml").map((r) => [r.id, r]));
  const slides = [];
  for (const el of kids(kid(root, "sldIdLst"), "sldId")) {
    const rid = el.getAttributeNS(NS.r, "id");
    const rel = rels.get(rid);
    if (rel?.resolved && pkg.exists(rel.resolved)) slides.push({ id: attr(el, "id"), rId: rid, path: rel.resolved });
  }
  return { size: { w: num(sz, "cx", 9144000), h: num(sz, "cy", 6858000) }, slides, defaultTextStyle: kid(root, "defaultTextStyle") };
}

// ---------- placeholders & inheritance ----------
function phOf(node) {
  const ph = path(node, "nvSpPr", "nvPr", "ph") || path(node, "nvPicPr", "nvPr", "ph") || path(node, "nvGraphicFramePr", "nvPr", "ph");
  if (!ph) return null;
  return { type: attr(ph, "type", "obj"), idx: ph.hasAttribute("idx") ? attr(ph, "idx") : null };
}
const masterType = (t) => (t === "title" || t === "ctrTitle" ? "title" : ["sldNum", "dt", "ftr"].includes(t) ? t : "body");
function placeholderShapes(tree) {
  return kids(tree, "sp").map((node) => ({ node, ph: phOf(node) })).filter((s) => s.ph);
}
function findInLayout(layout, ph) {
  if (!ph || !layout) return null;
  if (ph.idx !== null) { const byIdx = layout.phs.find((s) => s.ph.idx === ph.idx); if (byIdx) return byIdx; }
  return layout.phs.find((s) => masterType(s.ph.type) === masterType(ph.type)) || null;
}
function findInMaster(master, ph) {
  if (!ph || !master) return null;
  return master.phs.find((s) => masterType(s.ph.type) === masterType(ph.type)) || null;
}
function xfrmEl(node) {
  switch (node.localName) {
    case "sp": case "pic": case "cxnSp": return path(node, "spPr", "xfrm");
    case "grpSp": return path(node, "grpSpPr", "xfrm");
    case "graphicFrame": return kid(node, "xfrm");
    default: return null;
  }
}
function readXfrm(x) {
  if (!x) return null;
  const off = kid(x, "off"), ext = kid(x, "ext"), chOff = kid(x, "chOff"), chExt = kid(x, "chExt");
  const r = { x: num(off, "x"), y: num(off, "y"), w: num(ext, "cx"), h: num(ext, "cy"), rot: num(x, "rot") / 60000, flipH: bool(x, "flipH"), flipV: bool(x, "flipV") };
  if (chExt) r.child = { x: num(chOff, "x"), y: num(chOff, "y"), w: num(chExt, "cx"), h: num(chExt, "cy") };
  return r;
}

// ---------- text style chain ----------
const PPR_KIDS = ["lnSpc", "spcBef", "spcAft", "buClr", "buSzPct", "buFont"];
function levelProps(chain, lvl) {
  const out = { pPr: {}, rPr: {}, kids: {}, bullet: null };
  for (const item of chain) {
    const lp = kid(item, `lvl${lvl + 1}pPr`);
    if (!lp) continue;
    for (const a of ["algn", "marL", "indent"]) if (out.pPr[a] === undefined && lp.hasAttribute(a)) out.pPr[a] = lp.getAttribute(a);
    for (const n of PPR_KIDS) if (!out.kids[n]) { const k = kid(lp, n); if (k) out.kids[n] = k; }
    if (!out.bullet) { const b = kid(lp, "buNone", "buChar", "buAutoNum"); if (b) out.bullet = b; }
    const d = kid(lp, "defRPr");
    if (d) {
      for (const a of ["sz", "b", "i", "u", "strike", "baseline"]) if (out.rPr[a] === undefined && d.hasAttribute(a)) out.rPr[a] = d.getAttribute(a);
      if (!out.rPr.fill) { const sf = kid(d, "solidFill"); if (sf) out.rPr.fill = sf; }
      if (!out.rPr.latin) { const l = kid(d, "latin"); if (l) out.rPr.latin = attr(l, "typeface"); }
    }
  }
  return out;
}

function spacing(el) {
  const c = kid(el, "spcPct", "spcPts");
  if (!c) return null;
  return c.localName === "spcPct" ? { pct: num(c, "val") / 100000 } : { pts: num(c, "val") / 100 };
}

function readText(txBody, ctx, { ph, fontRefColor }) {
  if (!txBody) return null;
  const chain = [];
  const own = kid(txBody, "lstStyle");
  if (own) chain.push(own);
  let layoutBody = null, masterBody = null;
  if (ph) {
    const l = findInLayout(ctx.layout, ph), m = findInMaster(ctx.master, ph);
    if (l) { const ls = path(l.node, "txBody", "lstStyle"); if (ls) chain.push(ls); layoutBody = path(l.node, "txBody", "bodyPr"); }
    if (m) { const ms = path(m.node, "txBody", "lstStyle"); if (ms) chain.push(ms); masterBody = path(m.node, "txBody", "bodyPr"); }
    const kind = masterType(ph.type);
    const tx = kind === "title" ? ctx.master.titleStyle : kind === "body" ? ctx.master.bodyStyle : ctx.master.otherStyle;
    if (tx) chain.push(tx);
  } else if (ctx.master.otherStyle) chain.push(ctx.master.otherStyle);
  if (ctx.pres.defaultTextStyle) chain.push(ctx.pres.defaultTextStyle);

  const bodyPr = kid(txBody, "bodyPr");
  const bAttr = (name, def) => { for (const b of [bodyPr, layoutBody, masterBody]) if (b && b.hasAttribute(name)) return b.getAttribute(name); return def; };
  let autofit = { type: "none", fontScale: 1 };
  for (const b of [bodyPr, layoutBody, masterBody]) {
    const na = b && kid(b, "normAutofit", "spAutoFit", "noAutofit");
    if (na) { autofit = { type: na.localName === "normAutofit" ? "shrink" : na.localName === "spAutoFit" ? "resize" : "none", fontScale: num(na, "fontScale", 100000) / 100000 }; break; }
  }
  const body = {
    anchor: bAttr("anchor", "t"), wrap: bAttr("wrap", "square"), vert: bAttr("vert", "horz"),
    insets: { l: Number(bAttr("lIns", 91440)), t: Number(bAttr("tIns", 45720)), r: Number(bAttr("rIns", 91440)), b: Number(bAttr("bIns", 45720)) },
    autofit,
  };

  const paragraphs = [];
  const counters = [];
  for (const p of kids(txBody, "p")) {
    const pPr = kid(p, "pPr");
    const level = Math.min(8, num(pPr, "lvl", 0));
    const lp = levelProps(chain, level);
    const pick = (a) => (pPr && pPr.hasAttribute(a) ? pPr.getAttribute(a) : lp.pPr[a]);
    const kidOf = (n) => (pPr && kid(pPr, n)) || lp.kids[n];
    const bu = (pPr && kid(pPr, "buNone", "buChar", "buAutoNum")) || lp.bullet;
    let bullet = { kind: "none" };
    if (bu?.localName === "buChar") bullet = { kind: "char", char: attr(bu, "char", "•") };
    else if (bu?.localName === "buAutoNum") bullet = { kind: "auto", type: attr(bu, "type", "arabicPeriod"), startAt: num(bu, "startAt", 1) };
    counters.length = level + 1;
    if (bullet.kind === "auto") { counters[level] = (counters[level] || bullet.startAt - 1) + 1; bullet.number = counters[level]; } else counters[level] = 0;

    const baseSize = lp.rPr.sz !== undefined ? Number(lp.rPr.sz) : 1800;
    const runs = [];
    const styleOf = (rPr, endPara = false) => {
      const g = (a) => (rPr && rPr.hasAttribute(a) ? rPr.getAttribute(a) : lp.rPr[a]);
      const fillEl = (rPr && kid(rPr, "solidFill")) || lp.rPr.fill;
      let color = fillEl ? resolveColor(kids(fillEl)[0], ctx.theme) : null;
      const link = rPr && kid(rPr, "hlinkClick");
      if (!color && link) color = { hex: ctx.theme.colors.hlink, alpha: 1 };
      if (!color) color = fontRefColor || { hex: ctx.theme.colors[ctx.theme.clrMap.tx1] || "000000", alpha: 1 };
      const face = (rPr && attr(kid(rPr, "latin"), "typeface")) || lp.rPr.latin || "+mn-lt";
      const hl = rPr && kid(rPr, "highlight");
      return {
        size: ((g("sz") !== undefined ? Number(g("sz")) : baseSize) / 100) * autofit.fontScale,
        bold: g("b") === "1" || g("b") === "true", italic: g("i") === "1" || g("i") === "true",
        underline: (g("u") && g("u") !== "none") || !!link, strike: g("strike") && g("strike") !== "noStrike",
        baseline: Number(g("baseline") || 0), color, font: themeFont(ctx.theme, face) || ctx.theme.minor,
        highlight: hl ? resolveColor(kids(hl)[0], ctx.theme) : null, link: !!link, endPara,
      };
    };
    for (const c of kids(p)) {
      // PPTX files produced by editors sometimes contain U+200B in an otherwise
      // empty run. It is a layout workaround, not user content; never surface it
      // as editable text in the canvas or text controls.
      if (c.localName === "r" || c.localName === "fld") runs.push({ text: textOf(kid(c, "t")).replace(/[\u200B\uFEFF]/g, ""), style: styleOf(kid(c, "rPr")) });
      else if (c.localName === "br") runs.push({ text: "\n", style: styleOf(kid(c, "rPr")) });
    }
    const end = styleOf(kid(p, "endParaRPr"), true);
    paragraphs.push({
      level, rtl: pPr?.getAttribute("rtl") === "1" || pPr?.getAttribute("rtl") === "true", algn: pick("algn") || "l", marL: Number(pick("marL") ?? 0), indent: Number(pick("indent") ?? 0),
      bullet, spcBef: spacing(kidOf("spcBef")), spcAft: spacing(kidOf("spcAft")), lnSpc: spacing(kidOf("lnSpc")), runs, end,
      plain: runs.map((r) => r.text).join(""),
    });
  }
  return { paragraphs, body, plain: paragraphs.map((p) => p.plain), isEmpty: paragraphs.every((p) => !p.plain) };
}

// ---------- fill & line ----------
function readGradient(g, ctx, phClr) {
  const stops = kids(kid(g, "gsLst"), "gs").map((gs) => {
    const c = resolveColor(kids(gs)[0], ctx.theme, phClr);
    return c ? { pos: num(gs, "pos") / 100000, ...c } : null;
  }).filter(Boolean);
  if (!stops.length) return { type: "none" };
  const lin = kid(g, "lin");
  return { type: "gradient", stops, angle: lin ? num(lin, "ang") / 60000 : 90, radial: !!kid(g, "path") };
}
function readFillEl(spPr, ctx, phClr) {
  for (const c of kids(spPr)) {
    switch (c.localName) {
      case "noFill": return { type: "none" };
      case "solidFill": { const col = resolveColor(kids(c)[0], ctx.theme, phClr); return col ? { type: "solid", ...col } : { type: "none" }; }
      case "gradFill": return readGradient(c, ctx, phClr);
      case "pattFill": { const col = resolveColor(kids(kid(c, "fgClr"))[0], ctx.theme, phClr); return col ? { type: "solid", ...col, approximated: true } : { type: "none" }; }
      case "blipFill": {
        const blip = kid(c, "blip");
        const rid = blip?.getAttributeNS(NS.r, "embed");
        const rel = rid && ctx.pkg.relById(ctx.slidePath, rid);
        return rel?.resolved ? { type: "image", path: rel.resolved } : { type: "none" };
      }
      default: break;
    }
  }
  return undefined;
}
function readLineEl(spPr, ctx, phClr) {
  const ln = kid(spPr, "ln");
  if (!ln) return undefined;
  const out = { w: ln.hasAttribute("w") ? num(ln, "w") : undefined, dash: attr(kid(ln, "prstDash"), "val", "solid"), tail: attr(kid(ln, "tailEnd"), "type", "none"), head: attr(kid(ln, "headEnd"), "type", "none") };
  const f = readFillEl(ln, ctx, phClr);
  if (f) { if (f.type === "none") out.none = true; else if (f.type === "solid") { out.hex = f.hex; out.alpha = f.alpha; } }
  return out;
}
function shapeStyle(node, ph, ctx) {
  const spPr = kid(node, "spPr");
  const chain = [spPr];
  if (ph) { const l = findInLayout(ctx.layout, ph), m = findInMaster(ctx.master, ph); if (l) chain.push(kid(l.node, "spPr")); if (m) chain.push(kid(m.node, "spPr")); }
  const style = kid(node, "style");
  const refColor = (name) => resolveColor(kids(kid(style, name))[0], ctx.theme);
  let fill, line;
  for (const sp of chain) if (sp && fill === undefined) fill = readFillEl(sp, ctx);
  if (fill === undefined && style) {
    const idx = num(kid(style, "fillRef"), "idx", 0);
    const col = idx > 0 ? refColor("fillRef") : null;
    fill = col ? { type: "solid", ...col } : { type: "none" };
  }
  for (const sp of chain) if (sp && line === undefined) line = readLineEl(sp, ctx);
  const lnRef = style && kid(style, "lnRef");
  const refIdx = num(lnRef, "idx", 0);
  const refCol = lnRef ? refColor("lnRef") : null;
  line = { ...(line || {}) };
  if (!line.none) {
    if (line.hex === undefined && refIdx > 0 && refCol) { line.hex = refCol.hex; line.alpha = refCol.alpha; }
    if (line.w === undefined && refIdx > 0) line.w = ctx.theme.lnWidths[Math.min(refIdx, ctx.theme.lnWidths.length) - 1];
    if (line.hex === undefined) line.none = true;
  }
  const fontRef = style && kid(style, "fontRef");
  return { fill: fill || { type: "none" }, line, fontRefColor: fontRef ? resolveColor(kids(fontRef)[0], ctx.theme) : null };
}

// ---------- geometry ----------
function readGeometry(spPr, wPx, hPx, ctx, id) {
  const cust = spPr && kid(spPr, "custGeom");
  if (cust) {
    const g = customGeometry(cust, wPx, hPx);
    if (g.approximated) ctx.warnings.push({ code: "geometry-approximated", id, message: "Part of a custom shape outline is approximated." });
    return { kind: "custom", paths: g.paths, baseW: wPx, baseH: hPx };
  }
  const pg = spPr && kid(spPr, "prstGeom");
  const prst = attr(pg, "prst", "rect");
  const adj = {};
  for (const gd of kids(kid(pg, "avLst"), "gd")) { const m = /val\s+(-?\d+)/.exec(attr(gd, "fmla", "")); if (m) adj[attr(gd, "name")] = Number(m[1]); }
  const g = presetGeometry(prst, wPx, hPx, adj);
  if (g.approximated) ctx.warnings.push({ code: "geometry-approximated", id, message: `Shape "${prst}" is drawn as a rectangle in the editor (it is preserved in the file).` });
  // baseW/baseH: the size the outline coordinates were computed for, so a live resize preview can scale them.
  return { prst, ...g, baseW: wPx, baseH: hPx };
}

// ---------- element readers ----------
function cNvPrOf(node) {
  return path(node, "nvSpPr", "cNvPr") || path(node, "nvPicPr", "cNvPr") || path(node, "nvGrpSpPr", "cNvPr") || path(node, "nvGraphicFramePr", "cNvPr") || path(node, "nvCxnSpPr", "cNvPr");
}

function baseElement(node, ctx, xf, kind) {
  const c = cNvPrOf(node);
  const ph = phOf(node);
  let xfrm = readXfrm(xfrmEl(node)), inherited = false;
  if (!xfrm && ph) {
    const l = findInLayout(ctx.layout, ph);
    xfrm = l && readXfrm(xfrmEl(l.node));
    if (!xfrm) { const m = findInMaster(ctx.master, ph); xfrm = m && readXfrm(xfrmEl(m.node)); }
    inherited = !!xfrm;
  }
  if (!xfrm) xfrm = { x: 0, y: 0, w: 0, h: 0, rot: 0, flipH: false, flipV: false };
  const b = xf ? xf(xfrm) : xfrm;
  return { id: attr(c, "id", "0"), name: attr(c, "name", ""), descr: attr(c, "descr", ""), kind, node, ph, hidden: bool(c, "hidden"), geometryInherited: inherited,
    x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot, flipH: b.flipH, flipV: b.flipV, child: xfrm.child };
}

function readSp(node, ctx, xf) {
  const el = baseElement(node, ctx, xf, "shape");
  const st = shapeStyle(node, el.ph, ctx);
  const isTxBox = bool(path(node, "nvSpPr", "cNvSpPr"), "txBox");
  const wPx = el.w / EMU_PER_PX, hPx = el.h / EMU_PER_PX;
  el.text = readText(kid(node, "txBody"), ctx, { ph: el.ph, fontRefColor: st.fontRefColor });
  el.fill = st.fill;
  el.line = st.line;
  const spPr = kid(node, "spPr");
  el.geom = readGeometry(spPr, wPx, hPx, ctx, el.id);
  if (el.geom.kind === "line") el.kind = "line";
  else if (isTxBox) el.kind = "text";
  else if (el.ph) el.kind = el.fill.type === "none" ? "text" : "shape";
  return el;
}

function readPic(node, ctx, xf) {
  const el = baseElement(node, ctx, xf, "image");
  const blip = path(node, "blipFill", "blip");
  const rid = blip?.getAttributeNS(NS.r, "embed");
  const linked = blip?.getAttributeNS(NS.r, "link");
  const rel = rid ? ctx.pkg.relById(ctx.slidePath, rid) : null;
  el.imagePath = rel?.resolved || null;
  const ext = el.imagePath ? el.imagePath.slice(el.imagePath.lastIndexOf(".") + 1).toLowerCase() : "";
  el.mime = IMG_MIME[ext] || null;
  if (linked && !rid) ctx.warnings.push({ code: "external-image", id: el.id, message: "An externally linked picture is not loaded (external resources are blocked)." });
  else if (el.imagePath && !el.mime) ctx.warnings.push({ code: "image-format", id: el.id, message: `Picture format .${ext} cannot be displayed in the editor; it is kept in the file.` });
  const src = path(node, "blipFill", "srcRect");
  el.crop = src ? { l: num(src, "l") / 100000, t: num(src, "t") / 100000, r: num(src, "r") / 100000, b: num(src, "b") / 100000 } : null;
  const am = blip && kid(blip, "alphaModFix");
  el.opacity = am ? num(am, "amt", 100000) / 100000 : 1;
  el.geom = readGeometry(kid(node, "spPr"), el.w / EMU_PER_PX, el.h / EMU_PER_PX, ctx, el.id);
  el.line = readLineEl(kid(node, "spPr"), ctx) || { none: true };
  el.alt = attr(cNvPrOf(node), "descr", "");
  return el;
}

function readTable(tbl, ctx) {
  const pr = kid(tbl, "tblPr");
  const cols = kids(kid(tbl, "tblGrid"), "gridCol").map((c) => num(c, "w"));
  let hasMerge = false;
  const rows = kids(tbl, "tr").map((tr) => ({
    h: num(tr, "h"),
    cells: kids(tr, "tc").map((tc) => {
      const merged = tc.hasAttribute("gridSpan") || tc.hasAttribute("rowSpan") || bool(tc, "hMerge") || bool(tc, "vMerge");
      if (merged) hasMerge = true;
      const tcPr = kid(tc, "tcPr");
      const fillEl = tcPr && readFillEl(tcPr, ctx);
      return { text: readText(kid(tc, "txBody"), ctx, { ph: null }), gridSpan: num(tc, "gridSpan", 1), rowSpan: num(tc, "rowSpan", 1), hMerge: bool(tc, "hMerge"), vMerge: bool(tc, "vMerge"), fill: fillEl, anchor: tcPr && tcPr.getAttribute("anchor") || "t" };
    }),
  }));
  return { cols, rows, hasMerge, firstRow: bool(pr, "firstRow"), lastRow: bool(pr, "lastRow"), firstCol: bool(pr, "firstCol"), lastCol: bool(pr, "lastCol"), bandRow: bool(pr, "bandRow"), bandCol: bool(pr, "bandCol"), accent: { hex: ctx.theme.colors.accent1, alpha: 1 } };
}

/** Cached series data of a bar/line/pie chart, for a clearly labelled view-only preview. */
function chartPreview(plotChild, theme) {
  const kind = plotChild.localName.replace(/3D$/, "");
  const shape = kind === "barChart" ? (attr(kid(plotChild, "barDir"), "val", "col") === "bar" ? "hbar" : "col") : kind === "lineChart" || kind === "areaChart" ? "line" : kind === "pieChart" || kind === "doughnutChart" ? "pie" : null;
  if (!shape) return null;
  const pts = (holder) => {
    const cache = holder && (kid(kid(holder, "numRef", "strRef"), "numCache", "strCache") || kid(holder, "numLit", "strLit"));
    return kids(cache, "pt").sort((a, b) => num(a, "idx") - num(b, "idx")).map((p) => textOf(kid(p, "v")));
  };
  const series = kids(plotChild, "ser").slice(0, 6).map((ser, i) => {
    const fill = path(ser, "spPr", "solidFill");
    const col = (fill && resolveColor(kids(fill)[0], theme)) || { hex: theme.colors[`accent${(i % 6) + 1}`] };
    return { name: textOf(descendants(kid(ser, "tx"), "v")[0]), values: pts(kid(ser, "val")).map((v) => Number(v) || 0), color: col.hex };
  });
  if (!series.length || !series[0].values.length) return null;
  const first = kids(plotChild, "ser")[0];
  return { shape, series, categories: pts(kid(first, "cat")).slice(0, 24) };
}

function readFrame(node, ctx, xf) {
  const el = baseElement(node, ctx, xf, "object");
  const gd = path(node, "graphic", "graphicData");
  const uri = attr(gd, "uri", "");
  if (uri.includes(URI.table)) {
    const tbl = kid(gd, "tbl");
    el.kind = "table";
    if (tbl) el.table = readTable(tbl, ctx);
  } else if (uri.includes(URI.chart)) {
    el.kind = "chart";
    const rid = kid(gd, "chart")?.getAttributeNS(NS.r, "id");
    const rel = rid && ctx.pkg.relById(ctx.slidePath, rid);
    const cd = rel?.resolved && ctx.pkg.doc(rel.resolved);
    let type = "chart", title = "", preview = null;
    if (cd) {
      const plot = path(cd.documentElement, "chart", "plotArea");
      const t = kids(plot).find((k) => /Chart$/.test(k.localName));
      if (t) { type = t.localName.replace(/Chart$/, "").replace(/3D$/, "") + " chart"; preview = chartPreview(t, ctx.theme); }
      const te = path(cd.documentElement, "chart", "title");
      title = te ? descendants(te, "t").map(textOf).join(" ").trim() : "";
    }
    el.chartInfo = { type, title, preview };
    ctx.warnings.push({ code: "chart-view-only", id: el.id, message: "Charts are preserved and can be moved or resized, but their data cannot be edited here." });
  } else if (uri.includes(URI.diagram)) {
    el.kind = "diagram";
    ctx.warnings.push({ code: "smartart-view-only", id: el.id, message: "SmartArt is preserved and can be moved or resized, but not edited here." });
  } else {
    el.kind = "object";
    ctx.warnings.push({ code: "object-view-only", id: el.id, message: "An embedded object is preserved but cannot be displayed or edited here." });
  }
  return el;
}

function readCxn(node, ctx, xf) {
  const el = baseElement(node, ctx, xf, "line");
  const st = shapeStyle(node, null, ctx);
  el.line = st.line;
  el.fill = { type: "none" };
  el.geom = { kind: "line" };
  return el;
}

function readGroup(node, ctx, xf) {
  const el = baseElement(node, ctx, xf, "group");
  const own = readXfrm(xfrmEl(node)) || { x: 0, y: 0, w: 0, h: 0, rot: 0, flipH: false, flipV: false };
  const ch = own.child || { x: own.x, y: own.y, w: own.w, h: own.h };
  const sx = ch.w ? own.w / ch.w : 1, sy = ch.h ? own.h / ch.h : 1;
  const gcx = own.x + own.w / 2, gcy = own.y + own.h / 2, th = (own.rot * Math.PI) / 180;
  const into = (b) => {
    let x = own.x + (b.x - ch.x) * sx, y = own.y + (b.y - ch.y) * sy, w = b.w * sx, h = b.h * sy;
    let cx = x + w / 2, cy = y + h / 2, flipH = b.flipH, flipV = b.flipV, rot = b.rot;
    if (own.flipH) { cx = 2 * gcx - cx; flipH = !flipH; }
    if (own.flipV) { cy = 2 * gcy - cy; flipV = !flipV; }
    if (th) { const dx = cx - gcx, dy = cy - gcy; cx = gcx + dx * Math.cos(th) - dy * Math.sin(th); cy = gcy + dx * Math.sin(th) + dy * Math.cos(th); rot += own.rot; }
    return { x: cx - w / 2, y: cy - h / 2, w, h, rot, flipH, flipV };
  };
  const composed = (b) => (xf ? xf(into(b)) : into(b));
  el.children = readTree(node, ctx, composed);
  return el;
}

function readTree(parent, ctx, xf) {
  const out = [];
  const visit = (node) => {
    switch (node.localName) {
      case "sp": out.push(readSp(node, ctx, xf)); break;
      case "pic": out.push(readPic(node, ctx, xf)); break;
      case "grpSp": out.push(readGroup(node, ctx, xf)); break;
      case "graphicFrame": out.push(readFrame(node, ctx, xf)); break;
      case "cxnSp": out.push(readCxn(node, ctx, xf)); break;
      case "AlternateContent": {
        const choice = kid(kid(node, "Choice") || node, "sp", "pic", "grpSp", "graphicFrame");
        const target = kid(node, "Fallback") ? kids(kid(node, "Fallback"), "sp", "pic", "grpSp", "graphicFrame")[0] : choice;
        const first = target || choice;
        if (first) {
          const el = baseElement(first, ctx, xf, "object");
          el.node = node; el.alternate = true; el.readOnlyGeometry = true;
          el.fill = { type: "none" }; el.line = { none: true }; el.geom = { kind: "rect" };
          ctx.warnings.push({ code: "alternate-content", id: el.id, message: "A compatibility object (e.g. 3D model or equation) is preserved but cannot be edited here." });
          out.push(el);
        }
        break;
      }
      default: break;
    }
  };
  for (const n of kids(parent)) visit(n);
  return out;
}

function readBackground(cSld, ctx, layoutCSld, masterCSld) {
  for (const cs of [cSld, layoutCSld, masterCSld]) {
    const bg = cs && kid(cs, "bg");
    if (!bg) continue;
    const pr = kid(bg, "bgPr");
    if (pr) { const f = readFillEl(pr, ctx); if (f) return f; }
    const ref = kid(bg, "bgRef");
    if (ref) { const col = resolveColor(kids(ref)[0], ctx.theme); if (col) return { type: "solid", ...col }; }
  }
  return { type: "solid", hex: ctx.theme.colors[ctx.theme.clrMap.bg1] || "FFFFFF", alpha: 1 };
}

function paths(pkg, slidePath) {
  const layout = pkg.relsOfType(slidePath, REL.slideLayout)[0]?.resolved;
  const master = layout && pkg.relsOfType(layout, REL.slideMaster)[0]?.resolved;
  return { layout: layout && pkg.exists(layout) ? layout : null, master: master && pkg.exists(master) ? master : null };
}

export function layoutPathOf(pkg, slidePath) { return paths(pkg, slidePath).layout; }

/** Build the render/UI model for one slide. */
export function readSlide(pkg, slidePath, presentation = readPresentation(pkg)) {
  const { layout: layoutPath, master: masterPath } = paths(pkg, slidePath);
  const theme = (pkg.cache ||= new Map()).get(`theme:${masterPath}`) || (() => { const t = loadTheme(pkg, masterPath); pkg.cache.set(`theme:${masterPath}`, t); return t; })();
  const sld = pkg.doc(slidePath).documentElement;
  const cSld = kid(sld, "cSld");
  const layoutDoc = layoutPath && pkg.doc(layoutPath), masterDoc = masterPath && pkg.doc(masterPath);
  const layoutTree = layoutDoc && path(layoutDoc.documentElement, "cSld", "spTree");
  const masterTree = masterDoc && path(masterDoc.documentElement, "cSld", "spTree");
  const txStyles = masterDoc && kid(masterDoc.documentElement, "txStyles");
  const ctx = {
    pkg, slidePath, theme, warnings: [], pres: presentation,
    layout: layoutTree ? { phs: placeholderShapes(layoutTree), tree: layoutTree } : null,
    master: { phs: masterTree ? placeholderShapes(masterTree) : [], tree: masterTree, titleStyle: txStyles && kid(txStyles, "titleStyle"), bodyStyle: txStyles && kid(txStyles, "bodyStyle"), otherStyle: txStyles && kid(txStyles, "otherStyle") },
  };
  const background = readBackground(cSld, ctx, layoutDoc && kid(layoutDoc.documentElement, "cSld"), masterDoc && kid(masterDoc.documentElement, "cSld"));
  const showMaster = attr(sld, "showMasterSp", "1") !== "0" && (!layoutDoc || attr(layoutDoc.documentElement, "showMasterSp", "1") !== "0");
  const under = [];
  // Layout/master artwork is drawn behind the slide (images resolve against their own part).
  const underCtxFor = (partPath, tree) => { if (!tree) return []; const c = { ...ctx, slidePath: partPath, warnings: [] }; return readTree(tree, c, null).filter((e) => !e.ph); };
  const masterArt = showMaster && masterTree ? underCtxFor(masterPath, masterTree) : [];
  const layoutArt = layoutTree ? underCtxFor(layoutPath, layoutTree) : [];
  for (const e of masterArt) { e.owner = masterPath; under.push(e); }
  for (const e of layoutArt) { e.owner = layoutPath; under.push(e); }
  const elements = readTree(path(sld, "cSld", "spTree"), ctx, null);
  // Duplicate shape ids exist in the wild (PptxGenJS); give each top-level object a unique key matching ops.keyedNodes.
  const seen = new Map();
  for (const e of elements) { const k = seen.get(e.id) || 0; seen.set(e.id, k + 1); if (k) e.id = `${e.id}~${k}`; }
  return { path: slidePath, layoutPath, masterPath, size: presentation.size, background, under, elements, warnings: ctx.warnings, theme };
}

export function flattenElements(elements, out = []) {
  for (const e of elements) { out.push(e); if (e.children) flattenElements(e.children, out); }
  return out;
}

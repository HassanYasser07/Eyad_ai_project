/**
 * Minimal, dependency-free XML helpers for OOXML parts.
 * Works with the browser DOMParser/XMLSerializer and, in unit tests, with an
 * injected implementation (see setXmlImpl). Only namespace-aware traversal is
 * used — no querySelector — so both implementations behave identically.
 */
export const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
};

let impl = { DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer };
export function setXmlImpl(next) { impl = { ...impl, ...next }; }

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

export class PptxError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export function parseXml(text, label = "part") {
  // Entity declarations enable expansion attacks; OOXML never needs a DOCTYPE.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new PptxError("XML_DOCTYPE", `${label}: DOCTYPE/ENTITY not allowed`);
  let doc;
  try {
    doc = new impl.DOMParser().parseFromString(text, "application/xml");
  } catch (err) {
    throw new PptxError("XML_PARSE", `${label}: ${err?.message || "invalid XML"}`);
  }
  if (!doc || !doc.documentElement) throw new PptxError("XML_PARSE", `${label}: empty document`);
  if (doc.getElementsByTagName("parsererror").length) throw new PptxError("XML_PARSE", `${label}: invalid XML`);
  return doc;
}

export function serializeXml(doc) {
  const body = new impl.XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, "");
  return XML_DECL + body;
}

/** Element children of `el`, optionally filtered by local name(s). */
export function kids(el, ...names) {
  const out = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue;
    if (names.length && !names.includes(n.localName)) continue;
    out.push(n);
  }
  return out;
}
export function kid(el, ...names) { return kids(el, ...names)[0] || null; }
/** Walk a path of local names: path(el, "spPr", "xfrm", "off"). */
export function path(el, ...names) {
  let cur = el;
  for (const name of names) { cur = kid(cur, name); if (!cur) return null; }
  return cur;
}
export function descendants(el, name) {
  const out = [];
  const walk = (n) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      if (c.localName === name) out.push(c);
      walk(c);
    }
  };
  if (el) walk(el);
  return out;
}
export function attr(el, name, fallback = null) {
  if (!el || !el.hasAttribute(name)) return fallback;
  return el.getAttribute(name);
}
export function num(el, name, fallback = 0) {
  const v = attr(el, name);
  if (v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
export function bool(el, name, fallback = false) {
  const v = attr(el, name);
  if (v === null) return fallback;
  return v === "1" || v === "true";
}
export function textOf(el) {
  let s = "";
  for (let n = el?.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 || n.nodeType === 4) s += n.nodeValue;
  return s;
}

export function create(doc, prefix, local, attrs = {}) {
  const el = doc.createElementNS(NS[prefix], `${prefix}:${local}`);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  return el;
}

/**
 * Insert `child` into `parent` honouring the OOXML schema sequence `order`
 * (array of local names). Replaces an existing child of the same local name
 * when `replace` is set. Wrong child order makes PowerPoint report a repair.
 */
export function insertOrdered(parent, child, order, { replace = false } = {}) {
  if (replace) for (const old of kids(parent, child.localName)) parent.removeChild(old);
  const rank = (name) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  const myRank = rank(child.localName);
  let ref = null;
  for (const c of kids(parent)) { if (rank(c.localName) > myRank) { ref = c; break; } }
  parent.insertBefore(child, ref);
  return child;
}

export const ORDER = {
  spPr: ["xfrm", "custGeom", "prstGeom", "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "ln", "effectLst", "effectDag", "scene3d", "sp3d", "extLst"],
  grpSpPr: ["xfrm", "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "effectLst", "effectDag", "scene3d", "extLst"],
  rPr: ["ln", "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "effectLst", "effectDag", "highlight", "uLnTx", "uLn", "uFillTx", "uFill", "latin", "ea", "cs", "sym", "hlinkClick", "hlinkMouseOver", "rtl", "extLst"],
  pPr: ["lnSpc", "spcBef", "spcAft", "buClrTx", "buClr", "buSzTx", "buSzPct", "buSzPts", "buFontTx", "buFont", "buNone", "buAutoNum", "buChar", "buBlip", "tabLst", "defRPr", "extLst"],
  ln: ["noFill", "solidFill", "gradFill", "pattFill", "prstDash", "custDash", "round", "bevel", "miter", "headEnd", "tailEnd", "extLst"],
  bodyPr: ["prstTxWarp", "noAutofit", "normAutofit", "spAutoFit", "scene3d", "sp3d", "flatTx", "extLst"],
  blip: ["alphaBiLevel", "alphaCeiling", "alphaFloor", "alphaInv", "alphaMod", "alphaModFix", "alphaRepl", "biLevel", "blur", "clrChange", "clrRepl", "duotone", "fillOverlay", "grayscl", "hsl", "lum", "tint", "extLst"],
};

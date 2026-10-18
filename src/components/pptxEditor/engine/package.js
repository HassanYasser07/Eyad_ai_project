/**
 * OPC (zip) package layer for .pptx files.
 *
 * Design: the original archive is kept untouched. Parts the user edits are
 * parsed to DOM, mutated inside a transaction and re-serialized; every other
 * part is copied through byte-for-byte on export (masters, layouts, themes,
 * notes, charts, embedded fonts, animations in untouched slides, ...). That is
 * what keeps round-trips faithful — nothing is regenerated from a lossy model.
 */
import JSZip from "jszip";
import { NS, PptxError, parseXml, serializeXml, kids, attr, create } from "./xml.js";

export const LIMITS = {
  maxFileBytes: 100 * 1024 * 1024,
  maxEntries: 10000,
  maxUncompressedBytes: 600 * 1024 * 1024,
  maxXmlPartBytes: 30 * 1024 * 1024,
};

export const REL = {
  slide: `${NS.r}/slide`,
  slideLayout: `${NS.r}/slideLayout`,
  slideMaster: `${NS.r}/slideMaster`,
  theme: `${NS.r}/theme`,
  image: `${NS.r}/image`,
  notesSlide: `${NS.r}/notesSlide`,
  chart: `${NS.r}/chart`,
  hyperlink: `${NS.r}/hyperlink`,
};

export const CT = {
  slide: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
};

export function dirname(p) { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); }
export function basename(p) { return p.slice(p.lastIndexOf("/") + 1); }
export function relsPathFor(part) {
  if (part === "/" || part === "") return "_rels/.rels";
  const dir = dirname(part);
  return `${dir ? dir + "/" : ""}_rels/${basename(part)}.rels`;
}
export function partForRels(relsPath) {
  if (relsPath === "_rels/.rels") return "/";
  const m = relsPath.match(/^(.*)_rels\/(.+)\.rels$/);
  return m ? `${m[1]}${m[2]}` : null;
}
export function resolveTarget(fromPart, target) {
  if (target.startsWith("/")) return normalize(target.slice(1));
  const base = fromPart === "/" ? "" : dirname(fromPart);
  return normalize(base ? `${base}/${target}` : target);
}
function normalize(p) {
  const out = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop(); else out.push(seg);
  }
  return out.join("/");
}
export function relativeTarget(fromPart, toPart) {
  const from = dirname(fromPart).split("/").filter(Boolean);
  const to = toPart.split("/");
  while (from.length && to.length > 1 && from[0] === to[0]) { from.shift(); to.shift(); }
  return [...from.map(() => ".."), ...to].join("/");
}

const isXmlName = (n) => /\.(xml|rels)$/i.test(n);
const encoder = new TextEncoder();

export class PptxPackage {
  static async open(input, { fileName = "presentation.pptx" } = {}) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length === 0) throw new PptxError("EMPTY_FILE", "The file is empty.");
    if (bytes.length > LIMITS.maxFileBytes) throw new PptxError("FILE_TOO_LARGE", "The file is too large.");
    const sig = (...b) => b.every((v, i) => bytes[i] === v);
    if (sig(0xd0, 0xcf, 0x11, 0xe0)) {
      throw new PptxError("LEGACY_OR_ENCRYPTED", "This is a legacy .ppt or a password-protected file. Save it as an unprotected .pptx first.");
    }
    if (!sig(0x50, 0x4b)) throw new PptxError("NOT_A_ZIP", "This is not a valid .pptx file.");

    let zip;
    try { zip = await JSZip.loadAsync(bytes); } catch { throw new PptxError("ZIP_CORRUPT", "The file is damaged and could not be opened."); }
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    if (names.length > LIMITS.maxEntries) throw new PptxError("TOO_MANY_ENTRIES", "The file contains too many parts.");
    let total = 0;
    for (const n of names) {
      const size = zip.files[n]._data?.uncompressedSize;
      if (typeof size === "number") {
        total += size;
        if (isXmlName(n) && size > LIMITS.maxXmlPartBytes) throw new PptxError("PART_TOO_LARGE", "The file contains an oversized XML part.");
      }
    }
    if (total > LIMITS.maxUncompressedBytes) throw new PptxError("ZIP_BOMB", "The file expands to an unreasonable size.");
    if (!zip.file("[Content_Types].xml") || !zip.file("ppt/presentation.xml")) {
      throw new PptxError("NOT_PPTX", "This file is not a PowerPoint presentation.");
    }

    const text = new Map();
    for (const n of names) if (isXmlName(n) || n === "[Content_Types].xml") text.set(n, await zip.file(n).async("string"));
    const ct = text.get("[Content_Types].xml");
    if (/macroEnabled/i.test(ct) || zip.file("ppt/vbaProject.bin")) {
      throw new PptxError("MACRO_ENABLED", "Macro-enabled presentations (.pptm) are not supported. Macros are never run.");
    }
    return new PptxPackage({ zip, names, text, fileName, size: bytes.length });
  }

  constructor({ zip, names, text, fileName, size }) {
    this.zip = zip;
    this.fileName = fileName;
    this.size = size;
    this.order = names.slice();
    this.originalNames = new Set(names);
    this.originalText = new Map(text);
    this.text = new Map(text);
    this.docs = new Map();
    this.dirtyDocs = new Set();
    this.bin = new Map();
    this.deleted = new Set();
    this.flags = { slidesDeleted: false };
    this.undoStack = [];
    this.redoStack = [];
    this.tx = null;
    this.version = 0;
    this.savedVersion = 0;
    this.listeners = new Set();
    this.maxHistory = 200;
    this.revs = new Map();
  }
  /** Per-part change counter; lets thumbnails re-render only when their own slide changed. */
  rev(path) { return this.revs.get(path) || 0; }
  bumpRev(path) { this.revs.set(path, (this.revs.get(path) || 0) + 1); }

  // ----- observation -----
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { for (const fn of this.listeners) fn(this.version); }
  get isDirty() { return this.version !== this.savedVersion; }
  markSaved() { this.savedVersion = this.version; this.notify(); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  // ----- reading -----
  exists(path) {
    if (this.deleted.has(path)) return false;
    return this.text.has(path) || this.bin.has(path) || this.originalNames.has(path);
  }
  /** Parsed DOM of an XML part (cached). Treat as read-only unless inside `edit`. */
  doc(path) {
    if (this.docs.has(path)) return this.docs.get(path);
    const raw = this.text.get(path);
    if (raw === undefined || this.deleted.has(path)) return null;
    const d = parseXml(raw, path);
    this.docs.set(path, d);
    return d;
  }
  async bytes(path) {
    if (this.bin.has(path)) return this.bin.get(path);
    const f = this.zip.file(path);
    if (!f || this.deleted.has(path)) return null;
    return f.async("uint8array");
  }
  readRels(part) {
    const d = this.doc(relsPathFor(part));
    if (!d) return [];
    return kids(d.documentElement, "Relationship").map((el) => {
      const mode = attr(el, "TargetMode", "Internal");
      const target = attr(el, "Target", "");
      return {
        id: attr(el, "Id"), type: attr(el, "Type", ""), target, mode,
        resolved: mode === "External" ? null : resolveTarget(part, target),
      };
    });
  }
  relById(part, id) { return this.readRels(part).find((r) => r.id === id) || null; }
  relsOfType(part, type) { return this.readRels(part).filter((r) => r.type === type); }

  // ----- transactions / history -----
  snapshotText(path) {
    if (this.dirtyDocs.has(path)) return serializeXml(this.docs.get(path));
    return this.text.has(path) ? this.text.get(path) : null;
  }
  touch(path) {
    if (!this.tx) throw new PptxError("NO_TX", "Edits must run inside a transaction.");
    if (!this.tx.before.has(path)) this.tx.before.set(path, this.snapshotText(path));
  }
  /** Get a DOM for mutation. Must be inside transact(); marks the part changed. */
  edit(path) {
    const d = this.doc(path);
    if (!d) throw new PptxError("PART_MISSING", `Missing part ${path}`);
    this.touch(path);
    this.dirtyDocs.add(path);
    return d;
  }
  createPart(path, xml) {
    this.touch(path);
    this.deleted.delete(path);
    this.docs.delete(path);
    this.dirtyDocs.delete(path);
    this.text.set(path, xml);
    if (!this.originalNames.has(path) && !this.order.includes(path)) this.order.push(path);
  }
  putBinary(path, bytes) {
    this.touch(path);
    this.deleted.delete(path);
    this.bin.set(path, bytes);
    this.tx.bin.set(path, bytes);
    if (!this.originalNames.has(path) && !this.order.includes(path)) this.order.push(path);
  }
  deletePart(path) {
    if (!this.exists(path)) return;
    this.touch(path);
    this.text.delete(path);
    this.docs.delete(path);
    this.dirtyDocs.delete(path);
    this.bin.delete(path);
    this.deleted.add(path);
    // A part must never leave a content-type override behind (LibreOffice even writes them for .rels files).
    const ct = this.doc("[Content_Types].xml");
    if (kids(ct.documentElement, "Override").some((e) => attr(e, "PartName") === `/${path}`)) this.removeOverride(path);
  }
  /** Run `fn` as one undoable step. Throws → everything is rolled back. */
  transact(label, fn) {
    if (this.tx) return fn();
    this.tx = { label, before: new Map(), bin: new Map() };
    let result;
    try {
      result = fn();
      this.commit();
    } catch (err) {
      this.rollback();
      throw err;
    }
    return result;
  }
  commit() {
    const tx = this.tx;
    this.tx = null;
    const changes = [];
    for (const [path, before] of tx.before) {
      let after;
      if (this.dirtyDocs.has(path)) {
        after = serializeXml(this.docs.get(path));
        this.text.set(path, after);
        this.dirtyDocs.delete(path);
      } else if (this.deleted.has(path)) after = null;
      else after = this.text.has(path) ? this.text.get(path) : null;
      const bin = tx.bin.get(path) || null;
      if (before === after && !bin) continue;
      changes.push({ path, before, after, bin });
      this.bumpRev(path);
    }
    if (!changes.length) return;
    if (changes.some((c) => c.path.startsWith("ppt/slides/slide") && c.after === null && !c.path.includes("_rels"))) this.flags.slidesDeleted = true;
    this.undoStack.push({ label: tx.label, changes });
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
    this.version += 1;
    this.notify();
  }
  rollback() {
    const tx = this.tx;
    this.tx = null;
    if (!tx) return;
    for (const [path, before] of tx.before) this.applyText(path, before);
    for (const path of tx.bin.keys()) this.bin.delete(path);
  }
  applyText(path, value) {
    this.docs.delete(path);
    this.dirtyDocs.delete(path);
    if (value === null) {
      this.text.delete(path);
      this.bin.delete(path);
      if (this.originalNames.has(path)) this.deleted.add(path);
    } else {
      this.text.set(path, value);
      this.deleted.delete(path);
      if (!this.originalNames.has(path) && !this.order.includes(path)) this.order.push(path);
    }
  }
  undo() {
    const rec = this.undoStack.pop();
    if (!rec) return null;
    for (const c of rec.changes) {
      this.bumpRev(c.path);
      if (c.bin) { this.bin.delete(c.path); if (c.before === null) this.deleted.add(c.path); continue; }
      this.applyText(c.path, c.before);
    }
    this.redoStack.push(rec);
    this.version += 1;
    this.notify();
    return rec;
  }
  redo() {
    const rec = this.redoStack.pop();
    if (!rec) return null;
    for (const c of rec.changes) {
      this.bumpRev(c.path);
      if (c.bin) { this.deleted.delete(c.path); this.bin.set(c.path, c.bin); continue; }
      this.applyText(c.path, c.after);
    }
    this.undoStack.push(rec);
    this.version += 1;
    this.notify();
    return rec;
  }

  // ----- relationships & content types (inside transact) -----
  addRel(part, type, targetPart, { external = false } = {}) {
    const relsPath = relsPathFor(part);
    if (!this.exists(relsPath)) {
      this.createPart(relsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="${NS.rel}"/>`);
    }
    const d = this.edit(relsPath);
    const root = d.documentElement;
    let max = 0;
    for (const el of kids(root, "Relationship")) {
      const m = /^rId(\d+)$/.exec(attr(el, "Id", ""));
      if (m) max = Math.max(max, Number(m[1]));
    }
    const id = `rId${max + 1}`;
    const el = d.createElementNS(NS.rel, "Relationship");
    el.setAttribute("Id", id);
    el.setAttribute("Type", type);
    el.setAttribute("Target", external ? targetPart : relativeTarget(part, targetPart));
    if (external) el.setAttribute("TargetMode", "External");
    root.appendChild(el);
    return id;
  }
  removeRel(part, id) {
    const relsPath = relsPathFor(part);
    if (!this.exists(relsPath)) return;
    const d = this.edit(relsPath);
    for (const el of kids(d.documentElement, "Relationship")) if (attr(el, "Id") === id) d.documentElement.removeChild(el);
  }
  ensureDefault(ext, contentType) {
    const d0 = this.doc("[Content_Types].xml");
    const has = kids(d0.documentElement, "Default").some((e) => attr(e, "Extension", "").toLowerCase() === ext.toLowerCase());
    if (has) return;
    const d = this.edit("[Content_Types].xml");
    const el = d.createElementNS(NS.ct, "Default");
    el.setAttribute("Extension", ext);
    el.setAttribute("ContentType", contentType);
    d.documentElement.insertBefore(el, d.documentElement.firstChild);
  }
  setOverride(partName, contentType) {
    const d = this.edit("[Content_Types].xml");
    for (const e of kids(d.documentElement, "Override")) if (attr(e, "PartName") === `/${partName}`) d.documentElement.removeChild(e);
    const el = d.createElementNS(NS.ct, "Override");
    el.setAttribute("PartName", `/${partName}`);
    el.setAttribute("ContentType", contentType);
    d.documentElement.appendChild(el);
  }
  removeOverride(partName) {
    const d = this.edit("[Content_Types].xml");
    for (const e of kids(d.documentElement, "Override")) if (attr(e, "PartName") === `/${partName}`) d.documentElement.removeChild(e);
  }
  contentTypeOf(partName) {
    const d = this.doc("[Content_Types].xml");
    const ov = kids(d.documentElement, "Override").find((e) => attr(e, "PartName") === `/${partName}`);
    if (ov) return attr(ov, "ContentType");
    const ext = partName.slice(partName.lastIndexOf(".") + 1).toLowerCase();
    const df = kids(d.documentElement, "Default").find((e) => attr(e, "Extension", "").toLowerCase() === ext);
    return df ? attr(df, "ContentType") : null;
  }

  // ----- integrity & export -----
  reachableParts() {
    const seen = new Set();
    const queue = ["/"];
    while (queue.length) {
      const part = queue.pop();
      for (const rel of this.readRels(part)) {
        if (!rel.resolved || seen.has(rel.resolved)) continue;
        if (!this.exists(rel.resolved)) continue;
        seen.add(rel.resolved);
        queue.push(rel.resolved);
      }
    }
    return seen;
  }
  /** Structural problems that would make PowerPoint "repair" or drop content. */
  validate() {
    const problems = [];
    const live = this.liveNames();
    const partNames = new Set(live);
    for (const name of live) {
      if (!name.endsWith(".rels")) continue;
      const src = partForRels(name);
      if (src && src !== "/" && !partNames.has(src)) problems.push(`orphan relationships file ${name}`);
      for (const rel of this.readRels(src)) {
        if (rel.resolved && !partNames.has(rel.resolved)) problems.push(`${src}: ${rel.id} -> missing ${rel.resolved}`);
      }
    }
    const ct = this.doc("[Content_Types].xml");
    for (const e of kids(ct.documentElement, "Override")) {
      const pn = attr(e, "PartName", "").replace(/^\//, "");
      if (!partNames.has(pn)) problems.push(`content type override for missing part ${pn}`);
    }
    for (const name of live) {
      if (name === "[Content_Types].xml" || name.endsWith(".rels")) continue;
      if (!this.contentTypeOf(name)) problems.push(`no content type for ${name}`);
    }
    return problems;
  }
  liveNames() {
    return this.order.filter((n) => !this.deleted.has(n) && (this.text.has(n) || this.bin.has(n) || this.originalNames.has(n)));
  }
  isModified(name) {
    if (this.bin.has(name)) return true;
    if (!this.originalNames.has(name)) return true;
    return this.originalText.has(name) && this.originalText.get(name) !== this.text.get(name);
  }
  async exportBytes({ compression = "DEFLATE" } = {}) {
    if (this.tx) throw new PptxError("TX_OPEN", "Cannot export during an edit.");
    const reachable = this.reachableParts();
    const prunable = (n) => !this.originalNames.has(n) || this.flags.slidesDeleted;
    const keep = [];
    for (const name of this.liveNames()) {
      if (name === "[Content_Types].xml") { keep.push(name); continue; }
      if (name.endsWith(".rels")) {
        const src = partForRels(name);
        if (src === "/" || (reachable.has(src) || !prunable(src))) keep.push(name);
        continue;
      }
      if (reachable.has(name) || !prunable(name)) keep.push(name);
    }
    const keepSet = new Set(keep);
    // Content types: drop overrides for parts that were pruned.
    let ctText = this.text.get("[Content_Types].xml");
    const ctDoc = parseXml(ctText, "[Content_Types].xml");
    let ctChanged = false;
    for (const e of kids(ctDoc.documentElement, "Override")) {
      if (!keepSet.has(attr(e, "PartName", "").replace(/^\//, ""))) { ctDoc.documentElement.removeChild(e); ctChanged = true; }
    }
    if (ctChanged) ctText = serializeXml(ctDoc);

    const out = new JSZip();
    const ordered = ["[Content_Types].xml", ...keep.filter((n) => n !== "[Content_Types].xml")];
    for (const name of ordered) {
      const opts = { compression, compressionOptions: { level: 6 } };
      if (name === "[Content_Types].xml") out.file(name, ctChanged ? ctText : (this.isModified(name) ? this.text.get(name) : await this.zip.file(name).async("uint8array")), opts);
      else if (this.bin.has(name)) out.file(name, this.bin.get(name), opts);
      else if (this.isModified(name)) out.file(name, encoder.encode(this.text.get(name)), opts);
      else out.file(name, await this.zip.file(name).async("uint8array"), opts);
    }
    return out.generateAsync({ type: "uint8array", compression, compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  }
}
export { create };

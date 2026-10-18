/** Slide-level operations: add / duplicate / delete / reorder. All undoable. */
import { NS, kid, kids, path, attr, num, create, descendants, PptxError } from "./xml.js";
import { REL, CT, dirname, basename, relsPathFor, relativeTarget } from "./package.js";
import { readPresentation } from "./slideModel.js";

const PRES = "ppt/presentation.xml";

function newSlidePath(pkg) {
  let max = 0;
  for (const n of [...pkg.order, ...pkg.originalNames]) { const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(n); if (m) max = Math.max(max, Number(m[1])); }
  return `ppt/slides/slide${max + 1}.xml`;
}
/** PowerPoint repairs files whose section list disagrees with the slide list, so drop it on structural change. */
function dropSections(doc) {
  const ext = descendants(doc.documentElement, "ext").filter((e) => kids(e).some((k) => k.localName === "sectionLst"));
  for (const e of ext) e.parentNode.removeChild(e);
  const lst = kid(doc.documentElement, "extLst");
  if (lst && !kids(lst).length) doc.documentElement.removeChild(lst);
}
function insertSlideRef(pkg, newPath, afterIndex) {
  const doc = pkg.edit(PRES);
  const root = doc.documentElement;
  let lst = kid(root, "sldIdLst");
  if (!lst) {
    lst = create(doc, "p", "sldIdLst");
    const anchor = kid(root, "sldMasterIdLst");
    root.insertBefore(lst, anchor ? anchor.nextSibling : root.firstChild);
  }
  const ids = kids(lst, "sldId");
  const nextId = Math.max(255, ...ids.map((e) => num(e, "id", 0))) + 1;
  const rid = pkg.addRel(PRES, REL.slide, newPath);
  const el = create(doc, "p", "sldId", { id: nextId });
  el.setAttributeNS(NS.r, "r:id", rid);
  lst.insertBefore(el, ids[afterIndex] ? ids[afterIndex].nextSibling : null);
  dropSections(doc);
}

export function listLayouts(pkg) {
  const out = [];
  const seen = new Set();
  for (const m of pkg.relsOfType(PRES, REL.slideMaster)) {
    for (const l of pkg.relsOfType(m.resolved, REL.slideLayout)) {
      if (seen.has(l.resolved) || !pkg.exists(l.resolved)) continue;
      seen.add(l.resolved);
      const d = pkg.doc(l.resolved);
      out.push({ path: l.resolved, name: attr(path(d.documentElement, "cSld"), "name", basename(l.resolved)) });
    }
  }
  return out;
}

const TEXT_PH = ["title", "ctrTitle", "subTitle", "body", "obj"];
function blankSlideXml(pkg, layoutPath) {
  const ld = pkg.doc(layoutPath);
  const tree = path(ld.documentElement, "cSld", "spTree");
  let id = 2, shapes = "";
  for (const sp of kids(tree, "sp")) {
    const ph = path(sp, "nvSpPr", "nvPr", "ph");
    if (!ph || !TEXT_PH.includes(attr(ph, "type", "obj"))) continue;
    const type = ph.hasAttribute("type") ? ` type="${attr(ph, "type")}"` : "";
    const idx = ph.hasAttribute("idx") ? ` idx="${Number(attr(ph, "idx"))}"` : "";
    const sz = ph.hasAttribute("sz") ? ` sz="${String(attr(ph, "sz")).replace(/[^a-z]/gi, "")}"` : "";
    shapes += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Placeholder ${id - 1}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${type}${idx}${sz}/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
    id++;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
function relsXml(entries) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="${NS.rel}">${entries.map((e) => `<Relationship Id="${e.id}" Type="${e.type}" Target="${e.target}"${e.mode === "External" ? ' TargetMode="External"' : ""}/>`).join("")}</Relationships>`;
}

export function addSlide(pkg, afterIndex, layoutPath) {
  return pkg.transact("Add slide", () => {
    if (!layoutPath || !pkg.exists(layoutPath)) throw new PptxError("NO_LAYOUT", "No layout available.");
    const p = newSlidePath(pkg);
    pkg.createPart(p, blankSlideXml(pkg, layoutPath));
    pkg.createPart(relsPathFor(p), relsXml([{ id: "rId1", type: REL.slideLayout, target: relativeTarget(p, layoutPath) }]));
    pkg.setOverride(p, CT.slide);
    insertSlideRef(pkg, p, afterIndex);
    return p;
  });
}

function uniqueLike(pkg, src) {
  const dir = dirname(src), base = basename(src);
  const m = /^(.*?)(\d*)(\.[^.]+)$/.exec(base);
  let n = 1;
  const taken = new Set([...pkg.order, ...pkg.originalNames]);
  for (;;) { const cand = `${dir}/${m[1]}${n}${m[3]}`; if (!taken.has(cand)) return cand; n++; }
}
const SHARED = new Set([REL.slideLayout, REL.slideMaster, REL.theme, REL.image, REL.hyperlink]);

/** Collect parts exclusively used by the slide (charts, diagrams, workbooks…) that must be copied. */
async function planCopies(pkg, slidePath) {
  const map = new Map(); // src -> {dst, bin}
  const visit = async (part) => {
    for (const rel of pkg.readRels(part)) {
      if (!rel.resolved || SHARED.has(rel.type) || rel.type === REL.notesSlide || rel.mode === "External") continue;
      if (map.has(rel.resolved) || !pkg.exists(rel.resolved)) continue;
      const isXml = /\.(xml|rels)$/i.test(rel.resolved);
      map.set(rel.resolved, { dst: uniqueLike(pkg, rel.resolved), bin: isXml ? null : await pkg.bytes(rel.resolved) });
      // reserve the name so siblings don't collide
      pkg.order.push(map.get(rel.resolved).dst);
      await visit(rel.resolved);
    }
  };
  await visit(slidePath);
  return map;
}

export async function duplicateSlide(pkg, index) {
  const pres = readPresentation(pkg);
  const src = pres.slides[index];
  if (!src) throw new PptxError("NO_SLIDE", "Slide not found.");
  const plan = await planCopies(pkg, src.path);
  try {
    return pkg.transact("Duplicate slide", () => {
      const dst = newSlidePath(pkg);
      pkg.createPart(dst, pkg.snapshotText(src.path));
      const entries = [];
      for (const rel of pkg.readRels(src.path)) {
        if (rel.type === REL.notesSlide) continue;
        const copy = rel.resolved && plan.get(rel.resolved);
        entries.push({ id: rel.id, type: rel.type, mode: rel.mode, target: rel.mode === "External" ? rel.target : relativeTarget(dst, copy ? copy.dst : rel.resolved) });
      }
      pkg.createPart(relsPathFor(dst), relsXml(entries));
      pkg.setOverride(dst, CT.slide);
      for (const [from, { dst: to, bin }] of plan) {
        if (bin) pkg.putBinary(to, bin); else pkg.createPart(to, pkg.snapshotText(from));
        const ct = pkg.contentTypeOf(from);
        if (ct) pkg.setOverride(to, ct);
        const rr = pkg.snapshotText(relsPathFor(from));
        if (rr) {
          const rd = [];
          for (const rel of pkg.readRels(from)) {
            const c = rel.resolved && plan.get(rel.resolved);
            rd.push({ id: rel.id, type: rel.type, mode: rel.mode, target: rel.mode === "External" ? rel.target : relativeTarget(to, c ? c.dst : rel.resolved) });
          }
          pkg.createPart(relsPathFor(to), relsXml(rd));
        }
      }
      insertSlideRef(pkg, dst, index);
      return dst;
    });
  } catch (err) {
    for (const { dst } of plan.values()) { const i = pkg.order.lastIndexOf(dst); if (i >= 0 && !pkg.exists(dst)) pkg.order.splice(i, 1); }
    throw err;
  }
}

export function deleteSlide(pkg, index) {
  const pres = readPresentation(pkg);
  if (pres.slides.length <= 1) throw new PptxError("LAST_SLIDE", "A presentation needs at least one slide.");
  const s = pres.slides[index];
  if (!s) throw new PptxError("NO_SLIDE", "Slide not found.");
  return pkg.transact("Delete slide", () => {
    const doc = pkg.edit(PRES);
    for (const el of kids(kid(doc.documentElement, "sldIdLst"), "sldId")) if (attr(el, "id") === s.id) el.parentNode.removeChild(el);
    pkg.removeRel(PRES, s.rId);
    for (const n of pkg.relsOfType(s.path, REL.notesSlide)) {
      pkg.deletePart(relsPathFor(n.resolved));
      pkg.deletePart(n.resolved);
    }
    pkg.deletePart(relsPathFor(s.path));
    pkg.deletePart(s.path);
    dropSections(doc);
  });
}

export function moveSlide(pkg, from, to) {
  if (from === to) return;
  return pkg.transact("Reorder slides", () => {
    const doc = pkg.edit(PRES);
    const lst = kid(doc.documentElement, "sldIdLst");
    const items = kids(lst, "sldId");
    if (!items[from] || to < 0 || to >= items.length) throw new PptxError("BAD_INDEX", "Invalid slide position.");
    const [el] = items.splice(from, 1);
    lst.removeChild(el);
    lst.insertBefore(el, items[to] || null);
    dropSections(doc);
  });
}

export function hasSections(pkg) {
  return descendants(pkg.doc(PRES).documentElement, "sectionLst").length > 0;
}

/** Apply or reset the background on every slide as a single undoable operation. */
export function setPresentationBackground(pkg, hex) {
  if (hex !== null && hex !== undefined && !/^[0-9a-f]{6}$/i.test(String(hex))) {
    throw new PptxError("BAD_COLOR", "Background colour must be a six-digit hexadecimal value.");
  }
  const presentation = readPresentation(pkg);
  if (!presentation.slides.length) throw new PptxError("NO_SLIDES", "No slides are available.");
  return pkg.transact("Set all slide backgrounds", () => {
    for (const slide of presentation.slides) setSlideBackground(pkg, slide.path, hex);
  });
}

/** Capture each slide's exact existing background XML before a reversible bulk background edit. */
export function capturePresentationBackgrounds(pkg) {
  const presentation = readPresentation(pkg);
  return presentation.slides.map((slide) => {
    const doc = pkg.doc(slide.path);
    const cSld = doc && kid(doc.documentElement, "cSld");
    const bg = cSld && kid(cSld, "bg");
    return { path: slide.path, node: bg ? bg.cloneNode(true) : null };
  });
}

/** Restore captured background nodes only, preserving other edits made to each slide. */
export function restorePresentationBackgrounds(pkg, snapshots) {
  if (!Array.isArray(snapshots) || !snapshots.length) return;
  return pkg.transact("Restore slide backgrounds", () => {
    for (const snapshot of snapshots) {
      if (!pkg.exists(snapshot.path)) continue;
      const doc = pkg.edit(snapshot.path);
      const cSld = kid(doc.documentElement, "cSld");
      if (!cSld) continue;
      const existing = kid(cSld, "bg");
      if (existing) cSld.removeChild(existing);
      if (snapshot.node) {
        const restored = doc.importNode(snapshot.node, true);
        cSld.insertBefore(restored, kid(cSld, "spTree") || cSld.firstChild);
      }
    }
  });
}

/** Set a slide's explicit solid background. Pass null to inherit the layout/master background. */
export function setSlideBackground(pkg, slidePath, hex) {
  if (hex !== null && hex !== undefined && !/^[0-9a-f]{6}$/i.test(String(hex))) {
    throw new PptxError("BAD_COLOR", "Background colour must be a six-digit hexadecimal value.");
  }
  return pkg.transact("Set slide background", () => {
    const doc = pkg.edit(slidePath);
    const cSld = kid(doc.documentElement, "cSld");
    if (!cSld) throw new PptxError("SLIDE_INVALID", "Slide is missing its common slide data.");
    const current = kid(cSld, "bg");
    if (current) cSld.removeChild(current);
    if (hex === null || hex === undefined) return;

    const bg = create(doc, "p", "bg");
    const bgPr = create(doc, "p", "bgPr");
    const solidFill = create(doc, "a", "solidFill");
    solidFill.appendChild(create(doc, "a", "srgbClr", { val: String(hex).toUpperCase() }));
    bgPr.appendChild(solidFill);
    bgPr.appendChild(create(doc, "a", "effectLst"));
    bg.appendChild(bgPr);
    const spTree = kid(cSld, "spTree");
    cSld.insertBefore(bg, spTree || cSld.firstChild);
  });
}


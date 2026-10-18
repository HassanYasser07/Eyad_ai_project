import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import {
  PptxPackage, setXmlImpl, readPresentation, readSlide, flattenElements, setBounds, setText, setTextProps,
  deleteElements, duplicateElements, reorderElements, groupElements, ungroupElement, addTextBox, addShape,
  addPicture, setShapeStyle, tableRows, tableCols, addSlide, duplicateSlide, deleteSlide, moveSlide, listLayouts,
  computeAlign, computeDistribute, hitTest, copyElements, pasteElements,
} from "../../src/components/pptxEditor/engine/index.js";

setXmlImpl({ DOMParser, XMLSerializer });
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (n) => PptxPackage.open(new Uint8Array(fs.readFileSync(path.join(dir, n))), { fileName: n });
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
async function roundTrip(pkg) {
  const bytes = await pkg.exportBytes();
  assert.deepEqual(pkg.validate(), [], "package must validate");
  const again = await PptxPackage.open(bytes);
  assert.deepEqual(again.validate(), [], "re-opened export must validate");
  return again;
}
const slide = (pkg, i = 0) => { const p = readPresentation(pkg); return { p, m: readSlide(pkg, p.slides[i].path, p) }; };

// PptxGenJS writes content-type overrides for slide masters it never creates; that is a defect of the
// source file (reported to the user in the import report), and export prunes it.
const SOURCE_QUIRKS = { "pptxgenjs_rich.pptx": /^content type override for missing part ppt\/slideMasters\//, };
test("every fixture opens; validates (except known source-file quirks, which export repairs)", async () => {
  for (const f of fs.readdirSync(dir)) {
    const pkg = await load(f); const problems = pkg.validate();
    const allowed = SOURCE_QUIRKS[f];
    assert.deepEqual(allowed ? problems.filter((p) => !allowed.test(p)) : problems, [], f);
    assert.ok(readPresentation(pkg).slides.length >= 1);
    if (allowed) { const out = await PptxPackage.open(await pkg.exportBytes()); assert.deepEqual(out.validate(), [], `${f} export`); }
  }
});

test("untouched export keeps every part byte-identical", async () => {
  for (const f of fs.readdirSync(dir).filter((n) => !SOURCE_QUIRKS[n])) {
    const orig = await JSZip.loadAsync(fs.readFileSync(path.join(dir, f)));
    const out = await JSZip.loadAsync(await (await load(f)).exportBytes());
    assert.deepEqual(Object.keys(out.files).filter((n) => !out.files[n].dir).sort(), Object.keys(orig.files).filter((n) => !orig.files[n].dir).sort(), f);
    for (const n of Object.keys(orig.files)) { if (orig.files[n].dir) continue; assert.deepEqual(await out.file(n).async("uint8array"), await orig.file(n).async("uint8array"), `${f}:${n}`); }
  }
});

test("placeholders inherit geometry, size, colour from layout/master", async () => {
  const { m } = slide(await load("simple.pptx"));
  const title = m.elements.find((e) => e.ph?.type === "title");
  assert.ok(title.w > 0 && title.h > 0 && title.geometryInherited);
  assert.equal(title.text.paragraphs[0].runs[0].style.size, 44);
  assert.equal(title.text.paragraphs[0].algn, "ctr");
  const body = m.elements.find((e) => e.ph?.idx === "1");
  assert.equal(body.text.paragraphs[0].bullet.kind, "char");
  assert.ok(m.warnings.length === 0);
});

test("overlap fixture: images, rotation, group flattening", async () => {
  const { m } = slide(await load("overlap.pptx"));
  assert.equal(m.elements.filter((e) => e.kind === "image").length, 3);
  assert.equal(m.elements.find((e) => e.text?.plain[0] === "Rotated 30").rot, 30);
  const g = m.elements.find((e) => e.kind === "group");
  assert.equal(g.children.length, 2);
  assert.ok(g.children[0].x >= g.x - 1 && g.children[0].x + g.children[0].w <= g.x + g.w + 1);
});

test("table and chart are recognised honestly", async () => {
  const { m } = slide(await load("table_chart.pptx"));
  const t = m.elements.find((e) => e.kind === "table");
  assert.equal(t.table.rows.length, 3); assert.equal(t.table.cols.length, 3);
  const ci = m.elements.find((e) => e.kind === "chart").chartInfo;
  assert.equal(ci.type, "bar chart");
  assert.equal(ci.preview.shape, "col");
  assert.deepEqual(ci.preview.series[0].values, [19, 24, 31]);
  assert.deepEqual(ci.preview.categories, ["Q1", "Q2", "Q3"]);
  assert.ok(m.warnings.some((w) => w.code === "chart-view-only"));
});

test("move/resize/rotate writes xfrm, undo restores identical XML", async () => {
  const pkg = await load("simple.pptx");
  const before = pkg.text.get("ppt/slides/slide1.xml");
  const { m } = slide(pkg); const sp = m.elements.find((e) => e.name.startsWith("Rounded"));
  setBounds(pkg, m.path, [{ id: sp.id, x: 1000000, y: 2000000, w: 3000000, h: 1500000, rot: 45, flipH: true, flipV: false }]);
  const after = slide(pkg).m.elements.find((e) => e.id === sp.id);
  assert.deepEqual([after.x, after.y, after.w, after.h, after.rot, after.flipH], [1000000, 2000000, 3000000, 1500000, 45, true]);
  assert.ok(pkg.isDirty);
  pkg.undo();
  assert.equal(pkg.text.get("ppt/slides/slide1.xml"), before);
  pkg.redo();
  assert.equal(slide(pkg).m.elements.find((e) => e.id === sp.id).x, 1000000);
  await roundTrip(pkg);
});

test("placeholder move materialises inherited geometry", async () => {
  const pkg = await load("simple.pptx"); const { m } = slide(pkg); const t = m.elements.find((e) => e.ph?.type === "title");
  setBounds(pkg, m.path, [{ id: t.id, x: 0, y: 0, w: t.w, h: t.h, rot: 0 }]);
  const n = slide(pkg).m.elements.find((e) => e.id === t.id);
  assert.equal(n.x, 0); assert.equal(n.geometryInherited, false);
  await roundTrip(pkg);
});

test("text edit keeps run formatting (prefix/suffix diff)", async () => {
  const pkg = await load("text_heavy_4x3.pptx"); const { m } = slide(pkg);
  const body = m.elements.find((e) => e.ph?.idx === "1");
  const texts = body.text.plain.slice();
  assert.ok(body.text.paragraphs[0].runs[0].style.bold);
  texts[0] = texts[0].replace("some regular", "some EDITED regular");
  setText(pkg, m.path, body.id, texts);
  const p0 = slide(pkg).m.elements.find((e) => e.id === body.id).text.paragraphs[0];
  assert.match(p0.plain, /EDITED regular/);
  assert.ok(p0.runs[0].style.bold, "bold lead-in run survives");
  assert.equal(p0.runs[0].style.font, "Georgia");
  await roundTrip(pkg);
});

test("text: add and remove paragraphs", async () => {
  const pkg = await load("simple.pptx"); const { m } = slide(pkg); const b = m.elements.find((e) => e.ph?.idx === "1");
  setText(pkg, m.path, b.id, [...b.text.plain, "Fourth point"]);
  assert.equal(slide(pkg).m.elements.find((e) => e.id === b.id).text.plain.length, 4);
  setText(pkg, m.path, b.id, ["Only one"]);
  assert.deepEqual(slide(pkg).m.elements.find((e) => e.id === b.id).text.plain, ["Only one"]);
  await roundTrip(pkg);
});

test("text properties and fill/line produce schema-ordered, valid XML", async () => {
  const pkg = await load("simple.pptx"); const { m } = slide(pkg); const tb = m.elements.find((e) => e.name.startsWith("TextBox")); const sh = m.elements.find((e) => e.name.startsWith("Rounded"));
  setTextProps(pkg, m.path, [tb.id], { size: 40, italic: true, underline: true, color: "FF0000", font: "Arial", align: "ctr", bullet: true, lineSpacing: 1.5 });
  const s = slide(pkg).m.elements.find((e) => e.id === tb.id).text.paragraphs[0];
  assert.deepEqual([s.runs[0].style.size, s.runs[0].style.italic, s.runs[0].style.color.hex, s.runs[0].style.font, s.algn, s.bullet.kind, s.lnSpc.pct], [40, true, "FF0000", "Arial", "ctr", "char", 1.5]);
  setShapeStyle(pkg, m.path, [sh.id], { fill: { hex: "00FF00", alpha: 0.5 }, line: { hex: "000000", w: 38100 } });
  const f = slide(pkg).m.elements.find((e) => e.id === sh.id);
  assert.deepEqual([f.fill.hex, f.fill.alpha, f.line.hex, f.line.w], ["00FF00", 0.5, "000000", 38100]);
  const spPr = pkg.doc("ppt/slides/slide1.xml").getElementsByTagName("p:spPr");
  const rounded = Array.from(spPr).find((e) => Array.from(e.childNodes).some((c) => c.localName === "prstGeom" && c.getAttribute("prst") === "roundRect"));
  assert.deepEqual(Array.from(rounded.childNodes).filter((c) => c.nodeType === 1).map((c) => c.localName), ["xfrm", "prstGeom", "solidFill", "ln"]);
  await roundTrip(pkg);
});

test("delete, duplicate, reorder, group, ungroup", async () => {
  const pkg = await load("overlap.pptx"); let { m } = slide(pkg);
  const ids = m.elements.map((e) => e.id);
  const [dup] = duplicateElements(pkg, m.path, [ids[0]]);
  m = slide(pkg).m; assert.equal(m.elements.at(-1).id, dup); assert.equal(new Set(flattenElements(m.elements).map((e) => e.id)).size, flattenElements(m.elements).length);
  reorderElements(pkg, m.path, [ids[0]], "front"); assert.equal(slide(pkg).m.elements.at(-1).id, ids[0]);
  reorderElements(pkg, m.path, [ids[0]], "back"); assert.equal(slide(pkg).m.elements[0].id, ids[0]);
  reorderElements(pkg, m.path, [ids[0]], "forward"); assert.equal(slide(pkg).m.elements[1].id, ids[0]);
  const gid = groupElements(pkg, m.path, [ids[1], ids[2]]);
  m = slide(pkg).m; const g = m.elements.find((e) => e.id === gid); assert.equal(g.children.length, 2);
  const before = g.children.map((c) => [c.x, c.y, c.w, c.h]);
  const back = ungroupElement(pkg, m.path, gid); assert.equal(back.length, 2);
  const after = slide(pkg).m.elements.filter((e) => back.includes(e.id)).map((c) => [c.x, c.y, c.w, c.h]);
  assert.deepEqual(after, before);
  deleteElements(pkg, m.path, [dup]);
  assert.ok(!slide(pkg).m.elements.some((e) => e.id === dup));
  await roundTrip(pkg);
});

test("ungroup of a resized group applies scale", async () => {
  const pkg = await load("overlap.pptx"); const { m } = slide(pkg); const g = m.elements.find((e) => e.kind === "group");
  const c0 = g.children[0];
  setBounds(pkg, m.path, [{ id: g.id, x: g.x, y: g.y, w: g.w * 2, h: g.h, rot: 0 }]);
  const scaled = slide(pkg).m.elements.find((e) => e.id === g.id).children[0];
  assert.ok(Math.abs(scaled.w - c0.w * 2) < 2);
  const ids = ungroupElement(pkg, m.path, g.id);
  const free = slide(pkg).m.elements.find((e) => e.id === ids[0]);
  assert.ok(Math.abs(free.w - scaled.w) < 2 && Math.abs(free.x - scaled.x) < 2);
});

test("insert text box, shape, picture; media + content types stay valid", async () => {
  const pkg = await load("simple.pptx"); const { m } = slide(pkg);
  addTextBox(pkg, m.path, { x: 100000, y: 100000, w: 2000000, h: 500000, text: "Hello & <world>" });
  addShape(pkg, m.path, { prst: "ellipse", x: 100000, y: 900000, w: 900000, h: 900000 });
  addShape(pkg, m.path, { prst: "line", x: 100000, y: 2000000, w: 900000, h: 0 });
  const pid = addPicture(pkg, m.path, { bytes: PNG, ext: "png", x: 3000000, y: 100000, w: 1000000, h: 1000000 });
  const els = slide(pkg).m.elements;
  assert.equal(els.find((e) => e.text?.plain[0] === "Hello & <world>").kind, "text");
  const pic = els.find((e) => e.id === pid); assert.match(pic.imagePath, /^ppt\/media\/image\d+\.png$/);
  const again = await roundTrip(pkg);
  assert.ok(await again.bytes(pic.imagePath));
  pkg.undo(); assert.ok(!slide(pkg).m.elements.some((e) => e.id === pid));
  const out = await JSZip.loadAsync(await pkg.exportBytes());
  assert.equal(Object.keys(out.files).filter((n) => n.startsWith("ppt/media/")).length, 0, "undone media is pruned");
});

test("tables: add/delete rows and columns", async () => {
  const pkg = await load("table_chart.pptx"); const { m } = slide(pkg); const t = m.elements.find((e) => e.kind === "table");
  tableRows(pkg, m.path, t.id, "add", 1); tableCols(pkg, m.path, t.id, "add", 0);
  let tb = slide(pkg).m.elements.find((e) => e.kind === "table").table;
  assert.deepEqual([tb.rows.length, tb.cols.length, tb.rows[0].cells.length], [4, 4, 4]);
  assert.equal(tb.rows[2].cells[1].text.plain[0], "");
  tableRows(pkg, m.path, t.id, "delete", 2); tableCols(pkg, m.path, t.id, "delete", 1);
  tb = slide(pkg).m.elements.find((e) => e.kind === "table").table;
  assert.deepEqual([tb.rows.length, tb.cols.length], [3, 3]);
  await roundTrip(pkg);
});

test("slide management: add, duplicate, move, delete (+undo)", async () => {
  const pkg = await load("many_slides.pptx"); const n0 = readPresentation(pkg).slides.length;
  const layouts = listLayouts(pkg); assert.ok(layouts.length > 1);
  addSlide(pkg, 1, layouts[1].path); assert.equal(readPresentation(pkg).slides.length, n0 + 1);
  await duplicateSlide(pkg, 0); assert.equal(readPresentation(pkg).slides.length, n0 + 2);
  moveSlide(pkg, 0, 3);
  assert.equal(slide(pkg, 3).m.elements.find((e) => e.ph)?.text.plain[0], "Slide 1");
  deleteSlide(pkg, 3); assert.equal(readPresentation(pkg).slides.length, n0 + 1);
  await roundTrip(pkg);
  pkg.undo(); pkg.undo(); pkg.undo(); pkg.undo();
  assert.equal(readPresentation(pkg).slides.length, n0);
  assert.equal(pkg.text.get("ppt/presentation.xml"), pkg.originalText.get("ppt/presentation.xml"));
  assert.deepEqual(await roundTrip(pkg).then((p) => readPresentation(p).slides.length), n0);
});

test("duplicating a slide with a chart deep-copies chart parts", async () => {
  const pkg = await load("table_chart.pptx");
  await duplicateSlide(pkg, 0);
  const again = await roundTrip(pkg);
  const charts = again.liveNames().filter((n) => /^ppt\/charts\/chart\d*\.xml$/.test(n));
  assert.equal(charts.length, 2);
  assert.ok(again.liveNames().filter((n) => n.startsWith("ppt/embeddings/")).length >= 2);
});

test("deleting a slide prunes its exclusive parts", async () => {
  const pkg = await load("table_chart.pptx"); await duplicateSlide(pkg, 0); deleteSlide(pkg, 0);
  const again = await roundTrip(pkg);
  assert.equal(again.liveNames().filter((n) => /^ppt\/charts\/chart\d*\.xml$/.test(n)).length, 1);
});

test("hostile input is rejected", async () => {
  await assert.rejects(PptxPackage.open(new Uint8Array(0)), { code: "EMPTY_FILE" });
  await assert.rejects(PptxPackage.open(new TextEncoder().encode("hello")), { code: "NOT_A_ZIP" });
  await assert.rejects(PptxPackage.open(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), { code: "LEGACY_OR_ENCRYPTED" });
  const z = new JSZip(); z.file("hello.txt", "x");
  await assert.rejects(PptxPackage.open(await z.generateAsync({ type: "uint8array" })), { code: "NOT_PPTX" });
  const orig = await JSZip.loadAsync(fs.readFileSync(path.join(dir, "simple.pptx")));
  orig.file("ppt/vbaProject.bin", "x");
  await assert.rejects(PptxPackage.open(await orig.generateAsync({ type: "uint8array" })), { code: "MACRO_ENABLED" });
  const evil = await JSZip.loadAsync(fs.readFileSync(path.join(dir, "simple.pptx")));
  evil.file("ppt/slides/slide1.xml", `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><p:sld xmlns:p="x">&a;</p:sld>`);
  const p = await PptxPackage.open(await evil.generateAsync({ type: "uint8array" }));
  assert.throws(() => p.doc("ppt/slides/slide1.xml"), { code: "XML_DOCTYPE" });
});

test("align / distribute / hit-test math", () => {
  const items = [{ id: "a", box: { x: 0, y: 0, w: 10, h: 10 } }, { id: "b", box: { x: 30, y: 5, w: 10, h: 10 } }, { id: "c", box: { x: 100, y: 0, w: 10, h: 10 } }];
  assert.deepEqual(computeAlign(items, "right", { x: 0, y: 0, w: 200, h: 100 }).a, { dx: 190, dy: 0 });
  assert.equal(computeDistribute(items, "h").b.dx, 20); // gap (110-30)/2 = 40 → b.x 30→50
  assert.ok(hitTest({ x: 0, y: 0, w: 100, h: 20, rot: 90 }, 50, 50) && !hitTest({ x: 0, y: 0, w: 100, h: 20, rot: 90 }, 5, 10));
});

test("copy/paste across slides remaps image relationships", async () => {
  const pkg = await load("overlap.pptx"); const { m } = slide(pkg);
  const pic = m.elements.find((e) => e.kind === "image");
  const payload = copyElements(pkg, m.path, [pic.id]);
  await duplicateSlide(pkg, 0);
  const second = readPresentation(pkg).slides[1].path;
  const [nid] = pasteElements(pkg, second, payload);
  const pasted = readSlide(pkg, second).elements.find((e) => e.id === nid);
  assert.equal(pasted.imagePath, pic.imagePath);
  const again = await roundTrip(pkg);
  assert.ok(await again.bytes(pasted.imagePath));
});

test("charts are refused by element copy", async () => {
  const pkg = await load("table_chart.pptx"); const { m } = slide(pkg);
  assert.throws(() => copyElements(pkg, m.path, [m.elements.find((e) => e.kind === "chart").id]), { code: "NOT_COPYABLE" });
});

test("LibreOffice-written deck: deleting a slide leaves no dangling content-type overrides", async () => {
  const pkg = await load("libreoffice_overlap.pptx");
  await duplicateSlide(pkg, 0); deleteSlide(pkg, 0);
  await roundTrip(pkg);                                   // roundTrip asserts validate() === [] before and after export
});

test("PptxGenJS deck: notes, chart, table, image survive edits and a slide delete", async () => {
  const pkg = await load("pptxgenjs_rich.pptx");
  const pres = readPresentation(pkg);
  assert.equal(pres.slides.length, 3);
  const m0 = readSlide(pkg, pres.slides[0].path, pres);
  assert.ok(m0.elements.some((e) => e.kind === "image"));
  assert.ok(m0.elements.some((e) => e.kind === "line" && e.line.tail !== "none"), "arrow end is read");
  setBounds(pkg, m0.path, [{ id: m0.elements[0].id, ...m0.elements[0], x: 500000, y: 500000 }]);
  const notesBefore = pkg.liveNames().filter((n) => n.startsWith("ppt/notesSlides/") && !n.includes("_rels"));
  assert.ok(notesBefore.length >= 1, "fixture has speaker notes");
  deleteSlide(pkg, 1);                                    // chart/table slide
  const again = await PptxPackage.open(await pkg.exportBytes());
  assert.deepEqual(again.validate(), [], "export repairs the source file's dangling overrides");
  assert.equal(readPresentation(again).slides.length, 2);
  assert.equal(again.liveNames().filter((n) => /^ppt\/charts\/chart\d*\.xml$/.test(n)).length, 0, "deleted slide's chart is pruned");
  assert.ok(again.liveNames().some((n) => n.startsWith("ppt/notesSlides/") && !n.includes("_rels")), "notes of kept slide preserved");
});

test("right-to-left paragraphs are detected (Arabic deck from PptxGenJS)", async () => {
  const pkg = await load("pptxgenjs_rich.pptx"); const pres = readPresentation(pkg);
  const m = readSlide(pkg, pres.slides[2].path, pres);
  const t = m.elements.find((e) => e.text && /مرحبا/.test(e.text.plain[0]));
  assert.ok(t, "Arabic text is read intact");
  assert.equal(t.text.paragraphs[0].rtl, true);
});

test("duplicate shape ids (PptxGenJS) are addressed independently", async () => {
  const pkg = await load("pptxgenjs_rich.pptx"); const pres = readPresentation(pkg);
  // find a slide whose RAW xml has repeated cNvPr ids among top-level objects
  let target = null;
  for (const sl of pres.slides) {
    const m = readSlide(pkg, sl.path, pres);
    const raw = m.elements.map((e) => e.id.split("~")[0]);
    if (new Set(raw).size < raw.length) { target = m; break; }
  }
  assert.ok(target, "fixture must contain duplicate ids, otherwise this test proves nothing");
  const keys = target.elements.map((e) => e.id);
  assert.equal(new Set(keys).size, keys.length, "model keys are unique");
  const dupKey = keys.find((k) => k.includes("~")), firstKey = dupKey.split("~")[0];
  const before = target.elements.find((e) => e.id === firstKey), second = target.elements.find((e) => e.id === dupKey);
  setBounds(pkg, target.path, [{ id: dupKey, x: second.x + 777000, y: second.y, w: second.w, h: second.h, rot: second.rot }]);
  const after = readSlide(pkg, target.path, readPresentation(pkg)).elements;
  assert.equal(after.find((e) => e.id === firstKey).x, before.x, "first object with the shared id did not move");
  assert.equal(after.find((e) => e.id === dupKey).x, second.x + 777000, "the second one moved");
  reorderElements(pkg, target.path, [dupKey], "back");
  assert.equal(readSlide(pkg, target.path, readPresentation(pkg)).elements.length, keys.length);
  const [dupe] = duplicateElements(pkg, target.path, [dupKey]);
  const ids = readSlide(pkg, target.path, readPresentation(pkg)).elements.map((e) => e.id);
  assert.ok(ids.includes(dupe));
  const out = await PptxPackage.open(await pkg.exportBytes()); assert.deepEqual(out.validate(), []);
});

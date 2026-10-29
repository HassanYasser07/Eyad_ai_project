import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import {
  PptxPackage, setXmlImpl, readPresentation, readSlide, flattenElements, setBounds, setText, setTextProps,
  deleteElements, duplicateElements, reorderElements, moveElementToLayer, setElementsHidden, groupElements, ungroupElement, addTextBox, addShape,
  addPicture, setShapeStyle, setOpacity, tableRows, tableCols, addSlide, duplicateSlide, deleteSlide, moveSlide, listLayouts,
  computeAlign, computeDistribute, hitTest, copyElements, pasteElements, setSlideBackground, setPresentationBackground, SHAPE_PRESETS, applySlidePalette,
  addTable, setTableOptions, setTableCellFill, capturePresentationBackgrounds, restorePresentationBackgrounds, captureSlidePaletteState, restoreSlidePaletteStates,
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

test("new tables support insertion, row/column edits, cell formatting, and valid PPTX export", async () => {
  const pkg = await load("simple.pptx");
  const { m } = slide(pkg);
  const id = addTable(pkg, m.path, { x: 900000, y: 1100000, w: 5200000, h: 2800000, rows: 2, cols: 4 });
  let table = slide(pkg).m.elements.find((element) => element.id === id);
  assert.equal(table.kind, "table");
  assert.equal(table.table.rows.length, 2);
  assert.equal(table.table.cols.length, 4);

  setTableCellFill(pkg, m.path, id, 1, 2, "0D9488");
  setText(pkg, m.path, id, ["Editable cell"], { row: 1, col: 2 });
  setTextProps(pkg, m.path, [id], { size: 22, bold: true, italic: true, underline: true, color: "123456", align: "ctr" }, { row: 1, col: 2 });
  setTableOptions(pkg, m.path, id, { firstRow: false, bandRow: true, firstCol: true, lastCol: true, lastRow: true, bandCol: true });
  table = slide(pkg).m.elements.find((element) => element.id === id);
  assert.equal(table.table.firstRow, false);
  assert.equal(table.table.bandRow, true);
  assert.equal(table.table.firstCol, true);
  assert.equal(table.table.lastCol, true);
  assert.equal(table.table.lastRow, true);
  assert.equal(table.table.bandCol, true);
  assert.equal(table.table.rows[1].cells[2].fill.hex, "0D9488");
  assert.equal(table.table.rows[1].cells[2].text.paragraphs[0].runs[0].style.size, 22);
  assert.equal(table.table.rows[1].cells[2].text.paragraphs[0].runs[0].style.bold, true);

  tableRows(pkg, m.path, id, "add", 1);
  tableCols(pkg, m.path, id, "add", 3);
  table = slide(pkg).m.elements.find((element) => element.id === id);
  assert.equal(table.table.rows.length, 3);
  assert.equal(table.table.cols.length, 5);
  await roundTrip(pkg);
});

test("restoring an all-slides palette preserves content edits while reverting palette colours", async () => {
  const pkg = await load("simple.pptx");
  const { p, m } = slide(pkg);
  const before = m.elements.find((element) => element.kind === "shape" && element.fill);
  const textElement = m.elements.find((element) => element.kind === "text" && element.text?.plain?.some((line) => line.trim()));
  const originalBackground = m.background;
  const snapshots = p.slides.map((slideInfo) => captureSlidePaletteState(pkg, slideInfo.path));
  const palette = { name: "Regression", colors: ["F8FAFC", "123047", "146C81", "0F766E", "B45309"] };
  for (const slideInfo of p.slides) applySlidePalette(pkg, slideInfo.path, palette);
  if (textElement) setText(pkg, m.path, textElement.id, ["Content preserved after palette toggle"]);
  restoreSlidePaletteStates(pkg, snapshots);
  const { m: restored } = slide(pkg);
  assert.deepEqual(restored.background, originalBackground);
  if (before) {
    const restoredShape = restored.elements.find((element) => element.id === before.id);
    assert.deepEqual(restoredShape?.fill, before.fill);
    assert.deepEqual(restoredShape?.line, before.line);
  }
  if (textElement) assert.ok(restored.elements.find((element) => element.id === textElement.id).text.plain.some((line) => line.includes("Content preserved after palette toggle")));
  await roundTrip(pkg);
});

test("restoring apply-to-all backgrounds preserves unrelated slide edits", async () => {
  const pkg = await load("simple.pptx");
  const before = readPresentation(pkg).slides.map((slideInfo) => ({ path: slideInfo.path, background: readSlide(pkg, slideInfo.path, readPresentation(pkg)).background }));
  const snapshots = capturePresentationBackgrounds(pkg);
  setPresentationBackground(pkg, "ABCDEF");
  const { m } = slide(pkg);
  const textElement = m.elements.find((element) => element.kind === "text" && element.text?.plain?.some((line) => line.trim()));
  if (textElement) setText(pkg, m.path, textElement.id, ["Background restoration test"]);
  restorePresentationBackgrounds(pkg, snapshots);
  const after = readPresentation(pkg).slides.map((slideInfo) => ({ path: slideInfo.path, background: readSlide(pkg, slideInfo.path, readPresentation(pkg)).background }));
  assert.deepEqual(after, before);
  if (textElement) assert.ok(slide(pkg).m.elements.find((element) => element.id === textElement.id).text.plain.some((line) => line.includes("Background restoration test")));
  await roundTrip(pkg);
});

test("resizing a text frame does not inject shrink-to-fit and change imported text size", async () => {
  const pkg = await load("text_heavy_4x3.pptx");
  const { m, p } = slide(pkg);
  const item = m.elements.find((e) => e.text && e.text.paragraphs?.some((paragraph) => paragraph.runs.length));
  assert.ok(item, "fixture should contain text");
  const beforeType = item.text.body?.autofit?.type;
  const beforeScale = item.text.body?.autofit?.fontScale;
  setBounds(pkg, m.path, [{ id: item.id, x: item.x, y: item.y, w: Math.round(item.w * 0.65), h: Math.round(item.h * 1.25), rot: item.rot }], "Resize text frame");
  const after = readSlide(pkg, m.path, p).elements.find((e) => e.id === item.id);
  assert.equal(after.text.body?.autofit?.type, beforeType, "resizing must preserve the original fit mode");
  assert.equal(after.text.body?.autofit?.fontScale, beforeScale, "resizing must preserve any existing fontScale");
  assert.equal(after.text.paragraphs[0].runs[0].style.size, item.text.paragraphs[0].runs[0].style.size, "the imported font size must not be modified");
});

test("editing text and growing its frame are committed as one undoable transaction", async () => {
  const pkg = await load("text_heavy_4x3.pptx");
  const { m } = slide(pkg);
  const item = m.elements.find((e) => e.text && e.text.plain?.some((line) => line.trim()) && e.kind !== "table");
  assert.ok(item, "fixture should contain a text object");
  const originalText = item.text.plain.slice();
  const grownHeight = item.h + 250000;
  setText(pkg, m.path, item.id, ["Adaptive frame regression text"], null, grownHeight, { x: item.x, y: item.y, w: item.w, h: item.h, rot: item.rot, flipH: item.flipH, flipV: item.flipV });
  const updated = slide(pkg).m.elements.find((e) => e.id === item.id);
  assert.equal(updated.h, grownHeight, "text edit should store the grown frame height");
  assert.match(updated.text.plain.join("\n"), /Adaptive frame regression text/);
  pkg.undo();
  const restored = slide(pkg).m.elements.find((e) => e.id === item.id);
  assert.equal(restored.h, item.h, "undo restores original frame height with the original text");
  assert.deepEqual(restored.text.plain, originalText);
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

test("opacity updates solid shape fills, outlines, connector lines and pictures in exported PPTX", async () => {
  const pkg = await load("simple.pptx");
  let { m } = slide(pkg);
  const shape = m.elements.find((e) => e.name.startsWith("Rounded"));
  setShapeStyle(pkg, m.path, [shape.id], { fill: { hex: "2563EB" }, line: { hex: "111827", w: 25400 } });
  // Simulate an imported fill carrying an existing colour transform. Opacity must be
  // inserted in DrawingML schema order instead of blindly appended after lumMod.
  pkg.transact("seed color transform", () => {
    const doc = pkg.edit(m.path);
    const node = Array.from(doc.getElementsByTagName("p:sp")).find((candidate) =>
      Array.from(candidate.getElementsByTagName("p:cNvPr")).some((meta) => meta.getAttribute("id") === String(shape.id))
    );
    const color = node && Array.from(node.getElementsByTagName("a:srgbClr")).find((candidate) => candidate.getAttribute("val") === "2563EB");
    assert.ok(color, "test shape has the edited fill color");
    const lumMod = doc.createElementNS("http://schemas.openxmlformats.org/drawingml/2006/main", "a:lumMod");
    lumMod.setAttribute("val", "80000");
    color.appendChild(lumMod);
  });
  setOpacity(pkg, m.path, [shape.id], 0.36);
  let edited = slide(pkg).m.elements.find((e) => e.id === shape.id);
  const shapeDoc = pkg.doc(m.path);
  const shapeNode = Array.from(shapeDoc.getElementsByTagName("p:sp")).find((candidate) =>
    Array.from(candidate.getElementsByTagName("p:cNvPr")).some((meta) => meta.getAttribute("id") === String(shape.id))
  );
  const fillColor = Array.from(shapeNode.getElementsByTagName("a:srgbClr")).find((candidate) => candidate.getAttribute("val") === "2563EB");
  assert.deepEqual(Array.from(fillColor.childNodes).filter((child) => child.nodeType === 1).map((child) => child.localName), ["alpha", "lumMod"], "alpha transform is kept in valid DrawingML order");
  assert.equal(edited.fill.alpha, 0.36, "shape fill uses selected opacity");
  assert.equal(edited.line.alpha, 0.36, "shape outline uses the same selected opacity");

  const lineId = addShape(pkg, m.path, { prst: "line", x: 200000, y: 300000, w: 700000, h: 0, hex: "334155" });
  setOpacity(pkg, m.path, [lineId], 0.2);
  edited = slide(pkg).m.elements.find((e) => e.id === lineId);
  assert.equal(edited.line.alpha, 0.2, "line-only shapes receive opacity on their stroke");

  const imageId = addPicture(pkg, m.path, { bytes: PNG, ext: "png", x: 1000000, y: 1200000, w: 250000, h: 250000 });
  setOpacity(pkg, m.path, [imageId], 0.47);
  assert.equal(slide(pkg).m.elements.find((e) => e.id === imageId).opacity, 0.47, "picture transparency round-trips through alphaModFix");
  await roundTrip(pkg);

  setOpacity(pkg, m.path, [shape.id, lineId, imageId], 1);
  edited = slide(pkg).m.elements.find((e) => e.id === shape.id);
  assert.equal(edited.fill.alpha, 1, "100% opacity clears prior alpha transforms");
  assert.equal(edited.line.alpha, 1, "100% opacity restores outline opacity");
  assert.equal(slide(pkg).m.elements.find((e) => e.id === lineId).line.alpha, 1);
  assert.equal(slide(pkg).m.elements.find((e) => e.id === imageId).opacity, 1);
  await roundTrip(pkg);
});

test("text properties and fill/line produce schema-ordered, valid XML", async () => {
  const pkg = await load("simple.pptx"); const { m } = slide(pkg); const tb = m.elements.find((e) => e.name.startsWith("TextBox")); const sh = m.elements.find((e) => e.name.startsWith("Rounded"));
  setTextProps(pkg, m.path, [tb.id], { size: 40, italic: true, underline: true, strike: true, highlight: "FFFF00", color: "FF0000", font: "Arial", align: "ctr", bullet: true, lineSpacing: 1.5 });
  const s = slide(pkg).m.elements.find((e) => e.id === tb.id).text.paragraphs[0];
  assert.deepEqual([s.runs[0].style.size, s.runs[0].style.italic, s.runs[0].style.underline, s.runs[0].style.strike, s.runs[0].style.highlight.hex, s.runs[0].style.color.hex, s.runs[0].style.font, s.algn, s.bullet.kind, s.lnSpc.pct], [40, true, true, true, "FFFF00", "FF0000", "Arial", "ctr", "char", 1.5]);
  setTextProps(pkg, m.path, [tb.id], { strike: false, highlight: null });
  const resetStyle = slide(pkg).m.elements.find((e) => e.id === tb.id).text.paragraphs[0].runs[0].style;
  assert.equal(resetStyle.strike, false); assert.equal(resetStyle.highlight, null);
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

test("layer visibility and drag reordering persist and undo as single operations", async () => {
  const pkg = await load("overlap.pptx");
  const { m } = slide(pkg);
  const originalXml = pkg.text.get(m.path);
  const originalOrder = m.elements.map((element) => element.id);
  const target = originalOrder[0];

  setElementsHidden(pkg, m.path, [target], true);
  assert.equal(slide(pkg).m.elements.find((element) => element.id === target).hidden, true);
  assert.match(pkg.text.get(m.path), /hidden="1"/);
  await roundTrip(pkg);
  pkg.undo();
  assert.equal(pkg.text.get(m.path), originalXml, "undo restores exact visibility XML");
  pkg.redo();
  assert.equal(slide(pkg).m.elements.find((element) => element.id === target).hidden, true);
  pkg.undo();

  moveElementToLayer(pkg, m.path, target, 0); // UI index 0 means front/top layer.
  assert.equal(slide(pkg).m.elements.at(-1).id, target, "moving to layer index zero places it at the front");
  await roundTrip(pkg);
  pkg.undo();
  assert.equal(pkg.text.get(m.path), originalXml, "one undo restores original layer order");
  assert.deepEqual(slide(pkg).m.elements.map((element) => element.id), originalOrder);
});

test("layer dragging uses stable front-to-back indices across every target position", async () => {
  const pkg = await load("overlap.pptx");
  const { m } = slide(pkg);
  const initialFrontToBack = [...m.elements].reverse().map((element) => element.id);
  assert.ok(initialFrontToBack.length >= 3);
  for (let source = 0; source < initialFrontToBack.length; source++) {
    for (let target = 0; target < initialFrontToBack.length; target++) {
      if (source === target) continue;
      const start = [...initialFrontToBack];
      const [id] = start.splice(source, 1);
      start.splice(target, 0, id);
      moveElementToLayer(pkg, m.path, id, target);
      const actual = [...slide(pkg).m.elements].reverse().map((element) => element.id);
      assert.deepEqual(actual, start, `dragging front index ${source} to ${target}`);
      pkg.undo();
      assert.deepEqual([...slide(pkg).m.elements].reverse().map((element) => element.id), initialFrontToBack, "undo restores source layer order");
    }
  }
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


test("flipping works on text, shapes and pictures and survives PPTX export", async () => {
  const pkg = await load("simple.pptx");
  const { m } = slide(pkg);
  const textId = addTextBox(pkg, m.path, { x: 500000, y: 700000, w: 1600000, h: 700000, text: "Flip me" });
  const pictureId = addPicture(pkg, m.path, { bytes: PNG, ext: "png", x: 2300000, y: 1200000, w: 300000, h: 300000 });
  const shapeId = addShape(pkg, m.path, { prst: "triangle", x: 2800000, y: 1300000, w: 500000, h: 450000 });
  const before = pkg.text.get(m.path);
  for (const id of [textId, pictureId, shapeId]) {
    const item = readSlide(pkg, m.path, readPresentation(pkg)).elements.find((entry) => entry.id === id);
    setBounds(pkg, m.path, [{ id, x: item.x, y: item.y, w: item.w, h: item.h, rot: item.rot, flipH: true, flipV: true }], "Flip object");
    const changed = readSlide(pkg, m.path, readPresentation(pkg)).elements.find((entry) => entry.id === id);
    assert.equal(changed.flipH, true, `${item.kind} horizontal flip should be represented in the slide model`);
    assert.equal(changed.flipV, true, `${item.kind} vertical flip should be represented in the slide model`);
  }
  await roundTrip(pkg);
  pkg.undo();
  const last = readSlide(pkg, m.path, readPresentation(pkg)).elements.find((entry) => entry.id === shapeId);
  assert.equal(last.flipH, false, "one undo should revert the last object's flip transaction");
  assert.notEqual(pkg.text.get(m.path), before, "earlier object insertions and flips remain earlier separate undo steps");
});

test("coordinated palettes color text separately, recolor shapes, and export as one undoable edit", async () => {
  const pkg = await load("simple.pptx");
  const { m } = slide(pkg);
  const firstText = addTextBox(pkg, m.path, { x: 100000, y: 100000, w: 1500000, h: 500000, text: "First title" });
  const secondText = addTextBox(pkg, m.path, { x: 1800000, y: 100000, w: 1500000, h: 500000, text: "Second title" });
  addShape(pkg, m.path, { prst: "roundRect", x: 200000, y: 800000, w: 900000, h: 600000 });
  const beforePalette = pkg.text.get(m.path);
  const palette = { id: "ocean-mist", name: "Ocean Mist", colors: ["#F5FAFC", "#123047", "#176B87", "#0F766E", "#B45309"] };
  applySlidePalette(pkg, m.path, palette);
  const after = readSlide(pkg, m.path, readPresentation(pkg));
  assert.equal(after.background.hex, "F5FAFC", "first palette color becomes the slide background");
  const getTextColor = (id) => after.elements.find((entry) => entry.id === id).text.paragraphs[0].runs[0].style.color.hex;
  assert.notEqual(getTextColor(firstText), getTextColor(secondText), "separate text objects get different accent colors");
  const shape = after.elements.find((entry) => entry.kind === "shape" && entry.fill?.type === "solid");
  assert.ok(["123047", "176B87", "0F766E", "B45309"].includes(shape.fill.hex), "shapes receive one of the chosen accents");
  await roundTrip(pkg);
  pkg.undo();
  assert.equal(pkg.text.get(m.path), beforePalette, "one undo restores the entire previous slide XML");
  assert.throws(() => applySlidePalette(pkg, m.path, { colors: ["#fff"] }), { code: "BAD_PALETTE" });
});

test("slide background edits are undoable, inheritable, and survive export", async () => {
  const pkg = await load("simple.pptx");
  const { m } = slide(pkg);
  const original = pkg.text.get(m.path);
  setSlideBackground(pkg, m.path, "1E40AF");
  assert.equal(slide(pkg).m.background.hex, "1E40AF");
  assert.match(pkg.text.get(m.path), /<p:bg>/);
  await roundTrip(pkg);

  pkg.undo();
  assert.equal(pkg.text.get(m.path), original, "undo restores the exact original slide XML");
  pkg.redo();
  assert.equal(slide(pkg).m.background.hex, "1E40AF");
  setSlideBackground(pkg, m.path, null);
  assert.doesNotMatch(pkg.text.get(m.path), /<p:bg>/);
  await roundTrip(pkg);
  assert.throws(() => setSlideBackground(pkg, m.path, "#fff"), { code: "BAD_COLOR" });
});

test("presentation-wide backgrounds apply and reset as one undoable operation", async () => {
  const pkg = await load("simple.pptx");
  const pres = readPresentation(pkg);
  assert.ok(pres.slides.length > 1, "fixture must contain multiple slides");
  const original = pres.slides.map(({ path }) => pkg.text.get(path));

  setPresentationBackground(pkg, "22A06B");
  for (const slideInfo of readPresentation(pkg).slides) {
    assert.equal(readSlide(pkg, slideInfo.path, readPresentation(pkg)).background.hex, "22A06B");
  }
  await roundTrip(pkg);

  pkg.undo();
  for (const [i, slideInfo] of readPresentation(pkg).slides.entries()) {
    assert.equal(pkg.text.get(slideInfo.path), original[i], "one undo restores every slide exactly");
  }
  pkg.redo();
  setPresentationBackground(pkg, null);
  for (const slideInfo of readPresentation(pkg).slides) assert.doesNotMatch(pkg.text.get(slideInfo.path), /<p:bg(?:\s|>)/);
  await roundTrip(pkg);
  assert.throws(() => setPresentationBackground(pkg, "#abc"), { code: "BAD_COLOR" });
});

test("shape outline dash presets survive model reads and export", async () => {
  const pkg = await load("simple.pptx");
  const { m } = slide(pkg);
  const id = addShape(pkg, m.path, { prst: "rect", x: 100000, y: 100000, w: 500000, h: 300000 });
  for (const dash of ["solid", "dash", "dot", "dashDot", "lgDash", "lgDashDot", "lgDashDotDot", "sysDash", "sysDot", "sysDashDot", "sysDashDotDot"]) {
    setShapeStyle(pkg, m.path, [id], { line: { dash } });
    const element = readSlide(pkg, m.path, readPresentation(pkg)).elements.find((item) => item.id === id);
    assert.equal(element.line.dash, dash);
  }
  await roundTrip(pkg);
  pkg.undo();
  assert.equal(readSlide(pkg, m.path, readPresentation(pkg)).elements.find((item) => item.id === id).line.dash, "sysDashDot", "undo restores the previous outline pattern");
});

test("extended shape gallery presets render without approximation", async () => {
  const pkg = await load("simple.pptx");
  const { m } = slide(pkg);
  const originalIds = new Set(m.elements.map((e) => e.id));
  for (const [i, prst] of SHAPE_PRESETS.entries()) {
    addShape(pkg, m.path, { prst, x: 800000 + i * 1000, y: 900000, w: 400000, h: prst === "line" ? 0 : 300000 });
  }
  const updated = slide(pkg).m;
  assert.equal(updated.elements.filter((e) => !originalIds.has(e.id)).length, SHAPE_PRESETS.length);
  assert.ok(!updated.warnings.some((w) => w.code === "geometry-approximated"), "every offered preset has a renderer implementation");
  await roundTrip(pkg);
});


test("resizing a table frame scales its grid so frame and rows never diverge", async () => {
  const pkg = await load("table_chart.pptx"); const { m } = slide(pkg); const t = m.elements.find((e) => e.kind === "table");
  setBounds(pkg, m.path, [{ id: t.id, x: t.x, y: t.y, w: Math.round(t.w * 0.5), h: Math.round(t.h * 1.5), rot: 0 }], "Resize");
  const t2 = slide(pkg).m.elements.find((e) => e.id === t.id);
  assert.equal(t2.table.cols.reduce((a, b) => a + b, 0), t2.w);
  assert.equal(t2.table.rows.reduce((a, r) => a + r.h, 0), t2.h);
  // a pre-fitted grid from the editor is honoured verbatim
  const rows = t2.table.rows.map((r) => r.h + 1000);
  setBounds(pkg, m.path, [{ id: t.id, x: t.x, y: t.y, w: t2.w, h: rows.reduce((a, b) => a + b, 0), rot: 0, tableGrid: { cols: t2.table.cols, rows } }], "Fit");
  const t3 = slide(pkg).m.elements.find((e) => e.id === t.id);
  assert.deepEqual(t3.table.rows.map((r) => r.h), rows);
});

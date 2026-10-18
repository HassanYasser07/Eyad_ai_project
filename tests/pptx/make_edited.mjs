// Produces edited exports in $OUT for validation by third-party tools (python-pptx, LibreOffice).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as E from "../../src/components/pptxEditor/engine/index.js";
E.setXmlImpl({ DOMParser, XMLSerializer });
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures"), out = process.env.OUT || "/tmp/edited";
fs.mkdirSync(out, { recursive: true });
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const open = (n) => E.PptxPackage.open(new Uint8Array(fs.readFileSync(path.join(dir, n))));
const first = (pkg) => { const p = E.readPresentation(pkg); return E.readSlide(pkg, p.slides[0].path, p); };
const save = async (pkg, n) => fs.writeFileSync(path.join(out, n), await pkg.exportBytes());

let pkg = await open("simple.pptx"); let m = first(pkg);
const t = m.elements.find((e) => e.ph?.type === "title");
E.setBounds(pkg, m.path, [{ id: t.id, x: 500000, y: 300000, w: 8000000, h: 900000, rot: 0 }]);
E.setText(pkg, m.path, t.id, ["Edited title"]);
const b = m.elements.find((e) => e.ph?.idx === "1"); E.setText(pkg, m.path, b.id, [...b.text.plain, "Added bullet"]);
E.setTextProps(pkg, m.path, [m.elements.find((e) => e.name.startsWith("TextBox")).id], { color: "C026D3", size: 32, align: "ctr" });
E.addShape(pkg, m.path, { prst: "star5", x: 9000000, y: 300000, w: 1200000, h: 1200000 });
E.addPicture(pkg, m.path, { bytes: PNG, ext: "png", x: 10000000, y: 2000000, w: 900000, h: 900000 });
await E.duplicateSlide(pkg, 1); E.moveSlide(pkg, 2, 0);
await save(pkg, "simple_edited.pptx");

pkg = await open("overlap.pptx"); m = first(pkg);
const ids = m.elements.map((e) => e.id);
E.groupElements(pkg, m.path, [ids[0], ids[1]]); E.reorderElements(pkg, m.path, [ids[2]], "back");
E.setOpacity(pkg, m.path, [ids[3]], 0.4, "8B5CF6"); E.duplicateElements(pkg, m.path, [ids[3]]);
await save(pkg, "overlap_edited.pptx");

pkg = await open("table_chart.pptx"); m = first(pkg); const tb = m.elements.find((e) => e.kind === "table");
E.tableRows(pkg, m.path, tb.id, "add", 2); E.tableCols(pkg, m.path, tb.id, "add", 2);
E.setText(pkg, m.path, tb.id, ["Changed"], { row: 1, col: 1 });
await E.duplicateSlide(pkg, 0); E.deleteSlide(pkg, 0);
await save(pkg, "table_chart_edited.pptx");

pkg = await open("many_slides.pptx");
E.addSlide(pkg, 0, E.listLayouts(pkg)[1].path); E.deleteSlide(pkg, 3); E.moveSlide(pkg, 5, 1);
await save(pkg, "many_edited.pptx");
console.log("wrote", fs.readdirSync(out));

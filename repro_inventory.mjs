/** Full per-slide picture inventory with source labels for the real decks. */
import fs from "node:fs";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { PptxPackage, setXmlImpl, readPresentation, readSlide, flattenElements } from "./src/components/pptxEditor/engine/index.js";

setXmlImpl({ DOMParser, XMLSerializer });
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };
const extOf = (p) => (p ? p.slice(p.lastIndexOf(".") + 1).toLowerCase() : "");

for (const file of process.argv.slice(2)) {
  const pkg = await PptxPackage.open(new Uint8Array(fs.readFileSync(file)), { fileName: file });
  const pres = readPresentation(pkg);
  console.log(`\n== ${file.split(/[\\/]/).pop()} (${pres.slides.length} slides)`);
  for (let i = 0; i < pres.slides.length; i++) {
    let model;
    try { model = readSlide(pkg, pres.slides[i].path, pres); } catch (e) { console.log(`  slide ${i + 1}: READ FAILED ${e.message}`); continue; }
    const items = [];
    for (const e of flattenElements(model.elements)) if (e.kind === "image") items.push(`pic:${e.imagePath}`);
    for (const e of flattenElements(model.under)) if (e.kind === "image") items.push(`under[${e.owner || "?"}]:${e.imagePath}`);
    for (const e of flattenElements([...model.elements, ...model.under])) if (e.fill?.type === "image") items.push(`fill:${e.fill.path}`);
    if (model.background?.type === "image") items.push(`bg:${model.background.path}`);
    if (items.length) console.log(`  slide ${i + 1}: ${items.length} -> ${items.map((x) => x.replace(/^pic:/, "").split("/").pop()).join(", ")}`);
    for (const x of items) { const p = x.split(":")[1]; const gate = MIME[extOf(p)]; if (!gate) console.log(`    !! ${x} -> NO MIME`); }
  }
}

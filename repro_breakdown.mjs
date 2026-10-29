/** Precise source breakdown per deck: pic elements, shape picture-fills, layout/master art, backgrounds. */
import fs from "node:fs";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { PptxPackage, setXmlImpl, readPresentation, readSlide, flattenElements } from "./src/components/pptxEditor/engine/index.js";

setXmlImpl({ DOMParser, XMLSerializer });

for (const file of process.argv.slice(2)) {
  const pkg = await PptxPackage.open(new Uint8Array(fs.readFileSync(file)), { fileName: file });
  const pres = readPresentation(pkg);
  const stats = { pic: 0, fill: 0, under: 0, bg: 0 };
  const perSlide = [];
  for (let i = 0; i < pres.slides.length; i++) {
    let model;
    try { model = readSlide(pkg, pres.slides[i].path, pres); } catch { continue; }
    let nPic = 0, nFill = 0, nUnder = 0, nBg = 0;
    for (const e of flattenElements(model.elements)) if (e.kind === "image") nPic++;
    for (const e of flattenElements([...model.elements, ...model.under])) if (e.fill?.type === "image") nFill++;
    for (const e of flattenElements(model.under)) if (e.kind === "image") nUnder++;
    if (model.background?.type === "image") nBg++;
    stats.pic += nPic; stats.fill += nFill; stats.under += nUnder; stats.bg += nBg;
    if (nPic || nFill || nUnder || nBg) perSlide.push(`s${i + 1}: pic=${nPic} fill=${nFill} under=${nUnder} bg=${nBg}`);
  }
  console.log(`${file.split(/[\\/]/).pop()}: ${JSON.stringify(stats)}`);
  console.log(`  ${perSlide.join("  ")}`);
}

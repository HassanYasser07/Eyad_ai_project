/** Run the real engine pipeline against real-world decks and report per-picture status. */
import fs from "node:fs";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { PptxPackage, setXmlImpl, readPresentation, readSlide, flattenElements } from "./src/components/pptxEditor/engine/index.js";

setXmlImpl({ DOMParser, XMLSerializer });
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };
const extOf = (p) => (p ? p.slice(p.lastIndexOf(".") + 1).toLowerCase() : "");

const files = process.argv.slice(2);
for (const file of files) {
  const buf = fs.readFileSync(file);
  let pkg;
  try { pkg = await PptxPackage.open(new Uint8Array(buf), { fileName: file.split(/[\\/]/).pop() }); }
  catch (e) { console.log(`\n== ${file}\n   OPEN FAILED: ${e.code} ${e.message}`); continue; }
  const pres = readPresentation(pkg);
  console.log(`\n== ${file}  (${pres.slides.length} slides)`);
  let picCount = 0, okCount = 0, badCount = 0;
  const seen = new Set();
  for (let i = 0; i < pres.slides.length; i++) {
    let model;
    try { model = readSlide(pkg, pres.slides[i].path, pres); } catch (e) { console.log(`  slide ${i + 1}: READ FAILED ${e.message}`); continue; }
    const all = flattenElements([...model.elements, ...model.under]);
    const pics = all.filter((e) => e.kind === "image");
    const fills = all.filter((e) => e.fill?.type === "image").map((e) => e.fill.path);
    const paths = [...pics.map((e) => e.imagePath), ...fills, ...(model.background?.type === "image" ? [model.background.path] : [])].filter(Boolean);
    for (const p of paths) {
      if (seen.has(p)) continue;
      seen.add(p);
      picCount++;
      const gate = MIME[extOf(p)];
      const exists = pkg.exists(p);
      const bin = exists ? await pkg.bytes(p) : null;
      const status = !gate ? "NO-MIME(unavailable card)" : !bin ? "BYTES-NULL(stuck Loading…)" : "OK(renders)";
      if (!gate || !bin) { badCount++; console.log(`  slide ${i + 1}: ${p}  ext=${extOf(p)} gate=${gate || "-"} exists=${exists} bytes=${bin ? bin.length : "null"}  -> ${status}`); }
      else okCount++;
    }
  }
  console.log(`  summary: ${picCount} unique picture paths, ${okCount} render, ${badCount} fail`);
  // warnings
  const warnCounts = {};
  for (let i = 0; i < pres.slides.length; i++) {
    try { for (const w of readSlide(pkg, pres.slides[i].path, pres).warnings) warnCounts[w.code] = (warnCounts[w.code] || 0) + 1; } catch {}
  }
  console.log("  warnings:", JSON.stringify(warnCounts));
  console.log("  validate():", JSON.stringify(pkg.validate()));
}

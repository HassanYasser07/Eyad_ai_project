// Opens each given .pptx, reads every slide, applies a standard edit battery, exports, writes <out>/<name>.pptx.
import fs from "node:fs"; import path from "node:path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as E from "../../src/components/pptxEditor/engine/index.js";
E.setXmlImpl({ DOMParser, XMLSerializer });
const out = process.env.OUT || "/tmp/robust"; fs.mkdirSync(out, { recursive: true });
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
let bad = 0;
for (const file of process.argv.slice(2)) {
  const name = path.basename(file); const log = [];
  try {
    const pkg = await E.PptxPackage.open(new Uint8Array(fs.readFileSync(file)), { fileName: name });
    const pres = E.readPresentation(pkg); const warns = new Set(); let objects = 0;
    for (let i = 0; i < pres.slides.length; i++) {
      const m = E.readSlide(pkg, pres.slides[i].path, pres); m.warnings.forEach((w) => warns.add(w.code)); objects += E.flattenElements(m.elements).length;
      for (const e of m.elements) { // move every movable object, edit text where present
        if (e.readOnlyGeometry) continue;
        E.setBounds(pkg, m.path, [{ id: e.id, x: e.x + 100000, y: e.y + 50000, w: e.w, h: e.h, rot: e.rot, flipH: e.flipH, flipV: e.flipV }]);
        if (e.text && !e.text.isEmpty && e.kind !== "table") E.setText(pkg, m.path, e.id, e.text.plain.map((t, j) => (j === 0 ? t + " ✎" : t)));
      }
      if (m.elements.length >= 2) { const g = E.groupElements(pkg, m.path, [m.elements[0].id, m.elements[1].id].filter(Boolean)); E.ungroupElement(pkg, m.path, g); }
    }
    await E.duplicateSlide(pkg, 0); E.addSlide(pkg, 0, E.listLayouts(pkg)[0].path); E.moveSlide(pkg, 1, 0); E.deleteSlide(pkg, 1);
    const bytes = await pkg.exportBytes(); const problems = pkg.validate();
    fs.writeFileSync(path.join(out, name), bytes);
    const re = await E.PptxPackage.open(bytes); const rp = E.readPresentation(re);
    for (const s of rp.slides) E.readSlide(re, s.path, rp);   // every exported slide must be readable again
    console.log(`OK   ${name}: ${pres.slides.length} slides → ${rp.slides.length}, ${objects} objects, warnings=[${[...warns]}], validate problems=${problems.length}`);
    if (problems.length) { bad++; console.log("     ", problems.slice(0, 3)); }
  } catch (err) { bad++; console.log(`FAIL ${name}: ${err.code || ""} ${err.message}\n${(err.stack || "").split("\n").slice(1, 4).join("\n")}`); }
}
process.exit(bad ? 1 : 0);

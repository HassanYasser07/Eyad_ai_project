import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requiredEditorModules = [
  "src/components/shared/ColorPalettePicker.jsx",
  "src/components/shared/colorPalettePicker.css",
  "src/components/shared/presentationPalettes.js",
];

test("shared presentation-palette modules required by lazy-loaded editors are present", () => {
  for (const relativePath of requiredEditorModules) {
    assert.equal(existsSync(path.join(repoRoot, relativePath)), true, `Missing required editor module: ${relativePath}`);
  }
});

test("both editor entry points import the packaged shared palette picker", () => {
  const pptx = readFileSync(path.join(repoRoot, "src/components/pptxEditor/PptxEditorDialog.jsx"), "utf8");
  const svg = readFileSync(path.join(repoRoot, "src/components/svgEditor/SvgEditorDialog.jsx"), "utf8");
  assert.match(pptx, /\.\.\/shared\/ColorPalettePicker\.jsx/);
  assert.match(svg, /@\/components\/shared\/ColorPalettePicker/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("PPTX colour fields retain a visible custom picker and HEX input", async () => {
  const source = await read("src/components/pptxEditor/Controls.jsx");
  assert.match(source, /pe-custom-color-button/);
  assert.match(source, /customColorLabel/);
  assert.match(source, /type="color"/);
  assert.match(source, /pe-hex-row/);
});

test("SVG colour cards expose an explicit Choose any color button", async () => {
  const source = await read("src/components/svgEditor/SvgPropertiesPanel.jsx");
  assert.match(source, /className="svg-editor-color-picker-edit"/);
  assert.match(source, /onClick=\{\(\) => pickerRef\.current\?\.click\(\)\}/);
  assert.match(source, /svgEditor\.chooseColor/);
});

test("Design contains reversible background and palette scope checkboxes", async () => {
  const source = await read("src/components/pptxEditor/PptxEditorDialog.jsx");
  assert.match(source, /data-testid="pptx-apply-background-all"/);
  assert.match(source, /restorePresentationBackgrounds\(pkg, snapshots\)/);
  assert.match(source, /data-testid="pptx-apply-palette-all"/);
  assert.match(source, /paletteSnapshotsRef\.current = pres\.slides\.map/);
  assert.match(source, /restoreSlidePaletteStates\(pkg, snapshot\)/);
});

test("Tables ribbon, Insert Table, and cell format controls are present", async () => {
  const dialog = await read("src/components/pptxEditor/PptxEditorDialog.jsx");
  const inspector = await read("src/components/pptxEditor/Inspector.jsx");
  assert.match(dialog, /"table"/);
  assert.match(dialog, /pptx-insert-table/);
  assert.match(dialog, /a\.tableOptions\(\{ bandCol: e\.target\.checked \}\)/);
  assert.match(dialog, /testId="pptx-add-row"/);
  assert.match(dialog, /testId="pptx-add-col"/);
  assert.match(dialog, /tableRangeText\(tableRowIndex, tableColIndex, tableFocus\.scope/);
  assert.match(dialog, /customColorLabel=\{t\("pptxEditor\.customColor"\)\}/);
  assert.match(dialog, /pptx-table-font-size/);
  assert.match(dialog, /pptxEditor\.strike/);
  assert.match(dialog, /anchor: "ctr"/);
  assert.doesNotMatch(inspector, /function TableEditor/);
  assert.doesNotMatch(inspector, /pptx-table-panel/);
});

test("layer order commands keep Send to Back before Bring Forward", async () => {
  const inspector = await read("src/components/pptxEditor/Inspector.jsx");
  const sendToBack = inspector.indexOf('label={t("pptxEditor.toBack")}');
  const bringForward = inspector.indexOf('label={t("pptxEditor.forward")}');
  assert.ok(sendToBack >= 0 && bringForward > sendToBack, "Send to Back must appear above Bring Forward");
  assert.match(inspector, /label=\{t\("pptxEditor.toFront"\)\}/);
  assert.match(inspector, /label=\{t\("pptxEditor.backward"\)\}/);
});


test("PPTX text, shape text and table-cell content edit directly on the canvas", async () => {
  const view = await read("src/components/pptxEditor/SlideView.jsx");
  const dialog = await read("src/components/pptxEditor/PptxEditorDialog.jsx");
  assert.match(view, /contentEditable=\{editing\}/);
  assert.match(view, /onDoubleClick=\{\(event\) => \{ if \(!editing && onEditStart\)/);
  assert.match(view, /onTableCellSelect\?\.\(el\.id, ri, ci\)/);
  assert.match(view, /is-table-\$\{tableSelection\.scope\}-selected/);
  assert.match(dialog, /const commitInlineText =/);
  assert.doesNotMatch(dialog, /import \{ TextSheet \}/);
  assert.doesNotMatch(dialog, /sheet === "table"/);
  assert.doesNotMatch(dialog, /setSheet\("table"\)/);
});

test("new and edited text is sanitized instead of relying on zero-width placeholder glyphs", async () => {
  const ops = await read("src/components/pptxEditor/engine/ops.js");
  const view = await read("src/components/pptxEditor/SlideView.jsx");
  const model = await read("src/components/pptxEditor/engine/slideModel.js");
  assert.match(ops, /cleanTexts = .*replace\(\/\[\\u200B\\uFEFF\]\/g, ""\)/);
  assert.match(ops, /text = String\(text \?\? ""\)\.replace\(\/\[\\u200B\\uFEFF\]\/g, ""\)/);
  assert.match(model, /replace\(\/\[\\u200B\\uFEFF\]\/g, ""\)/);
  assert.doesNotMatch(view, /<span[^>]*>\\u200b<\/span>/i);
});

test("table scope choices are localized in English and Arabic and design cards share one height", async () => {
  const translations = await read("src/i18n/translations.js");
  const css = await read("src/components/pptxEditor/pptxEditor.css");
  for (const key of ["tableApplyTo", "tableScope.cell", "tableScope.row", "tableScope.column", "tableScope.table"]) {
    assert.equal((translations.match(new RegExp(`\\"pptxEditor\\.${key.replace(".", "\\.")}\\"`, "g")) || []).length, 2, `${key} should be translated in English and Arabic`);
  }
  assert.match(css, /\.pe-background-scope \{[^}]*height: 66px; min-height: 66px/);
  assert.match(css, /\.pe-design-background-color \.pe-color \{[^}]*height: 66px; min-height: 66px/);
  assert.match(css, /\.pe-palette-scope \{[^}]*height: 66px; min-height: 66px/);
  assert.match(css, /\.pe-palette-control-stack \{ display: flex; flex-direction: row/);
});

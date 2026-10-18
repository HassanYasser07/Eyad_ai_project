import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("PPTX text rendering preserves imported font sizes instead of browser-shrinking them", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("export function TextBody");
  const end = source.indexOf("/** View-only chart", start);
  const body = source.slice(start, end);
  assert.match(body, /const renderScale = 1/);
  assert.match(body, /fontSize: ptToPx\(s\.size\) \* renderScale/);
  assert.match(body, /data-auto-fit="none"/);
  assert.doesNotMatch(body, /const shouldAutoFit/);
  assert.doesNotMatch(body, /setAutoScale/);
});

test("table-cell text retains imported font sizes and remains controlled by table geometry", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("export function TextBody");
  const end = source.indexOf("/** View-only chart", start);
  const body = source.slice(start, end);
  assert.match(body, /cellMode \|\| !onAutoSize/);
  assert.match(body, /cellMode \? "flex-start" : justify/);
  assert.match(body, /fontSize: ptToPx\(s\.size\) \* renderScale/);
});

test("text frame grows on editing or dimension changes without measuring into a feedback loop", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("export function TextBody");
  const end = source.indexOf("/** View-only chart", start);
  const body = source.slice(start, end);
  assert.match(body, /requiredHeight > frameH \+ 2 \* EMU_PER_PX/);
  assert.match(body, /onAutoSize\(elementId, requiredHeight, editing\)/);
  assert.match(body, /onInput=\{\(\) => \{ if \(editing\) requestContentFit\(\); \}\}/);
  assert.match(body, /boundsChanged = previous\.w !== frameW \|\| previous\.h !== frameH/);
  assert.doesNotMatch(body, /observer\?\.observe\(content\)/);
});

test("text-box padding stays equal to the imported DrawingML insets", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("export function TextBody");
  const end = source.indexOf("/** View-only chart", start);
  const body = source.slice(start, end);
  assert.match(body, /padding: `\$\{px\(ins\.t\)\}px \$\{px\(ins\.r\)\}px \$\{px\(ins\.b\)\}px \$\{px\(ins\.l\)\}px`/);
  assert.doesNotMatch(body, /px\(ins\.[trbl]\)\s*\*\s*renderScale/);
});

test("canvas size updates ignore unchanged dimensions", async () => {
  const source = await read("src/components/pptxEditor/Canvas.jsx");
  assert.match(source, /current\.w === next\.w && current\.h === next\.h \? current : next/);
});

test("visual viewport updates ignore unchanged dimensions", async () => {
  const source = await read("src/components/pptxEditor/Sheets.jsx");
  assert.match(source, /current\.h === h && current\.top === top \? current : \{ h, top \}/);
  assert.match(source, /Math\.round\(v\.height\)/);
  assert.match(source, /if \(!enabled\)/);
  assert.match(source, /if \(typeof window === "undefined"\)/);
});


test("resizing a text frame preserves imported PowerPoint auto-fit flags", async () => {
  const ops = await read("src/components/pptxEditor/engine/ops.js");
  const start = ops.indexOf("export function setBounds(");
  const end = ops.indexOf("/** Hide/show selected drawing objects", start);
  const body = ops.slice(start, end);
  assert.match(body, /writeBounds\(doc, node, ch\)/);
  assert.doesNotMatch(body, /insertOrdered\(bodyPr, create\(doc, "a", "normAutofit"/);
  assert.doesNotMatch(body, /for \(const old of kids\(bodyPr, "noAutofit", "normAutofit", "spAutoFit"\)\)/);
  assert.match(body, /Geometry edits must never rewrite text auto-fit settings/);
});

test("table top-alignment icon is defined locally in both editor sections", async () => {
  const dialog = await read("src/components/pptxEditor/PptxEditorDialog.jsx");
  const inspector = await read("src/components/pptxEditor/Inspector.jsx");
  assert.match(dialog, /const AlignStartHorizontal = \(\{ size = 16, strokeWidth = 2/);
  assert.match(inspector, /const AlignStartHorizontal = \(\{ size = 16, strokeWidth = 2/);
  assert.match(dialog, /icon=\{AlignStartHorizontal\}/);
  assert.match(inspector, /icon=\{AlignStartHorizontal\}/);
  assert.doesNotMatch(dialog, /import \{[^}]*AlignStartHorizontal[^}]*\} from "lucide-react"/);
  assert.doesNotMatch(inspector, /import \{[^}]*AlignStartHorizontal[^}]*\} from "lucide-react"/);
});


test("table vertical alignment controls define every referenced icon locally", async () => {
  const dialog = await read("src/components/pptxEditor/PptxEditorDialog.jsx");
  const inspector = await read("src/components/pptxEditor/Inspector.jsx");
  const icons = ["AlignStartHorizontal", "AlignCenterHorizontal", "AlignEndHorizontal"];
  const dialogImports = dialog.slice(0, dialog.indexOf('from "lucide-react"'));
  const inspectorImports = inspector.slice(0, inspector.indexOf('from "lucide-react"'));
  for (const icon of icons) {
    assert.ok(dialog.includes(`const ${icon} = ({ size = 16, strokeWidth = 2`), `${icon} must be defined in PptxEditorDialog`);
    assert.ok(inspector.includes(`const ${icon} = ({ size = 16, strokeWidth = 2`), `${icon} must be defined in Inspector`);
    assert.doesNotMatch(dialogImports, new RegExp(`\\b${icon}\\b`), `${icon} must not be imported from lucide-react in PptxEditorDialog`);
    assert.doesNotMatch(inspectorImports, new RegExp(`\\b${icon}\\b`), `${icon} must not be imported from lucide-react in Inspector`);
  }
  assert.ok(dialog.includes("icon={AlignCenterHorizontal}"));
  assert.ok(dialog.includes("icon={AlignEndHorizontal}"));
  assert.ok(inspector.includes("icon={AlignCenterHorizontal}"));
  assert.ok(inspector.includes("icon={AlignEndHorizontal}"));
});

test("ordinary text frame height adapts after editing or geometry changes without altering font size", async () => {
  const view = await read("src/components/pptxEditor/SlideView.jsx");
  const start = view.indexOf("export function TextBody");
  const end = view.indexOf("/** View-only chart", start);
  const body = view.slice(start, end);
  assert.match(body, /onInput=\{\(\) => \{ if \(editing\) requestContentFit\(\); \}\}/);
  assert.match(body, /requiredHeight > frameH \+ 2 \* EMU_PER_PX/);
  assert.match(body, /onAutoSize\(elementId, requiredHeight, editing\)/);
  assert.match(body, /frameW, frameH, textLayoutKey/);
  assert.match(body, /lineSpacing: p\.lnSpc, spaceBefore: p\.spcBef, spaceAfter: p\.spcAft/);
  const css = await read("src/components/pptxEditor/pptxEditor.css");
  assert.match(css, /contenteditable="true"\] \.pptx-para \{ cursor: text; \}/);
  assert.doesNotMatch(css, /contenteditable="true"\] \.pptx-para \{[^}]*line-height:[^}]*!important/);
  assert.doesNotMatch(css, /contenteditable="true"\] \{ min-height: 100%/);
});


test("committed text-frame resizing is measured after Canvas suspends auto-fit during the drag preview", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("React.useLayoutEffect(() => {", source.indexOf("export function TextBody"));
  const end = source.indexOf("}, [cellMode, onAutoSize, editing, frameW, frameH, textLayoutKey, requestContentFit]);", start);
  assert.ok(start >= 0 && end > start, "TextBody layout effect must exist");
  const effect = source.slice(start, end);
  assert.match(effect, /if \(cellMode \|\| !onAutoSize\) return undefined;/);
  assert.ok(effect.indexOf("if (cellMode || !onAutoSize) return undefined;") < effect.indexOf("previousBoundsRef.current = { w: frameW, h: frameH }"), "do not consume bounds while auto-sizing is suspended");
  assert.match(effect, /const boundsChanged = previous\.w !== frameW \|\| previous\.h !== frameH/);
});

test("editing caret styling does not override imported paragraph line-height and cause clipped wrapped text", async () => {
  const css = await read("src/components/pptxEditor/pptxEditor.css");
  assert.match(css, /\.pptx-text-content\[contenteditable="true"\] \.pptx-para \{ cursor: text; \}/);
  assert.doesNotMatch(css, /contenteditable="true"\] \.pptx-para \{[^}]*line-height:[^}]*!important/);
});


test("text auto-size overrides keep measuring while typing; only active pointer drafts suspend it", async () => {
  const view = await read("src/components/pptxEditor/SlideView.jsx");
  const canvas = await read("src/components/pptxEditor/Canvas.jsx");
  assert.match(view, /geometryDrafts, hints = false/);
  assert.match(view, /const suspendAutoSize = Boolean\(geometryDrafts\?\.has\(el\.id\)\)/);
  assert.match(view, /onAutoSizeText=\{suspendAutoSize \? null : onAutoSizeText\}/);
  assert.match(canvas, /geometryDrafts=\{draft\}/);
});

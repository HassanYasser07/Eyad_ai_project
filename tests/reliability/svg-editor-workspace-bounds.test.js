import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("SVG elements can extend beyond the artboard during editing", async () => {
  const dialog = await read("src/components/svgEditor/SvgEditorDialog.jsx");
  const css = await read("src/components/svgEditor/svgEditor.css");
  assert.doesNotMatch(dialog, /clampElementToArtboard/);
  assert.match(css, /\.svg-editor-artboard\s*\{[\s\S]*?overflow:\s*visible;/);
});

test("SVG export clips artwork to the artboard viewport", async () => {
  const document = await read("src/components/svgEditor/svgDocument.js");
  assert.match(document, /export function exportSvgMarkup/);
  assert.match(document, /root\.setAttribute\("overflow", "hidden"\)/);
  assert.match(document, /root\.style\.setProperty\("overflow", "hidden", "important"\)/);
});

test("SVG artboard fills mobile canvas width when possible and preserves its aspect ratio", async () => {
  const dialog = await read("src/components/svgEditor/SvgEditorDialog.jsx");
  assert.match(dialog, /const isMobile = canvasSize\.width <= 660/);
  assert.match(dialog, /const horizontalMargin = isMobile \? 0 : 48/);
  assert.match(dialog, /const verticalMargin = isMobile \? 16 : 48/);
  assert.match(dialog, /canvasSize\.width - horizontalMargin \* 2/);
  assert.match(dialog, /canvasSize\.height - verticalMargin \* 2/);
  assert.doesNotMatch(dialog, /mobilePanelHeight/);
  assert.match(dialog, /Math\.min\(maxWidth, maxHeight \* pageAspect\)/);
  assert.match(dialog, /return \{ width, height: width \/ pageAspect \}/);
  assert.match(dialog, /\}, \[canvasSize\.width, canvasSize\.height, pageAspect\]\)/);
  assert.doesNotMatch(dialog, /const width = Math\.max\(1, canvasSize\.width\)/);
});

test("mobile workspace fills the available canvas and prevents viewport clipping", async () => {
  const css = await read("src/components/svgEditor/svgEditor.css");
  assert.match(css, /@media \(max-width: 660px\) \{[\s\S]*?\.svg-editor-workspace \{[\s\S]*?width: 100% !important/);
  assert.match(css, /\.svg-editor-center-panel \{[\s\S]*?flex: 1 1 0 !important[\s\S]*?min-height: 0 !important/);
  assert.match(css, /\.svg-editor-canvas \{[\s\S]*?width: 100% !important[\s\S]*?overflow: hidden !important/);
  assert.match(css, /\.svg-editor-artboard \{[\s\S]*?max-width: 100%[\s\S]*?max-height: none/);
});

test("SVG editor removes all workspace zoom controls and gesture-based zoom", async () => {
  const dialog = await read("src/components/svgEditor/SvgEditorDialog.jsx");
  const css = await read("src/components/svgEditor/svgEditor.css");
  assert.doesNotMatch(dialog, /ZoomIn|ZoomOut|svgEditor\.zoom(In|Out)|<Slider\b|onWheel=|handleCanvasWheel/);
  assert.doesNotMatch(dialog, /const zoomValue\s*=|scale\(\$\{zoom\}\)/);
  assert.match(dialog, /transform: "translate\(-50%, -50%\)"/);
  assert.doesNotMatch(css, /svg-editor-zoom-slider|svg-editor-zoom-value/);
});


test("mobile SVG editor explicitly allows live artwork overflow and hides zoom controls", async () => {
  const css = await read("src/components/svgEditor/svgEditor.css");
  const mobileBlock = css.slice(css.lastIndexOf("@media (max-width: 660px)"));
  assert.match(mobileBlock, /\.svg-editor-artboard > svg\s*\{[^}]*overflow:\s*visible !important/s);
  assert.match(mobileBlock, /button\[aria-label\*="zoom" i\]/);
  assert.match(mobileBlock, /button\[title\*="zoom" i\]/);
  assert.match(mobileBlock, /\.svg-editor-zoom-in/);
  assert.match(mobileBlock, /\.svg-editor-zoom-out/);
  const document = await read("src/components/svgEditor/svgDocument.js");
  assert.match(document, /root\.setAttribute\("overflow", "hidden"\)/);
});


test("mobile editing panels overlay the workspace without changing its layout size", async () => {
  const css = await read("src/components/svgEditor/svgEditor.css");
  const mobileBlock = css.slice(css.lastIndexOf("@media (max-width: 660px)"));
  assert.match(mobileBlock, /\.svg-editor-workspace\s*\{[^}]*position:\s*relative !important/s);
  assert.match(mobileBlock, /\.svg-editor-layers-panel,[\s\S]*?\.svg-editor-properties-panel\s*\{[^}]*position:\s*absolute !important/s);
  assert.match(mobileBlock, /\.svg-editor-layers-panel,[\s\S]*?\.svg-editor-properties-panel\s*\{[^}]*bottom:\s*0 !important/s);
  assert.match(mobileBlock, /\.svg-editor-layers-panel,[\s\S]*?\.svg-editor-properties-panel\s*\{[^}]*flex:\s*none !important/s);
  assert.match(mobileBlock, /\.svg-editor-workspace\s*\{[^}]*transition:\s*none !important/s);
});


test("mobile artboard stays anchored and unchanged when control tabs open", async () => {
  const dialog = await read("src/components/svgEditor/SvgEditorDialog.jsx");
  const css = await read("src/components/svgEditor/svgEditor.css");
  assert.doesNotMatch(dialog, /mobilePanelHeight/);
  assert.doesNotMatch(dialog, /\}, \[canvasSize\.width, canvasSize\.height, pageAspect, mobileEditorTab\]\)/);
  const mobileBlock = css.slice(css.lastIndexOf("@media (max-width: 660px)"));
  assert.match(mobileBlock, /\.svg-editor-artboard\s*\{[^}]*top:\s*0 !important/s);
  assert.match(mobileBlock, /\.svg-editor-artboard\s*\{[^}]*transform:\s*translate\(-50%, 0\) !important/s);
  assert.match(mobileBlock, /\.svg-editor-artboard\s*\{[^}]*max-width:\s*100%/s);
  assert.match(mobileBlock, /\.svg-editor-properties-scroll\s*\{[^}]*overflow-y:\s*auto !important/s);
});


test("mobile control panels stay compact so they do not dominate the workspace", async () => {
  const css = await read("src/components/svgEditor/svgEditor.css");
  const mobileBlock = css.slice(css.lastIndexOf("@media (max-width: 660px)"));
  assert.match(mobileBlock, /height:\s*min\(24vh, 190px\) !important/);
  assert.match(mobileBlock, /max-height:\s*min\(24vh, 190px\) !important/);
  assert.match(mobileBlock, /overflow-y:\s*auto !important/);
});


test("SVG Controls removes X/Y fields and adjusts move step with compact arrow buttons", async () => {
  const panel = await read("src/components/svgEditor/SvgPropertiesPanel.jsx");
  const dialog = await read("src/components/svgEditor/SvgEditorDialog.jsx");
  const css = await read("src/components/svgEditor/svgEditor.css");
  assert.doesNotMatch(panel, /svg-editor-position-number-fields|NumberField label=\{t\("svgEditor\.x"\)\}|NumberField label=\{t\("svgEditor\.y"\)\}/);
  assert.doesNotMatch(dialog, /onPosition=\{/);
  assert.match(panel, /aria-label="Increase move step"/);
  assert.match(panel, /aria-label="Decrease move step"/);
  assert.match(panel, /setNudgeStep\(Math\.min\(1000/);
  assert.match(panel, /setNudgeStep\(Math\.max\(0\.1/);
  assert.match(css, /\.svg-editor-nudge-step-arrows button\s*\{/);
});

test("SVG text editing uses a mobile-only text composer and separate typography tabs", async () => {
  const dialog = await read("src/components/svgEditor/SvgEditorDialog.jsx");
  const panel = await read("src/components/svgEditor/SvgPropertiesPanel.jsx");
  const css = await read("src/components/svgEditor/svgEditor.css");
  assert.match(dialog, /window\.matchMedia\("\(max-width: 660px\)"\)/);
  assert.match(dialog, /mobileTextComposerOpen &&/);
  assert.match(dialog, /createTextSelection\(value\)/);
  assert.match(dialog, /setMobileTextComposerMode\("edit"\)/);
  assert.match(dialog, /setMobileTextDraft\(details\.textContent \|\| ""\)/);
  assert.match(dialog, /mobileTextComposerMode === "edit" && selectedId/);
  assert.match(dialog, /onClick=\{requestAddText\}/);
  assert.match(dialog, /onEditText=\{requestEditText\}/);
  assert.match(panel, /activeMobileTab === "controls" && isTextElement/);
  assert.match(panel, /t\("svgEditor\.editText"\) \|\| "Edit text"/);
  assert.match(dialog, /mobileEditorTab === "fontFamily"/);
  assert.match(dialog, /mobileEditorTab === "letterSpacing"/);
  assert.match(dialog, /mobileEditorTab === "textStyle"/);
  assert.match(panel, /svg-editor-font-family-strip/);
  assert.match(panel, /data-section="letter-spacing"/);
  assert.match(panel, /data-section="text-style"/);
  assert.match(panel, /activeMobileTab === "size" && isTextElement/);
  assert.match(css, /\.svg-editor-mobile-text-composer\s*\{\s*display:\s*none/);
  assert.match(css, /\.svg-editor-mobile-text-composer\s*\{[^}]*display:\s*flex/s);
});

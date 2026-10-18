import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("ordinary PPTX text keeps its imported font sizes instead of being browser-shrunk", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("export function TextBody");
  const end = source.indexOf("/** View-only chart", start);
  const body = source.slice(start, end);
  assert.match(body, /const shouldAutoFit = !cellMode && body\.autofit\?\.type === "shrink" && \(body\.autofit\.fontScale \?\? 1\) >= 0\.999/);
  assert.match(body, /const renderScale = shouldAutoFit \? autoScale : 1/);
  assert.match(body, /fontSize: ptToPx\(s\.size\) \* renderScale/);
  assert.doesNotMatch(body, /fontSize: ptToPx\(s\.size\) \* autoScale/);
  assert.match(body, /data-auto-fit=\{shouldAutoFit \? "shrink" : "none"\}/);
});

test("table-cell text never uses independent text-box auto-fit", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("export function TextBody");
  const end = source.indexOf("/** View-only chart", start);
  const body = source.slice(start, end);
  assert.match(body, /const shouldAutoFit = !cellMode && body\.autofit\?\.type === "shrink" && \(body\.autofit\.fontScale \?\? 1\) >= 0\.999/);
  assert.match(body, /cellMode \? "flex-start" : justify/);
  assert.match(body, /const renderScale = shouldAutoFit \? autoScale : 1/);
});

test("only explicitly auto-fitting text measures its fixed frame; measurements avoid feedback loops", async () => {
  const source = await read("src/components/pptxEditor/SlideView.jsx");
  const start = source.indexOf("React.useLayoutEffect(() => {", source.indexOf("export function TextBody"));
  const end = source.indexOf("if (!text) return null;", start);
  assert.ok(start >= 0 && end > start, "TextBody measurement effect is present");
  const effect = source.slice(start, end);
  assert.match(effect, /if \(!shouldAutoFit\)/);
  assert.match(effect, /observer\?\.observe\(container\)/);
  assert.doesNotMatch(effect, /observer\?\.observe\(content\)/);
  assert.match(effect, /\}, \[text, hint, shouldAutoFit\]\);/);
  assert.doesNotMatch(effect, /\}, \[text, hint, autoScale\]\);/);
  assert.match(effect, /requestAnimationFrame/);
  assert.match(effect, /container\.clientWidth < 8 \|\| container\.clientHeight < 8/);
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

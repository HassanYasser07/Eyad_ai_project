import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { register } from "node:module";

// fileTextService imports "@/config/presentationOptions"; resolve the alias for Node.
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(s, c, n) {
  if (s.startsWith("@/")) return n(new URL("../../src/" + s.slice(2) + ".js", "${new URL("./", import.meta.url).href}").href, c);
  return n(s, c);
}`));

const { extractFileText, FileTextError, docxXmlToText, pptxSlideXmlToText } = await import("../../src/services/fileTextService.js");

const makeFile = (name, content) => {
  const blob = new Blob([content]);
  return Object.assign(blob, { name });
};
const zipFile = async (name, entries) => {
  const zip = new JSZip();
  for (const [path, xml] of Object.entries(entries)) zip.file(path, xml);
  return makeFile(name, await zip.generateAsync({ type: "uint8array" }));
};
const rejects = (promise, code) => assert.rejects(promise, (e) => e instanceof FileTextError && e.code === code);

test("plain text formats are read as-is (UTF-8, Arabic included)", async () => {
  const out = await extractFileText(makeFile("notes.md", "# عنوان\r\nسطر ثان"));
  assert.equal(out.text, "# عنوان\nسطر ثان");
  assert.equal(out.truncated, false);
  assert.equal((await extractFileText(makeFile("data.csv", "a,b\n1,2"))).text, "a,b\n1,2");
});

test("docx: paragraphs, tabs and entities are extracted", async () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Hello &amp; welcome</w:t></w:r></w:p><w:p><w:r><w:t>مرحبا</w:t></w:r><w:tab/><w:r><w:t>x &lt; y</w:t></w:r></w:p></w:body></w:document>';
  const out = await extractFileText(await zipFile("a.docx", { "word/document.xml": xml }));
  assert.equal(out.text, "Hello & welcome\nمرحبا\tx < y");
  assert.equal(docxXmlToText(xml).trim(), out.text);
});

test("pptx: slides are read in numeric order with slide labels", async () => {
  const slide = (t) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`;
  const out = await extractFileText(await zipFile("deck.pptx", { "ppt/slides/slide10.xml": slide("ten"), "ppt/slides/slide2.xml": slide("two"), "ppt/slides/slide1.xml": slide("one") }));
  assert.equal(out.text, "Slide 1:\none\n\nSlide 2:\ntwo\n\nSlide 10:\nten");
  assert.equal(pptxSlideXmlToText(slide("x")).trim(), "x");
});

test("errors: unsupported type, empty, too large, corrupt, no readable text", async () => {
  await rejects(extractFileText(makeFile("a.exe", "x")), "UNSUPPORTED_FILE");
  await rejects(extractFileText(makeFile("a.pdf", "x")), "UNSUPPORTED_FILE");
  await rejects(extractFileText(makeFile("a.txt", "")), "EMPTY_FILE");
  await rejects(extractFileText(makeFile("a.txt", "   \n ")), "EMPTY_FILE");
  await rejects(extractFileText({ name: "a.txt", size: 11 * 1024 * 1024, text: async () => "x" }), "FILE_TOO_LARGE");
  await rejects(extractFileText(makeFile("a.docx", "not a zip")), "FILE_UNREADABLE");
  await rejects(extractFileText(await zipFile("a.docx", { "other.xml": "<x/>" })), "FILE_UNREADABLE");
  await rejects(extractFileText(await zipFile("a.pptx", { "ppt/presentation.xml": "<x/>" })), "FILE_UNREADABLE");
});

test("long text is truncated to the limit and flagged", async () => {
  const out = await extractFileText(makeFile("big.txt", "x".repeat(60000)), { maxChars: 50000 });
  assert.equal(out.text.length, 50000);
  assert.equal(out.truncated, true);
});

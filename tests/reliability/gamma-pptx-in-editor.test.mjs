import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRESENTATION_COLOR_PACKAGES } from "../../src/config/presentationColorPackages.js";
import { buildGammaRequest } from "../../supabase/functions/eyad-presentation/gammaRequest.mjs";

const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), "utf8");

test("Gamma request asks for a .pptx export so the deck can be opened in Eyad's editor", () => {
  const built = buildGammaRequest({
    topic: "Introduction to solar energy",
    purpose: "educational", audience: "students", customAudience: "", slideCount: "auto",
    language: "en", otherLanguage: "", additionalInstructions: "",
    colorPackage: PRESENTATION_COLOR_PACKAGES[0],
  });
  assert.equal(built.ok, true, JSON.stringify(built.errors));
  assert.equal(built.request.exportAs, "pptx");
});

test("migration: pptx_path column + private bucket, no client policies", async () => {
  const sql = await read("supabase/migrations/20261102120000_gamma_presentation_pptx_storage.sql");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS pptx_path/);
  assert.match(sql, /'presentation-files'[\s\S]*false/); // public = false
  assert.doesNotMatch(sql, /CREATE POLICY/i);
});

test("Edge Function: pptx is copied to private storage and served only through an owner-checked signed URL", async () => {
  const src = await read("supabase/functions/eyad-presentation/index.ts");
  assert.match(src, /async function persistPptx/);
  assert.match(src, /bytes\[0\] !== 0x50 \|\| bytes\[1\] !== 0x4b/); // ZIP magic check
  const download = src.slice(src.indexOf('action === "download"'));
  assert.match(download, /\.eq\("owner_id", user\.id\)/);
  assert.match(download, /createSignedUrl/);
  assert.match(src, /has_pptx: Boolean\(row\.pptx_path\)/);
  // the Gamma export link itself must never be what the editor depends on
  assert.doesNotMatch(download, /export_url[^;]*json\(/);
});

test("UI: finished deck opens in the Eyad editor; Gamma link is only a fallback", async () => {
  const result = await read("src/components/presentations/PresentationResult.jsx");
  assert.match(result, /onOpen && \(job\.has_pptx \|\| job\.export_url\)/);
  assert.match(result, /data-testid="open-presentation"/);
  assert.match(result, /data-testid="export-presentation"/);
  // the generated deck must never send the user to Gamma's website
  assert.doesNotMatch(result, /href=\{job\.gamma_url\}/);
  assert.doesNotMatch(result, /href=\{job\.export_url\}/);

  const editor = await read("src/components/pptxEditor/PptxEditorDialog.jsx");
  assert.match(editor, /PptxEditorDialog\(\{ onClose, initialFile = null \}\)/);
  assert.match(editor, /initialFile\.present/);

  const studio = await read("src/pages/PresentationsStudio.jsx");
  assert.match(studio, /initialFile=\{editorFile\}/);
  assert.match(studio, /fetchPresentationFile/);
});

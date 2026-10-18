#!/usr/bin/env node
// Build guard (runs as "prebuild"): fails if a brand image referenced by the app is
// missing from /public, so a deploy can never silently ship broken hero images/icons.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");
const manifest = JSON.parse(await readFile(path.join(root, "scripts/brand-assets.json"), "utf8"));
const missing = [];
for (const { path: rel } of manifest) {
  const s = await stat(path.join(root, rel)).catch(() => null);
  if (!s || s.size === 0) missing.push(rel);
}
if (missing.length) {
  console.error("Missing brand assets:\n  " + missing.join("\n  "));
  console.error("\nRun: node scripts/fetch-brand-assets.mjs   (or copy the files in manually), then commit them.");
  process.exit(1);
}
console.log(`Brand assets OK (${manifest.length} files).`);

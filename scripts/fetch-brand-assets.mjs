#!/usr/bin/env node
// ONE-TIME migration helper: downloads the brand images that used to be hosted
// on media.base44.com into /public so the app serves them itself.
//   node scripts/fetch-brand-assets.mjs
// Run it while the old URLs are still reachable, commit the resulting files in
// /public/images and /public/icons, then this script is no longer needed.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(await readFile(path.join(root, "scripts/brand-assets.json"), "utf8"));
let failed = 0;

for (const { url, path: rel } of manifest) {
  const dest = path.join(root, rel);
  try {
    if ((await stat(dest).catch(() => null))?.size > 0) { console.log("skip (exists)", rel); continue; }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error(`unexpected content-type "${type}"`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("empty response");
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    console.log("ok  ", rel, `(${buf.length} bytes)`);
  } catch (err) {
    failed++;
    console.error("FAIL", rel, "-", err.message, "\n     source:", url);
  }
}
if (failed) { console.error(`\n${failed} asset(s) failed. Supply those files manually at the paths above.`); process.exit(1); }
console.log("\nAll brand assets present. Commit public/images and public/icons.");

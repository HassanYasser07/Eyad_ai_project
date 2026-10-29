/**
 * Decisive browser-layer test (Node + jsdom + React 18):
 * mounts the REAL useMediaUrls hook and the REAL SlideView component (Babel-
 * transformed JSX), loads the real user deck through the REAL engine, and
 * verifies that blob: URLs are actually attached to the rendered <img> nodes.
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import React from "react";
import { createRoot } from "react-dom/client";
import { PptxPackage, setXmlImpl, readPresentation, readSlide } from "./src/components/pptxEditor/engine/index.js";
import SlideView, { collectImagePaths } from "./src/components/pptxEditor/SlideView.node.js";
import { useMediaUrls } from "./src/components/pptxEditor/useMediaUrls.js";

const deckFile = process.argv[2];
const deckName = process.argv[3] || path.basename(deckFile);

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.SVGElement = dom.window.SVGElement;
global.Node = dom.window.Node;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
// jsdom lacks blob URL plumbing for <img>; use Node's, which behaves the same for our purpose.
const nodeCreateObjectURL = globalThis.URL.createObjectURL.bind(globalThis.URL);
const nodeRevokeObjectURL = globalThis.URL.revokeObjectURL.bind(globalThis.URL);
global.Blob = globalThis.Blob;
global.URL.createObjectURL = nodeCreateObjectURL;
global.URL.revokeObjectURL = nodeRevokeObjectURL;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

setXmlImpl({ DOMParser: dom.window.DOMParser, XMLSerializer: dom.window.XMLSerializer });

function CanvasWiring({ pkg, model }) {
  React.useEffect(() => { console.log("probe: passive effect ran"); }, []);
  const urls = useMediaUrls(pkg, collectImagePaths(model));
  React.useEffect(() => { console.log("probe2 after hook: urlCache size =", pkg.urlCache?.size, "| entries:", [...(pkg.urlCache?.keys() || [])]); }, []);
  return React.createElement("div", { className: "pptx-stage", id: "stage" },
    React.createElement("div", { className: "pptx-holder", id: "holder" },
      React.createElement(SlideView, { model, urls, hints: false, labels: {} })));
}

(async () => {
  const pkg = await PptxPackage.open(new Uint8Array(fs.readFileSync(deckFile)), { fileName: deckName });
  const pres = readPresentation(pkg);
  const model = readSlide(pkg, pres.slides[0].path, pres);
  const rootEl = document.getElementById("root");
  const root = createRoot(rootEl);
  root.render(React.createElement(CanvasWiring, { pkg, model }));

  // Let effects + promise microtasks + rAF run.
  await new Promise((r) => setTimeout(r, 1500));
  await new Promise((r) => setTimeout(r, 500));

  const imgNodes = [...document.querySelectorAll(".pptx-el-image img")];
  const cardNodes = [...document.querySelectorAll(".pptx-el-image .pptx-object-card")];
  console.log("images:", imgNodes.length, "| object-cards:", cardNodes.length);
  const els = [...document.querySelectorAll(".pptx-el")];
  console.log("total .pptx-el nodes:", els.length);
  console.log("model image elements:", model.elements.filter((e) => e.kind === "image").map((e) => `${e.id}:${e.imagePath} mime=${e.mime}`));
  const flat = [];
  const walk = (arr) => { for (const e of arr) { flat.push(e); if (e.children) walk(e.children); } };
  walk(model.elements);
  console.log("flat elements:", flat.map((e) => `${e.id}:${e.kind}${e.imagePath ? " -> " + e.imagePath : ""}`));
  console.log("collectImagePaths:", collectImagePaths(model));
  console.log("urlCache size:", pkg.urlCache ? pkg.urlCache.size : "none", "| entries:", pkg.urlCache ? [...pkg.urlCache.entries()].map(([k, v]) => `${k}=${v ? v.slice(0, 12) : v}`) : "-");
  console.log("stage innerHTML length:", document.getElementById("stage")?.innerHTML.length, "| holder children:", document.getElementById("holder")?.children.length);
  // What did the picture-filled shapes actually render as?
  const shapes = [...document.querySelectorAll(".pptx-el-shape svg.pptx-geom")];
  for (const svg of shapes) {
    const body = svg.querySelector("rect, ellipse, path");
    const pat = svg.querySelector("pattern");
    const im = svg.querySelector("pattern image");
    console.log("  shape svg ->", body?.tagName, "fill=", body?.getAttribute("fill"),
      "| pattern=", pat ? `id=${pat.getAttribute("id")}` : "none",
      "| image href=", im ? String(im.getAttribute("href") || im.getAttribute("xlink:href")).slice(0, 14) : "none");
  }
  for (const im of imgNodes) {
    const src = im.getAttribute("src");
    console.log(`  <img> src=${src ? src.slice(0, 14) : "MISSING"}`);
  }
  const elImageNodes = [...document.querySelectorAll(".pptx-el-image")];
  for (const el of elImageNodes) {
    if (!el.querySelector("img") && !el.querySelector(".pptx-object-card")) console.log("  ! empty image element (no img, no card)");
  }
  root.unmount();
  dom.window.close();
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });

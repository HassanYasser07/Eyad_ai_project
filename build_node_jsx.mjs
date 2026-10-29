// Transform SlideView.jsx -> SlideView.node.js (plain ESM, automatic JSX runtime)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const babel = require("@babel/core");

const ROOT = "C:/Users/hassa/OneDrive/Documentos/deepseek-harness/default-workspace/Eyad_ai_project";
const src = ROOT + "/src/components/pptxEditor/SlideView.jsx";
const out = ROOT + "/src/components/pptxEditor/SlideView.node.js";
const code = fs.readFileSync(src, "utf8");
const result = babel.transformSync(code, {
  filename: src,
  presets: [["@babel/preset-react", { runtime: "automatic" }]],
  sourceMaps: false,
  cwd: ROOT,
  configFile: false,
  babelrc: false,
});
fs.writeFileSync(out, result.code);
console.log("wrote", out, result.code.length, "bytes");

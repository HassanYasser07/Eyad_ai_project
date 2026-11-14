import { inlineIconStyles } from "@/components/svgEditor/svgDocument";

/**
 * Helpers that make any SVG picture recolourable inside the presentation editor:
 * read the colours an SVG uses, replace them, and sanitise SVG files before they are stored in a .pptx.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const PAINT_PROPS = ["fill", "stroke", "stop-color", "flood-color", "lighting-color"];
const FILLED = new Set(["path", "circle", "ellipse", "rect", "polygon", "polyline", "text", "tspan"]);
const BLOCKED = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "canvas", "applet", "animate", "animatemotion", "animatetransform", "set"]);
const MAX_COLORS = 8;

function parseSvg(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("BAD_SVG");
  const doc = new DOMParser().parseFromString(String(text), "image/svg+xml");
  const root = doc.documentElement;
  if (doc.querySelector("parsererror") || !root || root.localName !== "svg") throw new Error("BAD_SVG");
  return root;
}

let colorContext = null;
/** Any CSS colour → "#rrggbb" (alpha ignored); null for none / url() / currentColor / invalid. */
function toHex(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent" || raw === "currentcolor" || raw === "inherit" || raw.startsWith("url(")) return null;
  if (!colorContext) colorContext = document.createElement("canvas").getContext("2d");
  colorContext.fillStyle = "#010203";
  colorContext.fillStyle = raw;
  const parsed = colorContext.fillStyle;
  if (parsed === "#010203" && raw !== "#010203" && raw !== "#123") return null;
  if (parsed.startsWith("#")) return parsed.toLowerCase();
  const m = parsed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : null;
}

function authored(element, property) {
  const styled = (element.getAttribute("style") || "").match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  if (styled) return styled[1].trim();
  return (element.getAttribute(property) || "").trim();
}

function write(element, property, value) {
  const style = element.getAttribute("style") || "";
  const rule = new RegExp(`(^|;)(\\s*${property}\\s*:)[^;]*`, "i");
  if (rule.test(style)) element.setAttribute("style", style.replace(rule, (m, pre, name) => `${pre}${name}${value}`));
  else element.setAttribute(property, value);
}

function effectiveFill(element) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const v = authored(node, "fill");
    if (v && v.toLowerCase() !== "inherit") return v;
  }
  return undefined;
}

const insideClipOrMask = (element) => Boolean(element.closest("clipPath,mask"));
const hasImplicitBlack = (element) => FILLED.has(element.localName) && !insideClipOrMask(element) && effectiveFill(element) === undefined;

/** Distinct colours used by the SVG (fills, strokes, gradient stops), in document order. */
export function listSvgColors(svgText) {
  const root = parseSvg(svgText);
  inlineIconStyles(root);
  const out = [];
  const add = (hex) => { if (hex && !out.includes(hex)) out.push(hex); };
  [root, ...root.querySelectorAll("*")].forEach((element) => {
    PAINT_PROPS.forEach((property) => add(toHex(authored(element, property))));
    if (hasImplicitBlack(element)) add("#000000");
  });
  return out.slice(0, MAX_COLORS);
}

/** Replaces colours: `mapping` is a Map / object of "#old" → "#new". Returns the new SVG text. */
export function recolorSvg(svgText, mapping) {
  const map = mapping instanceof Map ? mapping : new Map(Object.entries(mapping));
  const root = parseSvg(svgText);
  inlineIconStyles(root);
  [root, ...root.querySelectorAll("*")].forEach((element) => {
    PAINT_PROPS.forEach((property) => {
      const hex = toHex(authored(element, property));
      if (hex && map.has(hex)) write(element, property, map.get(hex));
    });
    if (map.has("#000000") && hasImplicitBlack(element)) element.setAttribute("fill", map.get("#000000"));
  });
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", SVG_NS);
  return new XMLSerializer().serializeToString(root);
}

/** Paints every colour of the SVG with one colour. */
export function recolorSvgAll(svgText, hex) {
  return recolorSvg(svgText, new Map(listSvgColorsUncapped(svgText).map((color) => [color, hex])));
}

function listSvgColorsUncapped(svgText) {
  const root = parseSvg(svgText);
  inlineIconStyles(root);
  const out = new Set();
  [root, ...root.querySelectorAll("*")].forEach((element) => {
    PAINT_PROPS.forEach((property) => { const h = toHex(authored(element, property)); if (h) out.add(h); });
    if (hasImplicitBlack(element)) out.add("#000000");
  });
  return Array.from(out);
}

/** Removes scripts, event handlers and external references; guarantees a viewBox. Throws "BAD_SVG" for invalid files. */
export function sanitizeSvgText(svgText) {
  const root = parseSvg(svgText);
  [root, ...root.querySelectorAll("*")].reverse().forEach((element) => {
    if (BLOCKED.has(element.localName.toLowerCase())) { element.remove(); return; }
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "xml:base") element.removeAttributeNode(attribute);
      else if ((name === "href" || name === "xlink:href") && !/^#|^data:image\/(png|jpeg|gif|webp);base64,/i.test(attribute.value.trim())) element.removeAttributeNode(attribute);
    });
  });
  if (!root.getAttribute("viewBox")) {
    const w = Number.parseFloat(root.getAttribute("width")), h = Number.parseFloat(root.getAttribute("height"));
    if (w > 0 && h > 0) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", SVG_NS);
  return new XMLSerializer().serializeToString(root);
}

import { kid, kids, attr, num, path } from "./xml.js";
import { REL } from "./package.js";

const SCHEME_KEYS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const DEFAULT_COLORS = { dk1: "000000", lt1: "FFFFFF", dk2: "44546A", lt2: "E7E6E6", accent1: "4472C4", accent2: "ED7D31", accent3: "A5A5A5", accent4: "FFC000", accent5: "5B9BD5", accent6: "70AD47", hlink: "0563C1", folHlink: "954F72" };
const PRESET = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", grey: "808080", orange: "FFA500", purple: "800080" };

export function loadTheme(pkg, masterPath) {
  const theme = { colors: { ...DEFAULT_COLORS }, major: "Calibri", minor: "Calibri", lnWidths: [9525, 12700, 19050], clrMap: { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" } };
  if (!masterPath) return theme;
  const master = pkg.doc(masterPath);
  const map = master && path(master.documentElement, "clrMap");
  if (map) for (const a of Array.from(map.attributes)) theme.clrMap[a.localName] = a.value;
  const rel = pkg.relsOfType(masterPath, REL.theme)[0];
  const td = rel?.resolved && pkg.doc(rel.resolved);
  if (!td) return theme;
  const te = path(td.documentElement, "themeElements");
  const scheme = kid(te, "clrScheme");
  for (const key of SCHEME_KEYS) {
    const holder = kid(scheme, key);
    const c = holder && kids(holder)[0];
    if (!c) continue;
    if (c.localName === "srgbClr") theme.colors[key] = attr(c, "val", theme.colors[key]);
    else if (c.localName === "sysClr") theme.colors[key] = attr(c, "lastClr", theme.colors[key]);
  }
  const fonts = kid(te, "fontScheme");
  theme.major = attr(path(fonts, "majorFont", "latin"), "typeface", theme.major);
  theme.minor = attr(path(fonts, "minorFont", "latin"), "typeface", theme.minor);
  const lnList = path(te, "fmtScheme", "lnStyleLst");
  const widths = kids(lnList, "ln").map((l) => num(l, "w", 12700));
  if (widths.length) theme.lnWidths = widths;
  return theme;
}

export function themeFont(theme, face) {
  if (!face) return null;
  if (face === "+mj-lt") return theme.major;
  if (face === "+mn-lt") return theme.minor;
  if (face.startsWith("+")) return null;
  return face;
}

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
function hexToRgb(hex) { return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
function rgbToHex(r, g, b) { return [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase(); }
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Resolve a DrawingML colour element to {hex, alpha}. Invalid input → null. */
export function resolveColor(node, theme, phClr = null) {
  if (!node) return null;
  let hex = null;
  switch (node.localName) {
    case "srgbClr": hex = attr(node, "val"); break;
    case "sysClr": hex = attr(node, "lastClr", attr(node, "val") === "windowText" ? "000000" : "FFFFFF"); break;
    case "prstClr": hex = PRESET[attr(node, "val", "").toLowerCase()] || "000000"; break;
    case "scrgbClr": hex = rgbToHex(num(node, "r") / 1000 * 2.55, num(node, "g") / 1000 * 2.55, num(node, "b") / 1000 * 2.55); break;
    case "schemeClr": {
      const v = attr(node, "val");
      if (v === "phClr") hex = phClr;
      else { const key = theme.clrMap[v] || v; hex = theme.colors[key] || null; }
      break;
    }
    default: return null;
  }
  if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  let [r, g, b] = hexToRgb(hex);
  let alpha = 1;
  for (const t of kids(node)) {
    const v = num(t, "val", 0) / 100000;
    switch (t.localName) {
      case "alpha": alpha = clamp(v); break;
      case "alphaMod": alpha = clamp(alpha * v); break;
      case "alphaOff": alpha = clamp(alpha + v); break;
      case "lumMod": case "lumOff": case "satMod": {
        let [h, s, l] = rgbToHsl(r, g, b);
        if (t.localName === "lumMod") l = clamp(l * v);
        else if (t.localName === "lumOff") l = clamp(l + v);
        else s = clamp(s * v);
        [r, g, b] = hslToRgb(h, s, l);
        break;
      }
      case "tint": r = r * v + 255 * (1 - v); g = g * v + 255 * (1 - v); b = b * v + 255 * (1 - v); break;
      case "shade": r *= v; g *= v; b *= v; break;
      default: break;
    }
  }
  return { hex: rgbToHex(r, g, b), alpha };
}

export function colorOfFill(fillNode, theme, phClr) {
  // fillNode is <a:solidFill>; returns the resolved colour of its child.
  return resolveColor(kids(fillNode)[0], theme, phClr);
}

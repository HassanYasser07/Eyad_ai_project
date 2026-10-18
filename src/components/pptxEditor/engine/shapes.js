import { kid, kids, num, attr } from "./xml.js";

const f = (n) => Number(n.toFixed(2));
const P = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join(" ") + " Z";

/** Preset shape → SVG path data in the shape's own pixel box. null d = plain rectangle. */
export function presetGeometry(prst, w, h, adj = {}) {
  const a = (name, def) => (adj[name] ?? def) / 100000;
  const m = Math.min(w, h);
  switch (prst) {
    case "rect": case "flowChartProcess": case "flowChartPredefinedProcess": case "snipRoundRect": case "textBox":
      return { kind: "rect" };
    case "roundRect": case "flowChartAlternateProcess": {
      const r = Math.min(a("adj", 16667), 0.5) * m;
      return { kind: "path", d: `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z` };
    }
    case "flowChartTerminator": { const r = h / 2; return { kind: "path", d: `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 ${r} 0 Z` }; }
    case "ellipse": case "flowChartConnector": return { kind: "ellipse" };
    case "triangle": return { kind: "path", d: P([[w * a("adj", 50000), 0], [w, h], [0, h]]) };
    case "rtTriangle": return { kind: "path", d: P([[0, 0], [w, h], [0, h]]) };
    case "diamond": case "flowChartDecision": return { kind: "path", d: P([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) };
    case "parallelogram": { const o = a("adj", 25000) * m; return { kind: "path", d: P([[o, 0], [w, 0], [w - o, h], [0, h]]) }; }
    case "trapezoid": { const o = a("adj", 25000) * m; return { kind: "path", d: P([[o, 0], [w - o, 0], [w, h], [0, h]]) }; }
    case "pentagon": return { kind: "path", d: P([[w / 2, 0], [w, h * 0.38], [w * 0.81, h], [w * 0.19, h], [0, h * 0.38]]) };
    case "homePlate": { const o = Math.min(a("adj", 50000) * m, w); return { kind: "path", d: P([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h]]) }; }
    case "chevron": { const o = Math.min(a("adj", 50000) * m, w); return { kind: "path", d: P([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h], [o, h / 2]]) }; }
    case "hexagon": { const o = Math.min(a("adj", 25000) * m, w / 2); return { kind: "path", d: P([[o, 0], [w - o, 0], [w, h / 2], [w - o, h], [o, h], [0, h / 2]]) }; }
    case "octagon": { const o = Math.min(a("adj", 29289) * m, w / 2, h / 2); return { kind: "path", d: P([[o, 0], [w - o, 0], [w, o], [w, h - o], [w - o, h], [o, h], [0, h - o], [0, o]]) }; }
    case "rightArrow": case "leftArrow": {
      const t = a("adj1", 50000) * h, hl = Math.min(a("adj2", 50000) * m, w), y0 = (h - t) / 2, y1 = y0 + t;
      const right = [[0, y0], [w - hl, y0], [w - hl, 0], [w, h / 2], [w - hl, h], [w - hl, y1], [0, y1]];
      return { kind: "path", d: P(prst === "rightArrow" ? right : right.map(([x, y]) => [w - x, y])) };
    }
    case "upArrow": case "downArrow": {
      const t = a("adj1", 50000) * w, hl = Math.min(a("adj2", 50000) * m, h), x0 = (w - t) / 2, x1 = x0 + t;
      const up = [[x0, h], [x0, hl], [0, hl], [w / 2, 0], [w, hl], [x1, hl], [x1, h]];
      return { kind: "path", d: P(prst === "upArrow" ? up : up.map(([x, y]) => [x, h - y])) };
    }
    case "plus": case "mathPlus": { const o = (prst === "plus" ? a("adj", 25000) : 0.3) * m; return { kind: "path", d: P([[o, 0], [w - o, 0], [w - o, o], [w, o], [w, h - o], [w - o, h - o], [w - o, h], [o, h], [o, h - o], [0, h - o], [0, o], [o, o]]) }; }
    case "star4": case "star5": case "star6": case "star8": {
      const n = Number(prst.slice(4)), pts = [], inner = prst === "star5" ? 0.382 : prst === "star4" ? 0.38 : 0.5;
      for (let i = 0; i < n * 2; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? inner : 1;
        pts.push([w / 2 + (Math.cos(ang) * r * w) / 2, h / 2 + (Math.sin(ang) * r * h) / 2]);
      }
      return { kind: "path", d: P(pts) };
    }
    case "line": case "straightConnector1": case "straightConnector": return { kind: "line" };
    default: return { kind: "rect", approximated: true };
  }
}

/** custGeom → [{d, fill, stroke}] scaled from the path's own w/h into the shape box. */
export function customGeometry(custGeom, w, h) {
  const list = kid(custGeom, "pathLst");
  const out = [];
  let approximated = false;
  for (const path of kids(list, "path")) {
    const pw = num(path, "w", 0) || w, ph = num(path, "h", 0) || h;
    const sx = w / pw, sy = h / ph;
    const pt = (el) => { const p = kid(el, "pt"); return [num(p, "x") * sx, num(p, "y") * sy]; };
    let d = "", cur = [0, 0];
    for (const seg of kids(path)) {
      switch (seg.localName) {
        case "moveTo": { cur = pt(seg); d += `M${f(cur[0])} ${f(cur[1])} `; break; }
        case "lnTo": { cur = pt(seg); d += `L${f(cur[0])} ${f(cur[1])} `; break; }
        case "cubicBezTo": { const p = kids(seg, "pt").map((q) => [num(q, "x") * sx, num(q, "y") * sy]); if (p.length === 3) { d += `C${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(" ")} `; cur = p[2]; } break; }
        case "quadBezTo": { const p = kids(seg, "pt").map((q) => [num(q, "x") * sx, num(q, "y") * sy]); if (p.length === 2) { d += `Q${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(" ")} `; cur = p[1]; } break; }
        case "arcTo": {
          const wR = num(seg, "wR") * sx, hR = num(seg, "hR") * sy, st = (num(seg, "stAng") / 60000) * (Math.PI / 180), sw = (num(seg, "swAng") / 60000) * (Math.PI / 180);
          if (!wR || !hR) break;
          const cx = cur[0] - wR * Math.cos(st), cy = cur[1] - hR * Math.sin(st);
          const ex = cx + wR * Math.cos(st + sw), ey = cy + hR * Math.sin(st + sw);
          d += `A${f(wR)} ${f(hR)} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${f(ex)} ${f(ey)} `;
          cur = [ex, ey];
          break;
        }
        case "close": d += "Z "; break;
        default: approximated = true;
      }
    }
    if (d) out.push({ d: d.trim(), fill: attr(path, "fill", "norm") !== "none", stroke: attr(path, "stroke", "1") !== "0" });
  }
  return { paths: out, approximated };
}

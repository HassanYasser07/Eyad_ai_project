import React from "react";
import { EMU_PER_PX } from "./engine/slideModel.js";

const px = (emu) => emu / EMU_PER_PX;
const ptToPx = (pt) => (pt * 4) / 3;
const rgba = (c, extra = 1) => (c ? `rgba(${parseInt(c.hex.slice(0, 2), 16)},${parseInt(c.hex.slice(2, 4), 16)},${parseInt(c.hex.slice(4, 6), 16)},${(c.alpha ?? 1) * extra})` : "transparent");
const DASH = { dash: "6 3", sysDash: "3 1", dot: "1.5 2.5", sysDot: "1 1", lgDash: "10 4", dashDot: "6 3 1.5 3" };
const SERIF = /georgia|times|garamond|cambria|palatino|book|serif|minion|baskerville|didot/i, MONO = /courier|consolas|mono|menlo|lucida console/i;
const font = (f) => { const name = String(f || "Calibri").replace(/["\\;]/g, ""); return `"${name}", ${MONO.test(name) ? "ui-monospace, monospace" : SERIF.test(name) && !/sans/i.test(name) ? "Georgia, serif" : "Calibri, Arial, sans-serif"}`; };

export function collectImagePaths(model) {
  const out = new Set();
  const walk = (els) => { for (const e of els) { if (e.imagePath) out.add(e.imagePath); if (e.fill?.type === "image") out.add(e.fill.path); if (e.children) walk(e.children); } };
  walk(model.elements); walk(model.under);
  if (model.background?.type === "image") out.add(model.background.path);
  return [...out];
}

function fillAttr(fill, id, defs) {
  if (!fill || fill.type === "none") return { fill: "none" };
  if (fill.type === "solid") return { fill: `#${fill.hex}`, fillOpacity: fill.alpha };
  if (fill.type === "gradient") {
    const gid = `g-${id}`;
    const stops = fill.stops.map((s, i) => <stop key={i} offset={`${s.pos * 100}%`} stopColor={`#${s.hex}`} stopOpacity={s.alpha} />);
    defs.push(fill.radial
      ? <radialGradient key={gid} id={gid}>{stops}</radialGradient>
      : <linearGradient key={gid} id={gid} gradientTransform={`rotate(${fill.angle} .5 .5)`}>{stops}</linearGradient>);
    return { fill: `url(#${gid})` };
  }
  return { fill: "#e2e8f0" };
}

function Geometry({ el, w, h, idPrefix }) {
  const defs = [];
  const f = fillAttr(el.fill, `${idPrefix}${el.id}`, defs);
  const ln = el.line || {};
  const sw = ln.none || ln.hex === undefined ? 0 : Math.max(0.5, px(ln.w ?? 12700));
  const stroke = sw ? { stroke: `#${ln.hex}`, strokeOpacity: ln.alpha, strokeWidth: sw, strokeDasharray: DASH[ln.dash], strokeLinejoin: "round" } : { stroke: "none" };
  const g = el.geom || { kind: "rect" };
  const flip = `${el.flipH ? "scaleX(-1)" : ""} ${el.flipV ? "scaleY(-1)" : ""}`.trim();
  let body = null;
  if (g.kind === "ellipse") body = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...f} {...stroke} />;
  else if (g.kind === "path") body = <path d={g.d} {...f} {...stroke} />;
  else if (g.kind === "custom") body = g.paths.map((p, i) => <path key={i} d={p.d} {...(p.fill ? f : { fill: "none" })} {...(p.stroke ? stroke : { stroke: "none" })} />);
  else if (g.kind === "line") {
    const mk = `${idPrefix}arrow-${el.id}`;
    const head = ln.tail && ln.tail !== "none", tail = ln.head && ln.head !== "none";
    body = (
      <>
        {(head || tail) && <defs><marker id={mk} viewBox="0 0 8 8" markerWidth="3" markerHeight="3" refX="6" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0 L8 4 L0 8 Z" fill={`#${ln.hex || "000000"}`} /></marker></defs>}
        <line x1="0" y1="0" x2={w} y2={h} {...stroke} markerEnd={head ? `url(#${mk})` : undefined} markerStart={tail ? `url(#${mk})` : undefined} />
      </>
    );
  } else body = <rect x="0" y="0" width={w} height={h} {...f} {...stroke} />;
  return (
    <svg className="pptx-geom" width={Math.max(w, 1)} height={Math.max(h, 1)} viewBox={`0 0 ${Math.max(w, 1)} ${Math.max(h, 1)}`} style={{ transform: flip || undefined }} aria-hidden="true">
      {defs.length > 0 && <defs>{defs}</defs>}
      {body}
    </svg>
  );
}

function bulletText(b) {
  if (b.kind === "char") return b.char;
  if (b.kind === "auto") return `${b.number}.`;
  return "";
}

export function TextBody({ text, hint, cellMode = false }) {
  if (!text) return null;
  const { body, paragraphs } = text;
  const ins = body.insets;
  const justify = body.anchor === "ctr" ? "center" : body.anchor === "b" ? "flex-end" : "flex-start";
  const nowrap = body.wrap === "none";
  const empty = text.isEmpty;
  return (
    <div className="pptx-text" style={{ padding: `${px(ins.t)}px ${px(ins.r)}px ${px(ins.b)}px ${px(ins.l)}px`, justifyContent: cellMode ? "flex-start" : justify, whiteSpace: nowrap ? "pre" : "pre-wrap" }}>
      {empty && hint ? <div className="pptx-hint">{hint}</div> : paragraphs.map((p, i) => {
        const maxPt = Math.max(p.end.size, ...p.runs.map((r) => r.style.size));
        const fs = ptToPx(maxPt);
        const lh = p.lnSpc ? (p.lnSpc.pct ? p.lnSpc.pct * 1.2 : ptToPx(p.lnSpc.pts) / fs) : 1.2;
        const sp = (s) => (s ? (s.pts !== undefined ? ptToPx(s.pts) : s.pct * fs * 1.2) : 0);
        const bt = bulletText(p.bullet);
        const hang = Math.abs(px(p.indent));
        return (
          <div key={i} className="pptx-para" dir={p.rtl ? "rtl" : "ltr"} style={{ textAlign: p.algn === "ctr" ? "center" : p.algn === "r" ? "right" : p.algn === "just" ? "justify" : "left", paddingInlineStart: px(p.marL), textIndent: px(p.indent), marginTop: i ? sp(p.spcBef) : 0, marginBottom: sp(p.spcAft), lineHeight: lh, minHeight: `${fs * lh}px`, fontSize: fs }}>
            {bt && <span className="pptx-bullet" style={{ display: "inline-block", minWidth: hang || fs, textIndent: 0, color: rgba(p.runs[0]?.style.color || p.end.color), fontFamily: "Arial, sans-serif" }}>{bt}</span>}
            {p.runs.map((r, j) => {
              const s = r.style;
              return <span key={j} style={{ fontFamily: font(s.font), fontSize: ptToPx(s.size), fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal", textDecoration: [s.underline && "underline", s.strike && "line-through"].filter(Boolean).join(" ") || "none", color: rgba(s.color), backgroundColor: s.highlight ? rgba(s.highlight) : undefined, verticalAlign: s.baseline > 0 ? "super" : s.baseline < 0 ? "sub" : "baseline" }}>{r.text}</span>;
            })}
            {!p.runs.length && <span style={{ fontSize: fs }}>{"\u200b"}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** View-only chart drawn from the cached data in the file. Editing the chart is not supported. */
function ChartPreview({ info, w, h, note }) {
  const { shape, series, categories } = info.preview;
  const padT = info.title ? 34 : 14, padB = shape === "pie" ? 26 : 44, padL = shape === "hbar" ? 60 : 36, padR = 14;
  const iw = Math.max(10, w - padL - padR), ih = Math.max(10, h - padT - padB);
  const n = Math.max(...series.map((s) => s.values.length)), all = series.flatMap((s) => s.values);
  const max = Math.max(1e-9, ...all, 0), min = Math.min(0, ...all), span = max - min || 1;
  const label = (i) => categories[i] ?? String(i + 1);
  const fs = Math.max(9, Math.min(14, h / 22));
  let body = null;
  if (shape === "pie") {
    const vals = series[0].values.map((v) => Math.max(0, v)), tot = vals.reduce((a, b) => a + b, 0) || 1;
    const r = Math.min(iw, ih) / 2, cx = w / 2, cy = padT + ih / 2;
    let a0 = -Math.PI / 2;
    body = vals.map((v, i) => {
      const a1 = a0 + (v / tot) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
      a0 = a1;
      return <path key={i} d={d} fill={`#${["4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"][i % 6]}`} stroke="#fff" strokeWidth="1.5" />;
    });
  } else if (shape === "hbar") {
    const gh = ih / n, bh = (gh * 0.7) / series.length;
    body = <>{series.map((s, si) => s.values.map((v, i) => <rect key={`${si}-${i}`} x={padL} y={padT + i * gh + gh * 0.15 + si * bh} width={Math.max(0, ((v - Math.min(0, min)) / span) * iw)} height={bh} fill={`#${s.color}`} />))}
      {Array.from({ length: n }, (_, i) => <text key={i} x={padL - 6} y={padT + i * gh + gh / 2 + fs / 3} textAnchor="end" fontSize={fs} fill="#475569">{label(i)}</text>)}</>;
  } else {
    const gw = iw / n, bw = (gw * 0.7) / series.length, y = (v) => padT + ih - ((v - min) / span) * ih;
    body = (
      <>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={padL} x2={padL + iw} y1={padT + ih * t} y2={padT + ih * t} stroke="#e2e8f0" /><text x={padL - 5} y={padT + ih * t + fs / 3} textAnchor="end" fontSize={fs} fill="#64748b">{Number((max - span * t).toFixed(1))}</text></g>)}
        {shape === "col" ? series.map((s, si) => s.values.map((v, i) => <rect key={`${si}-${i}`} x={padL + i * gw + gw * 0.15 + si * bw} y={Math.min(y(v), y(0))} width={bw} height={Math.abs(y(v) - y(0))} fill={`#${s.color}`} />))
          : series.map((s, si) => <polyline key={si} fill="none" stroke={`#${s.color}`} strokeWidth="2.5" points={s.values.map((v, i) => `${padL + i * gw + gw / 2},${y(v)}`).join(" ")} />)}
        {Array.from({ length: n }, (_, i) => <text key={i} x={padL + i * gw + gw / 2} y={padT + ih + fs + 6} textAnchor="middle" fontSize={fs} fill="#475569">{label(i)}</text>)}
      </>
    );
  }
  return (
    <div className="pptx-chart" role="img" aria-label={`${info.title || info.type} (${note})`}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect width={w} height={h} fill="#fff" />
        {info.title && <text x={w / 2} y={22} textAnchor="middle" fontSize={Math.max(12, fs + 3)} fontWeight="700" fill="#1e293b">{info.title}</text>}
        {body}
      </svg>
      <span className="pptx-chart-note">{note}</span>
    </div>
  );
}

function TableView({ el, w, h }) {
  const t = el.table;
  if (!t) return <div className="pptx-object-card">Table</div>;
  const accent = t.accent.hex;
  return (
    <table className="pptx-table" style={{ width: w, height: h }}>
      <colgroup>{t.cols.map((c, i) => <col key={i} style={{ width: px(c) }} />)}</colgroup>
      <tbody>
        {t.rows.map((r, ri) => (
          <tr key={ri} style={{ height: px(r.h) }}>
            {r.cells.map((c, ci) => {
              if (c.hMerge || c.vMerge) return null;
              const head = t.firstRow && ri === 0;
              const band = t.bandRow && !head && ri % 2 === 1;
              const bg = c.fill?.type === "solid" ? rgba(c.fill) : head ? `#${accent}` : band ? `#${accent}22` : t.bandRow ? `#${accent}11` : "transparent";
              return (
                <td key={ci} colSpan={c.gridSpan} rowSpan={c.rowSpan} style={{ background: bg, color: head ? "#fff" : undefined, fontWeight: head ? 700 : undefined }}>
                  <TextBody text={c.text} cellMode />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ElementNode({ el, urls, hints, idPrefix, labels }) {
  if (el.hidden) return null;
  if (el.kind === "group") return <>{el.children.map((c, ci) => <ElementNode key={`${c.id}-${ci}`} el={c} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} />)}</>;
  const w = px(el.w), h = px(el.h);
  const style = { left: px(el.x), top: px(el.y), width: w, height: h, transform: el.rot ? `rotate(${el.rot}deg)` : undefined };
  let inner = null;
  switch (el.kind) {
    case "image": {
      const url = el.imagePath && urls[el.imagePath];
      const c = el.crop || { l: 0, t: 0, r: 0, b: 0 };
      const sw = 1 - c.l - c.r || 1, sh = 1 - c.t - c.b || 1;
      const round = el.geom?.kind === "ellipse" ? "50%" : undefined;
      inner = url ? (
        <div className="pptx-img" style={{ borderRadius: round, opacity: el.opacity }}>
          <img src={url} alt={el.alt || ""} draggable={false} style={{ width: `${100 / sw}%`, height: `${100 / sh}%`, left: `${(-c.l / sw) * 100}%`, top: `${(-c.t / sh) * 100}%`, transform: `${el.flipH ? "scaleX(-1)" : ""} ${el.flipV ? "scaleY(-1)" : ""}`.trim() || undefined }} />
        </div>
      ) : <div className="pptx-object-card">{el.mime ? labels.loading : labels.imageUnavailable}</div>;
      if (el.line && !el.line.none && el.line.hex) inner = <>{inner}<div className="pptx-img-border" style={{ borderColor: `#${el.line.hex}`, borderWidth: Math.max(1, px(el.line.w ?? 12700)), borderRadius: round }} /></>;
      break;
    }
    case "table": inner = <TableView el={el} w={w} h={h} />; break;
    case "chart": inner = el.chartInfo.preview
      ? <ChartPreview info={el.chartInfo} w={w} h={h} note={labels.chartPreview} />
      : <div className="pptx-object-card"><strong>{el.chartInfo.title || el.chartInfo.type}</strong>{el.chartInfo.title && <span>{el.chartInfo.type}</span>}<em>{labels.chartNote}</em></div>; break;
    case "diagram": inner = <div className="pptx-object-card"><strong>SmartArt</strong><em>{labels.viewOnly}</em></div>; break;
    case "object": inner = <div className="pptx-object-card"><strong>{el.name || "Object"}</strong><em>{labels.viewOnly}</em></div>; break;
    default:
      inner = (
        <>
          <Geometry el={el} w={w} h={h} idPrefix={idPrefix} />
          {el.text && <TextBody text={el.text} hint={hints && el.ph ? labels.placeholderHint : null} />}
        </>
      );
  }
  return <div className={`pptx-el pptx-el-${el.kind}`} data-id={el.id} style={style}>{inner}</div>;
}

function backgroundStyle(bg, urls) {
  if (!bg) return { background: "#fff" };
  if (bg.type === "solid") return { background: rgba(bg) };
  if (bg.type === "gradient") {
    const stops = bg.stops.map((s) => `${rgba(s)} ${s.pos * 100}%`).join(",");
    return { background: bg.radial ? `radial-gradient(circle,${stops})` : `linear-gradient(${bg.angle + 90}deg,${stops})` };
  }
  if (bg.type === "image" && urls[bg.path]) return { background: `center / cover no-repeat url(${urls[bg.path]})` };
  return { background: "#fff" };
}

/**
 * Pure presentation of a slide model. `overrides` (Map id → bounds) lets the
 * canvas preview a drag without touching the document; groups are previewed
 * with a CSS transform so content and selection frame stay in lock-step.
 */
export default function SlideView({ model, urls, overrides, hints = false, labels }) {
  const idPrefix = React.useId().replace(/:/g, "");
  const W = px(model.size.w), H = px(model.size.h);
  const renderTop = (el) => {
    const ov = overrides?.get(el.id);
    if (!ov) return <ElementNode key={el.id} el={el} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} />;
    if (el.kind === "group") {
      const sx = el.w ? ov.w / el.w : 1, sy = el.h ? ov.h / el.h : 1;
      const dx = ov.x + ov.w / 2 - (el.x + el.w / 2), dy = ov.y + ov.h / 2 - (el.y + el.h / 2);
      return (
        <div key={el.id} className="pptx-group-preview" style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h), transform: `translate(${px(dx)}px,${px(dy)}px) rotate(${ov.rot - el.rot}deg) scale(${sx},${sy})` }}>
          <div style={{ position: "absolute", left: -px(el.x), top: -px(el.y) }}>
            {el.children.map((c, ci) => <ElementNode key={`${c.id}-${ci}`} el={c} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} />)}
          </div>
        </div>
      );
    }
    return <ElementNode key={el.id} el={{ ...el, ...ov }} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} />;
  };
  return (
    <div className="pptx-slide" style={{ width: W, height: H, ...backgroundStyle(model.background, urls) }}>
      {model.under.map((el, ui) => <ElementNode key={`u${ui}`} el={el} urls={urls} hints={false} idPrefix={idPrefix} labels={labels} />)}
      {model.elements.map(renderTop)}
    </div>
  );
}

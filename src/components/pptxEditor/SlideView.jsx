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

function fillAttr(fill, id, defs, urls) {
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
  // Picture fills on shapes (a:blipFill) are how Canva and many template
  // exporters store every photo. Stretch the image over the shape's box;
  // until its blob URL arrives keep the neutral fallback and re-render.
  if (fill.type === "image") {
    const url = urls?.[fill.path];
    if (!url) return { fill: "#e2e8f0" };
    const pid = `img-${id}`;
    defs.push(
      <pattern key={pid} id={pid} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
        <image href={url} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
      </pattern>
    );
    return { fill: `url(#${pid})` };
  }
  return { fill: "#e2e8f0" };
}

function Geometry({ el, w, h, idPrefix, urls }) {
  const defs = [];
  const f = fillAttr(el.fill, `${idPrefix}${el.id}`, defs, urls);
  const ln = el.line || {};
  const sw = ln.none || ln.hex === undefined ? 0 : Math.max(0.5, px(ln.w ?? 12700));
  const stroke = sw ? { stroke: `#${ln.hex}`, strokeOpacity: ln.alpha, strokeWidth: sw, strokeDasharray: DASH[ln.dash], strokeLinejoin: "round" } : { stroke: "none" };
  const g = el.geom || { kind: "rect" };
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
    <svg className="pptx-geom" width={Math.max(w, 1)} height={Math.max(h, 1)} viewBox={`0 0 ${Math.max(w, 1)} ${Math.max(h, 1)}`} aria-hidden="true">
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

export function TextBody({ text, hint, cellMode = false, editing = false, elementId, frameW, frameH, onAutoSize, onEditStart, onCommit, onCancel }) {
  const containerRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const autoSizeFrameRef = React.useRef(0);
  const body = text?.body || {};
  const renderScale = 1;

  // While typing, measure the wrapped content and grow only this text element's
  // frame. The callback updates a temporary geometry draft; no neighboring
  // elements are moved or resized. Persist the same measured height on commit.
  const measureRequiredHeight = React.useCallback(() => {
    if (cellMode || !editing || !containerRef.current || !contentRef.current) return null;
    const container = containerRef.current;
    const content = contentRef.current;
    const css = window.getComputedStyle(container);
    const verticalPadding = (Number.parseFloat(css.paddingTop) || 0) + (Number.parseFloat(css.paddingBottom) || 0);
    const contentRect = content.getBoundingClientRect();
    const naturalContentHeight = Math.max(content.scrollHeight, content.offsetHeight, contentRect.height);
    if (!Number.isFinite(naturalContentHeight) || naturalContentHeight <= 0) return null;
    return Math.ceil((naturalContentHeight + verticalPadding + 1) * EMU_PER_PX);
  }, [cellMode, editing]);

  const requestContentFit = React.useCallback(() => {
    if (cellMode || !editing || !onAutoSize || !elementId || typeof window === "undefined") return;
    if (autoSizeFrameRef.current) window.cancelAnimationFrame(autoSizeFrameRef.current);
    autoSizeFrameRef.current = window.requestAnimationFrame(() => {
      autoSizeFrameRef.current = 0;
      const requiredHeight = measureRequiredHeight();
      if (Number.isFinite(requiredHeight)) onAutoSize(elementId, requiredHeight, true);
    });
  }, [cellMode, editing, onAutoSize, elementId, measureRequiredHeight]);

  React.useEffect(() => () => {
    if (autoSizeFrameRef.current && typeof window !== "undefined") window.cancelAnimationFrame(autoSizeFrameRef.current);
  }, []);

  React.useEffect(() => {
    if (!editing || !contentRef.current) return undefined;
    const editor = contentRef.current;
    editor.focus({ preventScroll: true });
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch { /* Focus still works if selection APIs are unavailable. */ }
    return undefined;
  }, [editing]);

  if (!text) return null;
  const { paragraphs } = text;
  const ins = body.insets || { t: 45720, r: 91440, b: 45720, l: 91440 };
  const justify = body.anchor === "ctr" ? "center" : body.anchor === "b" ? "flex-end" : "flex-start";
  const nowrap = body.wrap === "none";
  const empty = text.isEmpty;
  return (
    <div ref={containerRef} className={`pptx-text ${editing ? "is-inline-editing" : ""}`} style={{ padding: `${px(ins.t)}px ${px(ins.r)}px ${px(ins.b)}px ${px(ins.l)}px`, justifyContent: cellMode ? "flex-start" : justify, whiteSpace: nowrap ? "pre" : "pre-wrap" }}
      onDoubleClick={(event) => { if (!editing && onEditStart) { event.preventDefault(); event.stopPropagation(); onEditStart(); } }}>
      <div key={editing ? "editing-content" : "view-content"} ref={contentRef} className="pptx-text-content" data-auto-fit="none" data-auto-scale="1.000"
        contentEditable={editing} suppressContentEditableWarning={editing}
        onPointerDown={(event) => { if (editing) event.stopPropagation(); }}
        onInput={() => {
          if (!editing) return;
          requestContentFit();
          // contenteditable may scroll the slide/canvas viewport to keep the
          // caret visible. Preserve ancestor scroll positions so typing past
          // the slide bottom never makes the whole slide appear to move.
          const positions = [];
          let node = contentRef.current?.parentElement;
          while (node) {
            positions.push([node, node.scrollLeft, node.scrollTop]);
            node = node.parentElement;
          }
          const winX = window.scrollX, winY = window.scrollY;
          window.requestAnimationFrame(() => {
            for (const [target, left, top] of positions) {
              if (target.isConnected) { target.scrollLeft = left; target.scrollTop = top; }
            }
            if (window.scrollX !== winX || window.scrollY !== winY) window.scrollTo(winX, winY);
            // Chromium can perform its caret auto-scroll after the first frame.
            window.requestAnimationFrame(() => {
              for (const [target, left, top] of positions) {
                if (target.isConnected) { target.scrollLeft = left; target.scrollTop = top; }
              }
              if (window.scrollX !== winX || window.scrollY !== winY) window.scrollTo(winX, winY);
            });
          });
        }}
        onKeyDown={(event) => {
          if (!editing) return;
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel?.(); }
          else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); }
          else event.stopPropagation();
        }}
        onBlur={(event) => {
          if (!editing || !onCommit) return;
          const value = String(event.currentTarget.innerText ?? event.currentTarget.textContent ?? "").replace(/[\u200B\uFEFF]/g, "").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
          const requiredHeight = measureRequiredHeight();
          if (Number.isFinite(requiredHeight)) onAutoSize?.(elementId, requiredHeight, true);
          onCommit(value.split("\n"), requiredHeight);
        }}>
      {empty && hint ? <div className="pptx-hint">{hint}</div> : paragraphs.map((p, i) => {
        const maxPt = Math.max(p.end.size, ...p.runs.map((r) => r.style.size));
        const fs = ptToPx(maxPt) * renderScale;
        const lh = p.lnSpc ? (p.lnSpc.pct ? p.lnSpc.pct * 1.2 : ptToPx(p.lnSpc.pts) / Math.max(1, fs / renderScale)) : 1.2;
        const sp = (s) => (s ? (s.pts !== undefined ? ptToPx(s.pts) * renderScale : s.pct * fs * 1.2) : 0);
        const bt = bulletText(p.bullet);
        const hang = Math.abs(px(p.indent));
        return (
          <div key={i} className="pptx-para" dir={p.rtl ? "rtl" : "ltr"} style={{ textAlign: p.algn === "ctr" ? "center" : p.algn === "r" ? "right" : p.algn === "just" ? "justify" : "left", paddingInlineStart: px(p.marL) * renderScale, textIndent: px(p.indent) * renderScale, marginTop: i ? sp(p.spcBef) : 0, marginBottom: sp(p.spcAft), lineHeight: lh, minHeight: `${fs * lh}px`, fontSize: fs }}>
            {bt && <span className="pptx-bullet" style={{ display: "inline-block", minWidth: hang || fs, textIndent: 0, color: rgba(p.runs[0]?.style.color || p.end.color), fontFamily: "Arial, sans-serif" }}>{bt}</span>}
            {p.runs.map((r, j) => {
              const s = r.style;
              const visibleText = String(r.text ?? "").replace(/[\u200B\uFEFF]/g, "");
              return <span key={j} style={{ fontFamily: font(s.font), fontSize: ptToPx(s.size) * renderScale, fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal", textDecoration: [s.underline && "underline", s.strike && "line-through"].filter(Boolean).join(" ") || "none", color: rgba(s.color), backgroundColor: s.highlight ? rgba(s.highlight) : undefined, verticalAlign: s.baseline > 0 ? "super" : s.baseline < 0 ? "sub" : "baseline" }}>{visibleText}</span>;
            })}
            {/* An actual line break gives empty editable paragraphs a caret target;
                it is not persisted as text and avoids zero-width placeholder characters. */}
            {editing && p.runs.every((run) => !String(run.text ?? "").replace(/[\u200B\uFEFF]/g, "")) && <br data-empty-caret="true" aria-hidden="true" />}
          </div>
        );
      })}
      </div>
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

function TableView({ el, w, h, tableSelection, editingText, onTableCellSelect, onEditText, onTextCommit, onTextCancel }) {
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
              const head = !!t.firstRow && ri === 0;
              const firstCol = !!t.firstCol && ci === 0;
              const lastCol = !!t.lastCol && ci === t.cols.length - 1;
              const totalRow = !!t.lastRow && ri === t.rows.length - 1;
              const bandRow = !!t.bandRow && ri % 2 === 1 && !head;
              const bandCol = !!t.bandCol && ci % 2 === 1 && !head;
              const emphasized = head || firstCol || lastCol || totalRow;
              const bg = c.fill?.type === "solid" ? rgba(c.fill) : emphasized ? `#${accent}` : bandRow || bandCol ? `#${accent}22` : (t.bandRow || t.bandCol) ? `#${accent}0A` : "transparent";
              return (
                <td key={ci} colSpan={c.gridSpan} rowSpan={c.rowSpan}
                  className={tableSelection?.id === el.id && (tableSelection.scope === "table" || (tableSelection.scope === "row" && tableSelection.row === ri) || (tableSelection.scope === "column" && tableSelection.col === ci) || (tableSelection.scope === "cell" && tableSelection.row === ri && tableSelection.col === ci)) ? `is-table-${tableSelection.scope}-selected` : undefined}
                  style={{ background: bg, color: emphasized ? "#fff" : undefined, fontWeight: emphasized ? 700 : undefined }}
                  onClick={(event) => { event.stopPropagation(); onTableCellSelect?.(el.id, ri, ci); }}
                  onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); onEditText?.(el.id, { row: ri, col: ci }); }}>
                  <TextBody text={c.text} cellMode editing={editingText?.id === el.id && editingText?.row === ri && editingText?.col === ci}
                    onEditStart={() => onEditText?.(el.id, { row: ri, col: ci })}
                    onCommit={(texts) => onTextCommit?.(el.id, texts, { row: ri, col: ci })} onCancel={onTextCancel} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ElementNode({ el, urls, hints, idPrefix, labels, editingText, tableSelection, onTableCellSelect, onAutoSizeText, onEditText, onTextCommit, onTextCancel }) {
  if (el.hidden) return null;
  if (el.kind === "group") return <>{el.children.map((c, ci) => <ElementNode key={`${c.id}-${ci}`} el={c} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} editingText={editingText} tableSelection={tableSelection} onTableCellSelect={onTableCellSelect} onAutoSizeText={onAutoSizeText} onEditText={onEditText} onTextCommit={onTextCommit} onTextCancel={onTextCancel} />)}</>;
  const w = px(el.w), h = px(el.h);
  const transforms = [el.rot ? `rotate(${el.rot}deg)` : "", el.flipH ? "scaleX(-1)" : "", el.flipV ? "scaleY(-1)" : ""].filter(Boolean).join(" ");
  const style = { left: px(el.x), top: px(el.y), width: w, height: h, transform: transforms || undefined, transformOrigin: "center center" };
  let inner = null;
  switch (el.kind) {
    case "image": {
      const url = el.imagePath && urls[el.imagePath];
      const c = el.crop || { l: 0, t: 0, r: 0, b: 0 };
      const sw = 1 - c.l - c.r || 1, sh = 1 - c.t - c.b || 1;
      const round = el.geom?.kind === "ellipse" ? "50%" : undefined;
      inner = url ? (
        <div className="pptx-img" style={{ borderRadius: round, opacity: el.opacity }}>
          <img src={url} alt={el.alt || ""} draggable={false} style={{ width: `${100 / sw}%`, height: `${100 / sh}%`, left: `${(-c.l / sw) * 100}%`, top: `${(-c.t / sh) * 100}%`, transform: undefined }} />
        </div>
      ) : <div className="pptx-object-card">{el.mime ? labels.loading : labels.imageUnavailable}</div>;
      if (el.line && !el.line.none && el.line.hex) inner = <>{inner}<div className="pptx-img-border" style={{ borderColor: `#${el.line.hex}`, borderWidth: Math.max(1, px(el.line.w ?? 12700)), borderRadius: round, opacity: el.line.alpha ?? 1 }} /></>;
      break;
    }
    case "table": inner = <TableView el={el} w={w} h={h} tableSelection={tableSelection} editingText={editingText} onTableCellSelect={onTableCellSelect} onEditText={onEditText} onTextCommit={onTextCommit} onTextCancel={onTextCancel} />; break;
    case "chart": inner = el.chartInfo.preview
      ? <ChartPreview info={el.chartInfo} w={w} h={h} note={labels.chartPreview} />
      : <div className="pptx-object-card"><strong>{el.chartInfo.title || el.chartInfo.type}</strong>{el.chartInfo.title && <span>{el.chartInfo.type}</span>}<em>{labels.chartNote}</em></div>; break;
    case "diagram": inner = <div className="pptx-object-card"><strong>SmartArt</strong><em>{labels.viewOnly}</em></div>; break;
    case "object": inner = <div className="pptx-object-card"><strong>{el.name || "Object"}</strong><em>{labels.viewOnly}</em></div>; break;
    default:
      inner = (
        <>
          <Geometry el={el} w={w} h={h} idPrefix={idPrefix} urls={urls} />
          {el.text && <TextBody text={el.text} hint={hints && el.ph ? labels.placeholderHint : null}
            elementId={el.id} frameW={el.w} frameH={el.h} onAutoSize={onAutoSizeText}
            editing={editingText?.id === el.id && editingText?.row === undefined}
            onEditStart={() => onEditText?.(el.id)}
            onCommit={(texts, fittedHeight) => onTextCommit?.(el.id, texts, null, fittedHeight)} onCancel={onTextCancel} />}
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
export default function SlideView({ model, urls, overrides, geometryDrafts, hints = false, labels, editingText, tableSelection, onTableCellSelect, onAutoSizeText, onEditText, onTextCommit, onTextCancel }) {
  const idPrefix = React.useId().replace(/:/g, "");
  const W = px(model.size.w), H = px(model.size.h);
  const renderTop = (el) => {
    if (el.hidden) return null;
    const ov = overrides?.get(el.id);
    if (!ov) return <ElementNode key={el.id} el={el} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} editingText={editingText} tableSelection={tableSelection} onTableCellSelect={onTableCellSelect} onAutoSizeText={onAutoSizeText} onEditText={onEditText} onTextCommit={onTextCommit} onTextCancel={onTextCancel} />;
    // `geometryDrafts` is only the active pointer drag/resize preview. A height
    // override coming from textAutoSizeHeights is different: keep auto-sizing live
    // so additional typing or wrapping can continue to grow the selected frame.
    const suspendAutoSize = Boolean(geometryDrafts?.has(el.id));
    if (el.kind === "group") {
      const sx = el.w ? ov.w / el.w : 1, sy = el.h ? ov.h / el.h : 1;
      const dx = ov.x + ov.w / 2 - (el.x + el.w / 2), dy = ov.y + ov.h / 2 - (el.y + el.h / 2);
      return (
        <div key={el.id} className="pptx-group-preview" style={{ left: px(el.x), top: px(el.y), width: px(el.w), height: px(el.h), transform: `translate(${px(dx)}px,${px(dy)}px) rotate(${ov.rot - el.rot}deg) scale(${sx},${sy})` }}>
          <div style={{ position: "absolute", left: -px(el.x), top: -px(el.y) }}>
            {el.children.map((c, ci) => <ElementNode key={`${c.id}-${ci}`} el={c} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} editingText={editingText} tableSelection={tableSelection} onTableCellSelect={onTableCellSelect} onAutoSizeText={null} onEditText={onEditText} onTextCommit={onTextCommit} onTextCancel={onTextCancel} />)}
          </div>
        </div>
      );
    }
    // A table drag/commit preview carries its re-fitted grid so cells re-wrap live.
    const previewEl = el.kind === "table" && ov.tableGrid && el.table
      ? { ...el, ...ov, table: { ...el.table, cols: ov.tableGrid.cols, rows: el.table.rows.map((r, i) => ({ ...r, h: ov.tableGrid.rows[i] ?? r.h })) } }
      : { ...el, ...ov };
    return <ElementNode key={el.id} el={previewEl} urls={urls} hints={hints} idPrefix={idPrefix} labels={labels} editingText={editingText} tableSelection={tableSelection} onTableCellSelect={onTableCellSelect} onAutoSizeText={suspendAutoSize ? null : onAutoSizeText} onEditText={onEditText} onTextCommit={onTextCommit} onTextCancel={onTextCancel} />;
  };
  return (
    <div className="pptx-slide" style={{ width: W, height: H, ...backgroundStyle(model.background, urls) }}>
      {model.under.map((el, ui) => <ElementNode key={`u${ui}`} el={el} urls={urls} hints={false} idPrefix={idPrefix} labels={labels} />)}
      {model.elements.map(renderTop)}
    </div>
  );
}

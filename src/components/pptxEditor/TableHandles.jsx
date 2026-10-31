import React from "react";
import { Plus, Table2 } from "lucide-react";
import { EMU_PER_PX } from "./engine/slideModel.js";

const cumulative = (sizes) => sizes.reduce((acc, v) => { acc.push(acc[acc.length - 1] + v); return acc; }, [0]);

/**
 * Overlay controls around the single selected table (all in screen pixels, laid out from the model grid):
 *  - a small button at the top-left corner that selects the whole table,
 *  - draggable strips on every column / row border, the four outer edges included (mouse only: on touch the Canvas
 *    arms a border drag from the finger position instead, so taps always reach the cell underneath),
 *  - "+" buttons on all four edges, one per border point, that insert a column / row there.
 * Dragging itself is handled by the Canvas (onResizeStart); this component only renders and reports.
 */
export default function TableHandles({ x0, y0, s, cols, rows, canAdd, compact, drag, selected, labels, onSelectAll, onAdd, onResizeStart }) {
  const xs = cumulative(cols).map((v) => x0 + (v / EMU_PER_PX) * s);
  const ys = cumulative(rows).map((v) => y0 + (v / EMU_PER_PX) * s);
  const W = xs[xs.length - 1] - x0, H = ys[ys.length - 1] - y0;
  const stop = (e) => e.stopPropagation();
  const OUT = compact ? 12 : 18; // distance of the "+" buttons from the border
  // On touch layouts the "+" buttons that sit at a table corner would land on top of the corner resize handle,
  // so those few are pushed further out of the handle's touch area.
  const CORNER_OUT = compact ? 32 : OUT;
  // Border strips: every border (outer ones too) resizes its own column / row. Whole-table scaling is left to the
  // four corner handles, so the outer strips stop short of the corners to keep those handles reachable.
  const inset = 14;
  const outerC = (b) => (b === 0 || b === xs.length - 1) && H > 4 * inset;
  const outerR = (b) => (b === 0 || b === ys.length - 1) && W > 4 * inset;
  return (
    <>
      <button type="button" className={`pptx-tbl-select ${selected ? "is-active" : ""}`} style={{ left: Math.max(4, x0 - (compact ? 36 : 30)), top: Math.max(4, y0 - (compact ? 36 : 30)) }}
        title={labels.selectTable} aria-label={labels.selectTable} aria-pressed={!!selected}
        onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onSelectAll(); }}><Table2 size={14} aria-hidden="true" /></button>
      {xs.map((x, b) => (
        <div key={`c${b}`} className={`pptx-tbl-resize is-col ${drag?.kind === "col" && drag.border === b ? "is-dragging" : ""}`}
          style={{ left: x - 7, top: y0 + (outerC(b) ? inset : 0), height: Math.max(0, H - (outerC(b) ? 2 * inset : 0)) }}
          role="separator" aria-orientation="vertical" aria-label={labels.resizeColumn} title={labels.resizeColumn}
          onPointerDown={(e) => onResizeStart(e, "col", b)}><i /></div>
      ))}
      {ys.map((y, b) => (
        <div key={`r${b}`} className={`pptx-tbl-resize is-row ${drag?.kind === "row" && drag.border === b ? "is-dragging" : ""}`}
          style={{ left: x0 + (outerR(b) ? inset : 0), top: y - 7, width: Math.max(0, W - (outerR(b) ? 2 * inset : 0)) }}
          role="separator" aria-orientation="horizontal" aria-label={labels.resizeRow} title={labels.resizeRow}
          onPointerDown={(e) => onResizeStart(e, "row", b)}><i /></div>
      ))}
      {canAdd && !drag && <>
        {xs.map((x, j) => { const cornerX = j === 0 || j === xs.length - 1, out = cornerX ? CORNER_OUT : OUT; return [["top", y0 - out], ["bottom", y0 + H + out]].map(([edge, y]) => (
          <button key={`ac${j}${edge}`} type="button" className="pptx-tbl-add" style={{ left: x, top: y }} title={labels.addColumn} aria-label={labels.addColumn}
            onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onAdd("col", j); }}><Plus size={12} aria-hidden="true" /></button>
        )); })}
        {ys.map((y, i) => { const cornerY = i === 0 || i === ys.length - 1, out = cornerY ? CORNER_OUT : OUT; return [["left", x0 - out], ["right", x0 + W + out]].map(([edge, x]) => (
          <button key={`ar${i}${edge}`} type="button" className="pptx-tbl-add" style={{ left: x, top: y }} title={labels.addRow} aria-label={labels.addRow}
            onPointerDown={stop} onClick={(e) => { e.stopPropagation(); onAdd("row", i); }}><Plus size={12} aria-hidden="true" /></button>
        )); })}
      </>}
    </>
  );
}

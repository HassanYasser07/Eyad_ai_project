import React from "react";
import { BringToFront, Copy, FlipHorizontal2, FlipVertical2, ImagePlus, Minus, PaintBucket, Plus, SendToBack, Square, Droplet } from "lucide-react";
import { ColorField } from "./Controls.jsx";
import { Slider } from "@/components/ui/slider";
import CellToolbar from "./CellToolbar.jsx";

const hasContent = (e) => !!e?.text?.plain?.some((v) => String(v).trim());

/** Small −/+ stepper with a typed value, same look as the font-size box. */
function Stepper({ label, value, min, max, step = 1, decimals = 0, suffix, onCommit }) {
  const fmt = (v) => String(Number(Number(v).toFixed(decimals)));
  const [text, setText] = React.useState(fmt(value));
  React.useEffect(() => setText(fmt(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (raw) => {
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) { setText(fmt(value)); return; }
    const next = Math.min(max, Math.max(min, n));
    setText(fmt(next));
    if (next !== value) onCommit(next);
  };
  return (
    <span className="pptx-cell-size" title={label}>
      <button type="button" className="pptx-cell-btn" aria-label={`${label} −`} title={`${label} −`} onClick={() => commit(Number(value) - step)}><Minus size={14} aria-hidden="true" /></button>
      <input inputMode="decimal" value={text} aria-label={label} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); commit(Number(value) + (e.key === "ArrowUp" ? step : -step)); }
        }} />
      {suffix && <em className="pptx-tb-suffix">{suffix}</em>}
      <button type="button" className="pptx-cell-btn" aria-label={`${label} +`} title={`${label} +`} onClick={() => commit(Number(value) + step)}><Plus size={14} aria-hidden="true" /></button>
    </span>
  );
}

/** Opacity slider; the value is committed when the thumb is released (one undo step). */
function OpacitySlider({ label, value, onCommit }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return (
    <span className="pptx-tb-slider" title={label}>
      <Droplet size={15} aria-hidden="true" />
      <Slider variant="wave" className="pe-wave-slider-root" min={0} max={100} step={1} value={[v]} aria-label={label} onValueChange={([x]) => setV(x)} onValueCommit={([x]) => onCommit(x)} />
      <em>{Math.round(v)}%</em>
    </span>
  );
}

const Btn = ({ icon: Icon, label, onClick, disabled }) => (
  <button type="button" className="pptx-cell-btn" title={label} aria-label={label} disabled={disabled} onClick={onClick}><Icon size={16} aria-hidden="true" /></button>
);
const Sep = () => <i className="pptx-cell-sep" aria-hidden="true" />;

/**
 * Floating "what can I do with this?" bar shown for the current selection (anything except a picked table
 * cell, which has its own CellToolbar). It shows only the tools that make sense for the selected object(s):
 *   text / shape with text -> font, size, B/I/U/S, colours, alignment
 *   shape / line           -> fill, outline colour + width, opacity
 *   picture                -> opacity, replace image
 * plus flip / duplicate / layer order whenever the selection supports them.
 * Returns null when nothing in the selection can be edited (locked or unsupported).
 */
export default function SelectionToolbar({ sel, locked, a, t, themeColors, textStyle, opacity }) {
  if (!sel?.length) return null;
  const editable = (e) => !locked.has(e.id);
  const geoEditable = (e) => editable(e) && !e.readOnlyGeometry;
  const first = sel[0];

  const canText = sel.every((e) => editable(e) && e.kind !== "table" && (e.kind === "text" || hasContent(e)));
  const canShape = sel.every((e) => geoEditable(e) && (e.kind === "shape" || e.kind === "line"));
  const canFill = canShape && sel.every((e) => e.kind === "shape" && e.geom?.kind !== "line");
  const canImage = sel.every((e) => geoEditable(e) && e.kind === "image");
  const canReplace = canImage && sel.length === 1;
  const canFlip = sel.every((e) => geoEditable(e) && ["text", "shape", "line", "image", "table", "chart", "diagram", "group", "object"].includes(e.kind));
  const canArrange = sel.every(geoEditable);
  if (!canText && !canShape && !canImage && !canFlip && !canArrange) return null;

  const fillAlpha = first?.fill?.alpha ?? (first?.fill?.type === "gradient" ? first.fill.stops?.[0]?.alpha : 1) ?? 1;
  const lineOn = first?.line && !first.line.none;
  const lineW = (first?.line?.w ?? 12700) / 12700;
  const sections = [];

  if (canText) sections.push(<CellToolbar key="text" style={textStyle} themeColors={themeColors} t={t} onText={a.text} />);
  if (canShape) sections.push(
    <React.Fragment key="shape">
      {canFill && <span className="pptx-cell-color"><PaintBucket size={15} aria-hidden="true" />
        <ColorField label={t("pptxEditor.fill")} value={first?.fill?.type === "solid" ? first.fill.hex : null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")}
          onChange={(hex) => a.shape({ fill: { hex, alpha: fillAlpha } })} onNone={() => a.shape({ fill: { none: true } })} noneLabel={t("pptxEditor.noFill")} />
      </span>}
      <span className="pptx-cell-color"><Square size={15} aria-hidden="true" />
        <ColorField label={t("pptxEditor.line")} value={lineOn ? first.line.hex : null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")}
          onChange={(hex) => a.shape({ line: { hex, w: first?.line?.w || 12700, alpha: first?.line?.alpha ?? 1 } })} onNone={() => a.shape({ line: { none: true } })} noneLabel={t("pptxEditor.noFill")} />
      </span>
      <Stepper label={t("pptxEditor.width")} value={lineOn ? lineW : 0} min={0} max={50} step={0.5} decimals={1} suffix="pt"
        onCommit={(v) => a.shape({ line: v === 0 ? { none: true } : { w: v * 12700, hex: first?.line?.hex || "000000", alpha: first?.line?.alpha ?? 1 } })} />
      <OpacitySlider label={t("pptxEditor.opacity")} value={Math.round((opacity ?? 1) * 100)} onCommit={(v) => a.opacity(v / 100)} />
    </React.Fragment>,
  );
  if (canImage) sections.push(
    <React.Fragment key="image">
      <OpacitySlider label={t("pptxEditor.opacity")} value={Math.round((opacity ?? 1) * 100)} onCommit={(v) => a.opacity(v / 100)} />
      {canReplace && <Btn icon={ImagePlus} label={t("pptxEditor.replaceImage")} onClick={a.replaceImage} />}
    </React.Fragment>,
  );
  const common = (canFlip || canArrange) && (
    <React.Fragment key="common">
      {canFlip && <Btn icon={FlipHorizontal2} label={t("pptxEditor.flipH")} onClick={a.flipH} />}
      {canFlip && <Btn icon={FlipVertical2} label={t("pptxEditor.flipV")} onClick={a.flipV} />}
      {canArrange && <Btn icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} />}
      {canArrange && <Btn icon={BringToFront} label={t("pptxEditor.toFront")} onClick={() => a.order("front")} />}
      {canArrange && <Btn icon={SendToBack} label={t("pptxEditor.toBack")} onClick={() => a.order("back")} />}
    </React.Fragment>
  );
  if (common) sections.push(common);

  return <>{sections.map((node, i) => <React.Fragment key={node.key}>{i > 0 && <Sep />}{node}</React.Fragment>)}</>;
}

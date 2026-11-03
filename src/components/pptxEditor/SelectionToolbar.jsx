import React from "react";
import { BringToFront, Copy, FlipHorizontal2, FlipVertical2, ImagePlus, PaintBucket, SendToBack, Square, Droplet } from "lucide-react";
import { ColorField } from "./Controls.jsx";
import { RangeControl, Stepper, Segmented, Divider } from "@/components/editorKit";
import CellToolbar from "./CellToolbar.jsx";

const Sep = Divider;

const hasContent = (e) => !!e?.text?.plain?.some((v) => String(v).trim());

/** Opacity wave slider; the value is committed when the thumb is released (one undo step). */
function OpacitySlider({ label, value, onCommit, onLive, onLiveCancel }) {
  return (
    <span className="pptx-tb-slider" title={label}>
      <RangeControl compact editable integer icon={Droplet} label={label} value={value} min={0} max={100} step={1} suffix="%" onCommit={onCommit} onLive={onLive} onLiveCancel={onLiveCancel} />
    </span>
  );
}

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

  if (canText) sections.push(<CellToolbar key="text" style={textStyle} themeColors={themeColors} t={t} onText={a.text} onLiveText={a.live.text} />);
  if (canShape) sections.push(
    <React.Fragment key="shape">
      {canFill && <ColorField icon={PaintBucket} label={t("pptxEditor.fill")} value={first?.fill?.type === "solid" ? first.fill.hex : null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")} themeLabel={t("pptxEditor.themeColors")}
        onLive={(hex) => a.live.shape({ fill: { hex, alpha: fillAlpha } })} onChange={(hex) => a.shape({ fill: { hex, alpha: fillAlpha } })} onNone={() => a.shape({ fill: { none: true } })} noneLabel={t("pptxEditor.noFill")} />}
      <ColorField icon={Square} label={t("pptxEditor.line")} value={lineOn ? first.line.hex : null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")} themeLabel={t("pptxEditor.themeColors")}
        onLive={(hex) => a.live.shape({ line: { hex } })} onChange={(hex) => a.shape({ line: { hex, w: first?.line?.w || 12700, alpha: first?.line?.alpha ?? 1 } })} onNone={() => a.shape({ line: { none: true } })} noneLabel={t("pptxEditor.noFill")} />
      <Stepper label={t("pptxEditor.width")} value={lineOn ? lineW : 0} min={0} max={50} step={0.5} decimals={1} suffix="pt"
        onCommit={(v) => a.shape({ line: v === 0 ? { none: true } : { w: v * 12700, hex: first?.line?.hex || "000000", alpha: first?.line?.alpha ?? 1 } })} />
      <OpacitySlider label={t("pptxEditor.opacity")} value={Math.round((opacity ?? 1) * 100)} onCommit={(v) => a.opacity(v / 100)} onLive={(v) => a.live.opacity(v / 100)} onLiveCancel={a.live.cancel} />
    </React.Fragment>,
  );
  if (canImage) sections.push(
    <React.Fragment key="image">
      <OpacitySlider label={t("pptxEditor.opacity")} value={Math.round((opacity ?? 1) * 100)} onCommit={(v) => a.opacity(v / 100)} onLive={(v) => a.live.opacity(v / 100)} onLiveCancel={a.live.cancel} />
      {canReplace && <Segmented items={[{ key: "replace", icon: ImagePlus, label: t("pptxEditor.replaceImage"), onClick: a.replaceImage }]} />}
    </React.Fragment>,
  );
  const common = (canFlip || canArrange) && (
    <React.Fragment key="common">
      {canFlip && <Segmented items={[
        { key: "fh", icon: FlipHorizontal2, label: t("pptxEditor.flipH"), onClick: a.flipH },
        { key: "fv", icon: FlipVertical2, label: t("pptxEditor.flipV"), onClick: a.flipV },
      ]} />}
      {canArrange && <Segmented items={[
        { key: "dup", icon: Copy, label: t("pptxEditor.duplicate"), onClick: a.duplicate },
        { key: "front", icon: BringToFront, label: t("pptxEditor.toFront"), onClick: () => a.order("front") },
        { key: "back", icon: SendToBack, label: t("pptxEditor.toBack"), onClick: () => a.order("back") },
      ]} />}
    </React.Fragment>
  );
  if (common) sections.push(common);

  return <>{sections.map((node, i) => <React.Fragment key={node.key}>{i > 0 && <Sep />}{node}</React.Fragment>)}</>;
}

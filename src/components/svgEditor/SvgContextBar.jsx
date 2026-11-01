import React from "react";
import {
  Paintbrush, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, SlidersHorizontal, Droplet, Blend, MoveHorizontal,
} from "lucide-react";
import {
  RangeControl, ColorPickerCard, ColorSwatches, FontOptions, getElementMetrics, paintKey,
} from "@/components/svgEditor/svgEditorControls";
import colorsArt from "@/components/svgEditor/icons/colors.svg";
import appearanceArt from "@/components/svgEditor/icons/appearance.svg";
import typographyArt from "@/components/svgEditor/icons/typography.svg";

/**
 * Desktop top bar: everything that controls HOW the selected item looks.
 *
 *   [ Colors ]  fill / stroke targets + quick palette (original color first)
 *   [ Style  ]  opacity + stroke width            (two sliders, stacked)
 *   [ Text   ]  font, B / I / align, size + weight (two sliders, stacked), letter spacing
 *
 * Geometry (move / size / rotation / actions) lives in the properties sidebar.
 * The bar calls exactly the same handlers as the mobile sheets, so both modes expose
 * the same options. No column ever stacks more than two sliders.
 */
export default function SvgContextBar({
  selectedCount,
  isMobile = false,
  details,
  bounds,
  locked,
  paint,
  colorTarget,
  onColorTargetChange,
  onAttribute,
  onAttributeLive,
  t,
}) {
  const hasSingle = !!details && selectedCount === 1 && !details.definition;
  // Nothing selected (or the selected item's details are still loading): show the controls of an ordinary item,
  // all disabled, instead of a text hint. Multi-selections and definitions keep their hint.
  const isIdle = selectedCount === 0 || (selectedCount === 1 && !details);
  const m = getElementMetrics(isIdle ? null : details, bounds);
  const off = locked || isIdle;

  if (!hasSingle && !isIdle) {
    return (
      <div className="svg-editor-context-bar is-empty" style={{ display: isMobile ? "none" : "flex" }} data-svg-context-bar="desktop" role="toolbar" aria-label={t("svgEditor.contextBarLabel")}>
        <span className="svg-editor-context-hint"><SlidersHorizontal size={14} />{selectedCount > 1 ? t("svgEditor.contextBarMulti") : t("svgEditor.contextBarHint")}</span>
      </div>
    );
  }

  const { opacity, isTextElement, fontSize, fontWeight, letterSpacing, bold, italic, fontFamily, textAnchor } = m;
  const strokeWidth = isIdle ? 0 : m.strokeWidth;
  const IDLE_FILL = "#CBD5E1";
  const targetLabel = t(colorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke");
  const currentPaint = isIdle
    ? { raw: "", value: colorTarget === "fill" ? IDLE_FILL : "none" }
    : (paint?.current?.[colorTarget] || { raw: "", value: m.attrs[colorTarget] || (colorTarget === "fill" ? "#000000" : "none") });
  const originalPaint = isIdle ? null : (paint?.original?.[colorTarget] || null);
  // The stroke width does nothing while the stroke colour is "none", so its slider is disabled then.
  const strokeIsNone = paintKey(paint?.current?.stroke?.value ?? m.attrs.stroke ?? "none") === "none";
  const alignButtons = [
    { value: "start", icon: AlignLeft, label: t("svgEditor.alignStart") },
    { value: "middle", icon: AlignCenter, label: t("svgEditor.alignCenter") },
    { value: "end", icon: AlignRight, label: t("svgEditor.alignEnd") },
  ];
  const targets = [
    { key: "fill", icon: Droplet, label: t("svgEditor.fill") },
    { key: "stroke", icon: Paintbrush, label: t("svgEditor.stroke") },
  ];

  return (
    <div className={`svg-editor-context-bar ${isIdle ? "is-idle" : ""}`.trim()} style={{ display: isMobile ? "none" : "flex" }} data-svg-context-bar="desktop" aria-disabled={isIdle || undefined} role="toolbar" aria-label={t("svgEditor.contextBarLabel")}>
      {/* COLORS — target chips + quick palette */}
      <div className="svg-editor-context-group" data-group="colors">
        <span className="svg-editor-context-title" title={t("svgEditor.colors")}><img className="svg-editor-context-title-art" src={colorsArt} alt="" draggable="false" /><em>{t("svgEditor.colors")}</em></span>
        <div className="svg-editor-context-stack svg-editor-ctx-targets" role="radiogroup" aria-label={t("svgEditor.colorTarget")}>
          {targets.map(({ key, icon: Icon, label }) => (
            <div
              key={key}
              role="radio"
              aria-checked={colorTarget === key}
              className={`svg-editor-ctx-target ${colorTarget === key ? "is-active" : ""}`}
              onPointerDownCapture={() => { if (!isIdle) onColorTargetChange(key); }}
              onFocusCapture={() => { if (!isIdle) onColorTargetChange(key); }}
            >
              <span className="svg-editor-context-color-label"><Icon size={11} />{label}</span>
              <ColorPickerCard
                variant="chip"
                label={label}
                value={isIdle ? (key === "fill" ? IDLE_FILL : "none") : (paint?.current?.[key]?.value ?? m.attrs[key] ?? (key === "fill" ? "#000000" : "none"))}
                onChange={(color) => onAttribute(key, color)}
                onLive={(color) => onAttributeLive?.(key, color)}
                disabled={off}
                t={t}
              />
            </div>
          ))}
        </div>
        <ColorSwatches
          className="svg-editor-ctx-swatches"
          original={originalPaint}
          current={currentPaint}
          onPick={(value) => onAttribute(colorTarget, value)}
          disabled={off}
          targetLabel={targetLabel}
          t={t}
        />
      </div>

      {/* STYLE — opacity + stroke width (two stacked sliders) */}
      <div className="svg-editor-context-group" data-group="style">
        <span className="svg-editor-context-title" title={t("svgEditor.appearance")}><img className="svg-editor-context-title-art" src={appearanceArt} alt="" draggable="false" /><em>{t("svgEditor.appearance")}</em></span>
        <div className="svg-editor-context-stack">
          <div className="svg-editor-context-row">
            <RangeControl
              compact
              icon={Blend}
              label={t("svgEditor.opacityPercent")}
              value={opacity}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onCommit={(value) => onAttribute("opacity", Math.max(0, Math.min(100, value)) / 100)}
              onLive={(value) => onAttributeLive?.("opacity", Math.max(0, Math.min(100, value)) / 100)}
              disabled={off}
            />
            <div className="svg-editor-context-segment is-pills" role="group" aria-label={t("svgEditor.opacityPercent")}>
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} type="button" className={`svg-editor-context-pill ${Math.round(opacity) === pct ? "is-active" : ""}`} onClick={() => onAttribute("opacity", pct / 100)} disabled={off} aria-pressed={Math.round(opacity) === pct}>{pct}</button>
              ))}
            </div>
          </div>
          <div className="svg-editor-context-row">
            <RangeControl
              compact
              icon={Paintbrush}
              label={t("svgEditor.strokeWidth")}
              value={strokeWidth}
              min={0}
              max={Math.max(20, Math.min(1000, Math.ceil(strokeWidth * 2)))}
              step={0.5}
              suffix=" px"
              onCommit={(value) => onAttribute("stroke-width", value)}
              onLive={(value) => onAttributeLive?.("stroke-width", value)}
              disabled={off || strokeIsNone}
            />
          </div>
        </div>
      </div>

      {/* TEXT — only for text items */}
      {isTextElement && (
        <div className="svg-editor-context-group" data-group="text">
          <span className="svg-editor-context-title" title={t("svgEditor.typography")}><img className="svg-editor-context-title-art" src={typographyArt} alt="" draggable="false" /><em>{t("svgEditor.typography")}</em></span>
          <div className="svg-editor-context-stack">
            <div className="svg-editor-context-row">
              <label className="svg-editor-field is-inline svg-editor-context-font" title={t("svgEditor.fontFamily")}>
                <span className="svg-editor-sr-only">{t("svgEditor.fontFamily")}</span>
                <select value={fontFamily} disabled={off} aria-label={t("svgEditor.fontFamily")} onChange={(event) => onAttribute("font-family", event.target.value)}>
                  <FontOptions value={fontFamily} t={t} />
                </select>
              </label>
            </div>
            <div className="svg-editor-context-row">
              <div className="svg-editor-context-segment" role="group" aria-label={t("svgEditor.typography")}>
                <button type="button" className={`svg-editor-context-icon ${bold ? "is-active" : ""}`} onClick={() => onAttribute("font-weight", bold ? "400" : "700")} disabled={off} aria-pressed={bold} title={t("svgEditor.bold")} aria-label={t("svgEditor.bold")}><Bold size={15} /></button>
                <button type="button" className={`svg-editor-context-icon ${italic ? "is-active" : ""}`} onClick={() => onAttribute("font-style", italic ? "normal" : "italic")} disabled={off} aria-pressed={italic} title={t("svgEditor.italic")} aria-label={t("svgEditor.italic")}><Italic size={15} /></button>
              </div>
              <div className="svg-editor-context-segment" role="group" aria-label={t("svgEditor.textAlign")}>
                {alignButtons.map(({ value, icon: Icon, label }) => (
                  <button key={value} type="button" className={`svg-editor-context-icon ${textAnchor === value ? "is-active" : ""}`} onClick={() => onAttribute("text-anchor", value)} disabled={off} aria-pressed={textAnchor === value} title={label} aria-label={label}><Icon size={15} /></button>
                ))}
              </div>
            </div>
          </div>
          <div className="svg-editor-context-stack">
            <div className="svg-editor-context-row">
              <RangeControl
                compact
                icon={Type}
                label={t("svgEditor.fontSize")}
                value={fontSize}
                min={1}
                max={Math.max(200, Math.min(2000, Math.ceil(fontSize * 2)))}
                step={1}
                suffix=" px"
                onCommit={(value) => onAttribute("font-size", value)}
                onLive={(value) => onAttributeLive?.("font-size", value)}
                disabled={off}
              />
            </div>
            <div className="svg-editor-context-row">
              <RangeControl
                compact
                icon={Bold}
                label={t("svgEditor.fontWeight")}
                value={fontWeight}
                min={100}
                max={900}
                step={100}
                onCommit={(value) => onAttribute("font-weight", String(value))}
                onLive={(value) => onAttributeLive?.("font-weight", String(value))}
                disabled={off}
              />
            </div>
          </div>
          <div className="svg-editor-context-stack">
            <div className="svg-editor-context-row">
              <RangeControl
                compact
                icon={MoveHorizontal}
                label={t("svgEditor.letterSpacing")}
                value={letterSpacing}
                min={-40}
                max={Math.max(40, Math.min(400, Math.ceil(Math.abs(letterSpacing) * 2)))}
                step={0.5}
                suffix=" px"
                onCommit={(value) => onAttribute("letter-spacing", value)}
                onLive={(value) => onAttributeLive?.("letter-spacing", value)}
                disabled={off}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

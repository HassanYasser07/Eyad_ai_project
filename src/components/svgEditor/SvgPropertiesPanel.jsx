import React from "react";
import {
  SlidersHorizontal, FlipHorizontal, FlipVertical, Copy, Trash2,
  Group, Ungroup, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, Bold, Italic,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RotateCcw, Palette, Type,
  RotateCw, Blend, Paintbrush, Maximize2, Image, Sparkles, AlignLeft, AlignCenter, AlignRight, MoveHorizontal,
} from "lucide-react";
import typographyArt from "@/components/svgEditor/icons/typography.svg";
import { PenIcon, UploadIcon } from "@/components/svgEditor/svgEditorIcons";
import {
  FontOptions, getElementMetrics,
  NumberField, TextContentField, RangeControl, RotationHalfWheel, ColorPickerCard, ColorSwatches, QuickAction, NudgeButton, paintKey,
} from "@/components/svgEditor/svgEditorControls";

const SOLID_BG_PRESETS = [
  "#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#94a3b8", "#475569", "#1e293b", "#0f172a", "#000000",
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
];

const GRADIENT_PRESETS = [
  { name: "Sunset", color1: "#ff5e62", color2: "#ff9966", angle: 45 },
  { name: "Ocean", color1: "#2b5876", color2: "#4e4376", angle: 90 },
  { name: "Emerald", color1: "#11998e", color2: "#38ef7d", angle: 45 },
  { name: "Royal", color1: "#141e30", color2: "#243b55", angle: 90 },
  { name: "Violet", color1: "#8e2de2", color2: "#4a00e0", angle: 135 },
  { name: "Neon", color1: "#00c6ff", color2: "#0072ff", angle: 90 },
  { name: "Amber", color1: "#f12711", color2: "#f5af19", angle: 45 },
  { name: "Candy", color1: "#d946ef", color2: "#06b6d4", angle: 90 },
  { name: "Dark Slate", color1: "#0f172a", color2: "#334155", angle: 90 },
  { name: "Clean Gray", color1: "#f1f5f9", color2: "#cbd5e1", angle: 90 },
];

function BgToolbarButton({ icon: Icon, label, isActive, onClick, isDanger, disabled = false }) {
  return (
    <div className="svg-editor-bg-tool-wrapper">
      <button
        type="button"
        className={`svg-editor-bg-tool-btn ${isActive ? "is-active" : ""} ${isDanger ? "is-danger" : ""}`}
        onClick={onClick}
        aria-label={label}
        title={label}
        disabled={disabled}
      >
        <Icon size={17} />
        <span className="svg-editor-bg-tool-label">{label}</span>
      </button>
    </div>
  );
}

export default function SvgPropertiesPanel({
  selectedCount,
  details,
  bounds,
  onRename,
  onText,
  onTextLive,
  onSize,
  onSizeLive,
  onRotate,
  onRotateLive,
  onFlip,
  onAttribute,
  onAttributeLive,
  onLiveCancel,
  onNudge,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onEditText,
  activeMobileTab,
  paint,
  colorTarget = "fill",
  onColorTargetChange,
  onSetSolidBackground,
  onSetSolidBackgroundLive,
  onSetGradientBackgroundLive,
  onSetImageBackgroundLive,
  onRotateBackgroundLive,
  onSetGradientBackground,
  onSetImageBackground,
  onRotateBackground,
  onRemoveBackground,
  backgroundInfo,
  hasBackground = true,
  backgroundSubTab = "solid",
  onSelectBackgroundSubTab,
  locked,
  error,
  t,
  collapsed = false,
  onToggleCollapsed,
}) {
  const [nudgeStep, setNudgeStep] = React.useState(1);
  const [desktopTab, setDesktopTab] = React.useState(selectedCount > 0 ? "element" : "background");
  const [customColor1, setCustomColor1] = React.useState(backgroundInfo?.color1 || "#ff5e62");
  const [customColor2, setCustomColor2] = React.useState(backgroundInfo?.color2 || "#ff9966");
  const [customAngle, setCustomAngle] = React.useState(backgroundInfo?.angle || 45);
  const [customBgOpacity, setCustomBgOpacity] = React.useState(backgroundInfo?.opacity !== undefined ? Math.round(backgroundInfo.opacity * 100) : 100);
  const bgImageInputRef = React.useRef(null);

  React.useEffect(() => {
    if (selectedCount > 0) {
      setDesktopTab("element");
    } else {
      setDesktopTab("background");
    }
  }, [selectedCount]);

  React.useEffect(() => {
    if (backgroundInfo?.color1) setCustomColor1(backgroundInfo.color1);
    if (backgroundInfo?.color2) setCustomColor2(backgroundInfo.color2);
    if (backgroundInfo?.angle !== undefined) setCustomAngle(backgroundInfo.angle);
    if (backgroundInfo?.opacity !== undefined) setCustomBgOpacity(Math.round(backgroundInfo.opacity * 100));
  }, [backgroundInfo]);

  const {
    attrs, tag, supportsPosition, supportsSize, isTextElement, width, height, rotation,
    opacity, strokeWidth, fontSize, letterSpacing, bold, fontWeight, italic, fontFamily, textAnchor,
  } = getElementMetrics(details, bounds);
  const activeColorTarget = colorTarget;
  const currentPaint = paint?.current?.[activeColorTarget] || { raw: "", value: attrs[activeColorTarget] || (activeColorTarget === "fill" ? "#000000" : "none") };
  const originalPaint = paint?.original?.[activeColorTarget] || null;
  const colorValue = currentPaint.value;
  // The stroke width does nothing while the stroke colour is "none", so its slider is disabled then.
  const strokePaint = paint?.current?.stroke?.value ?? attrs.stroke ?? "none";
  const strokeIsNone = paintKey(strokePaint) === "none";
  const targetLabel = t(activeColorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke");

  const isBackgroundView = activeMobileTab === "background" || (!activeMobileTab && (desktopTab === "background" || selectedCount === 0));

  const isRotationEnabled = (backgroundSubTab === "gradient" || backgroundSubTab === "image") && backgroundSubTab !== "solid" && backgroundSubTab !== "clear";

  const currentBgRotation = backgroundSubTab === "gradient"
    ? (backgroundInfo?.angle !== undefined ? Number(backgroundInfo.angle) : Number(customAngle))
    : Number(backgroundInfo?.rotation || 0);

  const handleBgRotationCommit = React.useCallback((newAngle) => {
    if (!isRotationEnabled) return;
    if (backgroundSubTab === "gradient") {
      setCustomAngle(newAngle);
      onSetGradientBackground?.(customColor1, customColor2, newAngle);
    } else if (backgroundSubTab === "image") {
      onRotateBackground?.(newAngle);
    }
  }, [isRotationEnabled, backgroundSubTab, customColor1, customColor2, onSetGradientBackground, onRotateBackground]);

  const handleBgRotationLive = React.useCallback((newAngle) => {
    if (!isRotationEnabled) return;
    if (backgroundSubTab === "gradient") {
      setCustomAngle(newAngle);
      onSetGradientBackgroundLive?.(customColor1, customColor2, newAngle);
    } else if (backgroundSubTab === "image") {
      onRotateBackgroundLive?.(newAngle);
    }
  }, [isRotationEnabled, backgroundSubTab, customColor1, customColor2, onSetGradientBackgroundLive, onRotateBackgroundLive]);

  return (
    <section className={`svg-editor-panel svg-editor-properties-panel ${collapsed ? "is-collapsed" : ""}`} aria-label={t("svgEditor.propertiesTitle")}>
      <div className="svg-editor-panel-heading">
        <span><SlidersHorizontal size={16} /> <span className="svg-editor-panel-heading-label">{t("svgEditor.propertiesTitle")}</span></span>
        <div className="svg-editor-panel-heading-actions">
          {selectedCount > 0 && <small>{t("svgEditor.selectedCount", { count: selectedCount })}</small>}
          <button type="button" className="svg-editor-panel-toggle" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={t(collapsed ? "svgEditor.expandProperties" : "svgEditor.collapseProperties")} title={t(collapsed ? "svgEditor.expandProperties" : "svgEditor.collapseProperties")}>
            {collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>
      </div>
      <span className="svg-editor-rail-title" aria-hidden="true">{t("svgEditor.propertiesTitle")}</span>
      {!activeMobileTab && (
        <div className="svg-editor-panel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isBackgroundView}
            className={`svg-editor-panel-tab ${!isBackgroundView ? "is-active" : ""}`}
            onClick={() => {
              if (selectedCount > 0) setDesktopTab("element");
            }}
            disabled={selectedCount === 0}
            title={selectedCount === 0 ? (t("svgEditor.selectElement") || "Select an element to edit properties") : (t("svgEditor.element") || "Element Properties")}
          >
            <SlidersHorizontal size={13} />
            <span>{t("svgEditor.element") || "Element"}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isBackgroundView}
            className={`svg-editor-panel-tab ${isBackgroundView ? "is-active" : ""}`}
            onClick={() => setDesktopTab("background")}
            title={t("svgEditor.background") || "Background"}
          >
            <Image size={13} />
            <span>{t("svgEditor.background") || "Background"}</span>
          </button>
        </div>
      )}
      <div className="svg-editor-panel-content">
        {isBackgroundView ? (
          <div className="svg-editor-properties-scroll">
            <div className="svg-editor-property-section" data-section="background" data-tabs="background">
              <div className="svg-editor-bg-toolbar" role="toolbar" aria-label={t("svgEditor.background") || "Background options"}>
                <BgToolbarButton
                  icon={Palette}
                  label={t("svgEditor.solidColor") || "Solid Color"}
                  isActive={backgroundSubTab === "solid"}
                  onClick={() => onSelectBackgroundSubTab?.("solid")}
                />
                <BgToolbarButton
                  icon={Sparkles}
                  label={t("svgEditor.gradientColor") || "Gradient"}
                  isActive={backgroundSubTab === "gradient"}
                  onClick={() => onSelectBackgroundSubTab?.("gradient")}
                />
                <BgToolbarButton
                  icon={Image}
                  label={t("svgEditor.imageBackground") || "Image"}
                  isActive={backgroundSubTab === "image"}
                  onClick={() => onSelectBackgroundSubTab?.("image")}
                />
                <BgToolbarButton
                  icon={RotateCcw}
                  label={t("svgEditor.resetBgAction") || "Reset"}
                  isActive={false}
                  disabled={!hasBackground}
                  onClick={() => onRemoveBackground?.()}
                />
              </div>
              {backgroundSubTab === "solid" && (
                <div className="svg-editor-bg-pane">
                  <h3><Palette size={14} /> {t("svgEditor.solidColor") || "Solid Color"}</h3>
                  <div className="svg-editor-subcard">
                    <ColorPickerCard label={t("svgEditor.solidColor") || "Solid Color"} value={backgroundInfo?.color || "#ffffff"} onChange={(color) => onSetSolidBackground?.(color)} onLive={(color) => onSetSolidBackgroundLive?.(color)} t={t} />
                  </div>
                  <div className="svg-editor-subcard">
                  <div className="svg-editor-swatches-label" style={{ marginTop: 12 }}>{t("svgEditor.colorSwatches")}</div>
                  <div className="svg-editor-color-swatches">
                    {SOLID_BG_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`svg-editor-color-swatch ${(backgroundInfo?.color || "").toLowerCase() === color.toLowerCase() ? "is-selected" : ""}`}
                        style={{ "--swatch-color": color }}
                        title={color}
                        onClick={() => onSetSolidBackground?.(color)}
                      >
                        <span />
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
              )}

              {backgroundSubTab === "gradient" && (
                <div className="svg-editor-bg-pane">
                  <h3><Sparkles size={14} /> {t("svgEditor.gradientColor") || "Gradient Color"}</h3>
                  <div className="svg-editor-subcard svg-editor-gradient-presets-card">
                  <strong className="svg-editor-card-title">{t("svgEditor.gradientPresetsTitle") || "Preset gradients"}</strong>
                  <div className="svg-editor-gradient-presets">
                    {GRADIENT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className={`svg-editor-gradient-preset-card ${backgroundInfo?.color1 === preset.color1 && backgroundInfo?.color2 === preset.color2 ? "is-selected" : ""}`}
                        style={{ background: `linear-gradient(${preset.angle}deg, ${preset.color1}, ${preset.color2})` }}
                        title={preset.name}
                        onClick={() => {
                          setCustomColor1(preset.color1);
                          setCustomColor2(preset.color2);
                          setCustomAngle(preset.angle);
                          onSetGradientBackground?.(preset.color1, preset.color2, preset.angle);
                        }}
                      />
                    ))}
                  </div>
                  </div>

                  <div className="svg-editor-custom-gradient-box">
                    <strong>{t("svgEditor.customGradient") || "Custom Gradient"}</strong>
                    <div
                      className="svg-editor-gradient-preview"
                      style={{ background: `linear-gradient(${customAngle}deg, ${customColor1}, ${customColor2})` }}
                    />
                    <div className="svg-editor-gradient-color-pickers">
                      <ColorPickerCard label={t("svgEditor.color1") || "Color 1"} value={customColor1} onChange={(color) => { setCustomColor1(color); onSetGradientBackground?.(color, customColor2, customAngle); }} onLive={(color) => { setCustomColor1(color); onSetGradientBackgroundLive?.(color, customColor2, customAngle); }} t={t} />
                      <ColorPickerCard label={t("svgEditor.color2") || "Color 2"} value={customColor2} onChange={(color) => { setCustomColor2(color); onSetGradientBackground?.(customColor1, color, customAngle); }} onLive={(color) => { setCustomColor2(color); onSetGradientBackgroundLive?.(customColor1, color, customAngle); }} t={t} />
                    </div>

                  </div>
                </div>
              )}

              {backgroundSubTab === "image" && (
                <div className="svg-editor-bg-pane">
                  <h3><Image size={14} /> {t("svgEditor.imageBackground") || "Image Background"}</h3>
                  <input
                    ref={bgImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (loadEvent) => {
                        const dataUrl = loadEvent.target?.result;
                        if (dataUrl) onSetImageBackground?.(dataUrl, customBgOpacity / 100);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <div className="svg-editor-subcard">
                  <button
                    type="button"
                    className="svg-editor-primary-btn svg-editor-add-text-action svg-editor-pro-action svg-editor-upload-action"
                    onClick={() => bgImageInputRef.current?.click()}
                  >
                    <UploadIcon size={18} />
                    <span>{t("svgEditor.uploadBackgroundImage") || "Upload background photo"}</span>
                  </button>
                  </div>

                  {backgroundInfo?.type === "image" && (
                    <div className="svg-editor-subcard" style={{ marginTop: 14 }}>
                      <RangeControl
                        label={t("svgEditor.opacityPercent") || "Opacity"}
                        value={customBgOpacity}
                        min={0}
                        max={100}
                        step={1}
                        suffix="%"
                        onLive={(value) => {
                          if (backgroundInfo.imageHref) onSetImageBackgroundLive?.(backgroundInfo.imageHref, value / 100);
                        }}
                        onCommit={(value) => {
                          setCustomBgOpacity(value);
                          if (backgroundInfo.imageHref) {
                            onSetImageBackground?.(backgroundInfo.imageHref, value / 100);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {backgroundSubTab === "clear" && (
                <div className="svg-editor-bg-clear-panel">
                  <div className="svg-editor-bg-clear-icon">
                    <Trash2 size={24} />
                  </div>
                  <h4>{t("svgEditor.noBackgroundApplied") || "Transparent Background"}</h4>
                  <p>{t("svgEditor.clearBackgroundDesc") || "The background has been removed. Artwork has a transparent background."}</p>
                  <div className="svg-editor-bg-quick-presets">
                    <button
                      type="button"
                      className="svg-editor-secondary-button"
                      onClick={() => {
                        onSetSolidBackground?.("#ffffff");
                        onSelectBackgroundSubTab?.("solid");
                      }}
                    >
                      <Palette size={14} />
                      <span>{t("svgEditor.solidColor") || "Solid"}</span>
                    </button>
                    <button
                      type="button"
                      className="svg-editor-secondary-button"
                      onClick={() => {
                        onSetGradientBackground?.("#ff5e62", "#ff9966", 45);
                        onSelectBackgroundSubTab?.("gradient");
                      }}
                    >
                      <Sparkles size={14} />
                      <span>{t("svgEditor.gradientColor") || "Gradient"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Background Rotation Section — gradients and images only (a solid color has nothing to rotate) */}
              {backgroundSubTab !== "solid" && (
                <div className={`svg-editor-bg-rotation-box ${isRotationEnabled ? "is-enabled" : "is-disabled"}`}>
                  <div className="svg-editor-bg-rotation-header">
                    <h3><RotateCw size={13} /> {t("svgEditor.backgroundRotation") || "Background Rotation"}</h3>
                    <span className="svg-editor-bg-rotation-badge">
                      {isRotationEnabled ? `${currentBgRotation}°` : "0°"}
                    </span>
                  </div>
                  <div className="svg-editor-quick-pills" style={{ marginTop: 8 }}>
                    {[0, 90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        disabled={!isRotationEnabled}
                        className={`svg-editor-preset-pill ${isRotationEnabled && currentBgRotation === deg ? "is-active" : ""}`}
                        onClick={() => handleBgRotationCommit(deg)}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <RangeControl
                      label={t("svgEditor.rotation") || "Rotation"}
                      value={currentBgRotation}
                      min={0}
                      max={360}
                      step={5}
                      suffix="°"
                      disabled={!isRotationEnabled}
                      onCommit={(value) => handleBgRotationCommit(value)}
                      onLive={(value) => handleBgRotationLive(value)}
                    />
                  </div>
                  {!isRotationEnabled && (
                    <p className="svg-editor-rotation-disabled-hint">
                      {t("svgEditor.rotationDisabledForSolid") || "Rotation is only available for gradients and images."}
                    </p>
                  )}
                </div>
              )}
            </div>
            {error && <p className="svg-editor-inline-error" role="alert">{error}</p>}
          </div>
        ) : activeMobileTab === "typography" ? (
          <div className="svg-editor-properties-scroll" data-sheet="typography">
            {!details || selectedCount !== 1 || !isTextElement ? (
              <div className="svg-editor-property-empty"><strong>{t("svgEditor.selectElement")}</strong><p>{t("svgEditor.addTextHelp")}</p></div>
            ) : (
              <>
                {/* Same grouping, order and controls as the desktop "Typography" bar:
                    [ font · B I · align ]  [ size · weight ]  [ letter spacing ] */}
                <div className="svg-editor-context-group svg-editor-sheet-typography" data-group="text">
                  <span className="svg-editor-context-title"><img className="svg-editor-context-title-art" src={typographyArt} alt="" draggable="false" /><em>{t("svgEditor.typography")}</em></span>
                  <div className="svg-editor-context-stack">
                    <div className="svg-editor-context-row">
                      <label className="svg-editor-field is-inline svg-editor-context-font" title={t("svgEditor.fontFamily")}>
                        <span className="svg-editor-sr-only">{t("svgEditor.fontFamily")}</span>
                        <select value={fontFamily} disabled={locked} aria-label={t("svgEditor.fontFamily")} onChange={(event) => onAttribute("font-family", event.target.value)}>
                          <FontOptions value={fontFamily} t={t} />
                        </select>
                      </label>
                    </div>
                    <div className="svg-editor-context-row">
                      <div className="svg-editor-context-segment" role="group" aria-label={t("svgEditor.typography")}>
                        <button type="button" className={`svg-editor-context-icon ${bold ? "is-active" : ""}`} onClick={() => onAttribute("font-weight", bold ? "400" : "700")} disabled={locked} aria-pressed={bold} title={t("svgEditor.bold")} aria-label={t("svgEditor.bold")}><Bold size={15} /></button>
                        <button type="button" className={`svg-editor-context-icon ${italic ? "is-active" : ""}`} onClick={() => onAttribute("font-style", italic ? "normal" : "italic")} disabled={locked} aria-pressed={italic} title={t("svgEditor.italic")} aria-label={t("svgEditor.italic")}><Italic size={15} /></button>
                      </div>
                      <div className="svg-editor-context-segment" role="group" aria-label={t("svgEditor.textAlign")}>
                        {[["start", AlignLeft, t("svgEditor.alignStart")], ["middle", AlignCenter, t("svgEditor.alignCenter")], ["end", AlignRight, t("svgEditor.alignEnd")]].map(([value, Icon, label]) => (
                          <button key={value} type="button" className={`svg-editor-context-icon ${textAnchor === value ? "is-active" : ""}`} onClick={() => onAttribute("text-anchor", value)} disabled={locked} aria-pressed={textAnchor === value} title={label} aria-label={label}><Icon size={15} /></button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="svg-editor-context-stack">
                    <div className="svg-editor-context-row">
                      <RangeControl compact icon={Type} label={t("svgEditor.fontSize")} value={fontSize} min={1} max={Math.max(200, Math.min(2000, Math.ceil(fontSize * 2)))} step={1} suffix=" px" onCommit={(value) => onAttribute("font-size", value)} onLive={(value) => onAttributeLive?.("font-size", value)} disabled={locked} />
                    </div>
                    <div className="svg-editor-context-row">
                      <RangeControl compact icon={Bold} label={t("svgEditor.fontWeight")} value={fontWeight} min={100} max={900} step={100} onCommit={(value) => onAttribute("font-weight", String(value))} onLive={(value) => onAttributeLive?.("font-weight", String(value))} disabled={locked} />
                    </div>
                  </div>
                  <div className="svg-editor-context-stack">
                    <div className="svg-editor-context-row">
                      <RangeControl compact icon={MoveHorizontal} label={t("svgEditor.letterSpacing")} value={letterSpacing} min={-40} max={Math.max(40, Math.min(400, Math.ceil(Math.abs(letterSpacing) * 2)))} step={0.5} suffix=" px" onCommit={(value) => onAttribute("letter-spacing", value)} onLive={(value) => onAttributeLive?.("letter-spacing", value)} disabled={locked} />
                    </div>
                  </div>
                </div>
              </>
            )}
            {error && <p className="svg-editor-inline-error" role="alert">{error}</p>}
          </div>
        ) : activeMobileTab === "text" ? (
          <div className="svg-editor-properties-scroll">
            <div className="svg-editor-property-section" data-section="text" data-tabs="text">
              <h3><Type size={14} /> {t("svgEditor.text") || "Text"}</h3>
              {details?.textEditable || isTextElement ? (
                <label className="svg-editor-field svg-editor-text-field" style={{ marginTop: 12 }}>
                  <span>{t("svgEditor.textContent")}</span>
                  <TextContentField id={details.id} value={details.textContent} disabled={locked} onLive={onTextLive} onCommit={onText} />
                </label>
              ) : <p className="svg-editor-help" style={{ marginTop: 10 }}>{t("svgEditor.addTextHelp")}</p>}
            </div>
            {error && <p className="svg-editor-inline-error" role="alert">{error}</p>}
          </div>
        ) : !details || selectedCount !== 1 ? (
          <div className="svg-editor-property-empty">
            <span className="svg-editor-property-empty-icon"><SlidersHorizontal size={20} /></span>
            <strong>{selectedCount > 1 ? t("svgEditor.selectedCount", { count: selectedCount }) : t("svgEditor.selectElement")}</strong>
            <p>{selectedCount > 1 ? t("svgEditor.multiSelectHelp") : t("svgEditor.selectionHelp")}</p>
          </div>
        ) : details.definition ? (
          <div className="svg-editor-property-empty"><strong>{t("svgEditor.definitionTitle")}</strong><p>{t("svgEditor.definitionHelp")}</p></div>
        ) : (
          <div className="svg-editor-properties-scroll">
            <label className="svg-editor-field svg-editor-name-field">
              <span>{t("svgEditor.editorLabel")}</span>
              <input key={details.id} defaultValue={details.label} disabled={locked} onBlur={(event) => { if (event.target.value !== details.label) onRename(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} maxLength={80} />
            </label>

            {/* TEXT CONTENT — for text items it sits right under the label, ABOVE the Arrange card.
                (Typography itself lives in the desktop top bar / mobile "Typography" sheet.) */}
            {details.textEditable && <div className="svg-editor-property-section" data-section="text" data-tabs="text">
              <h3>{t("svgEditor.textContent")}</h3>
              <label className="svg-editor-field svg-editor-text-field">
                <span>{t("svgEditor.textContent")}</span>
                <TextContentField id={details.id} value={details.textContent} disabled={locked} onLive={onTextLive} onCommit={onText} />
              </label>
            </div>}

            {/* 1. ARRANGE — everything that moves / transforms the item:
                   precise move, then (directly underneath) duplicate / group / flip / delete, then rotation. */}
            <div className="svg-editor-property-section" data-section="controls" data-tabs="controls">
              <h3><SlidersHorizontal size={13} />{t("svgEditor.arrange")}</h3>
              {activeMobileTab === "controls" && isTextElement && (
                <div className="svg-editor-subcard svg-editor-edit-text-card">
                  <button type="button" className="svg-editor-pro-action svg-editor-edit-text-action" onClick={onEditText} disabled={locked}>
                    <PenIcon size={26} /><span>{t("svgEditor.editText") || "Edit text"}</span>
                  </button>
                </div>
              )}
              <div className="svg-editor-arrange-stack">
                {supportsPosition && (
                  <div className="svg-editor-subcard svg-editor-nudge-wrap">
                    <div className="svg-editor-nudge-heading">
                      <strong>{t("svgEditor.preciseMove")}</strong>
                      <div className="svg-editor-nudge-step">
                        <span>{t("svgEditor.moveStep")}</span>
                        <output className="svg-editor-nudge-step-value" aria-live="polite">{Number(nudgeStep.toFixed(1))}</output>
                        <span className="svg-editor-nudge-step-arrows">
                          <button type="button" aria-label="Increase move step" title="Increase move step" disabled={locked || nudgeStep >= 1000} onClick={() => setNudgeStep(Math.min(1000, Math.round((nudgeStep + 0.1) * 10) / 10))}><ChevronUp size={11} /></button>
                          <button type="button" aria-label="Decrease move step" title="Decrease move step" disabled={locked || nudgeStep <= 0.1} onClick={() => setNudgeStep(Math.max(0.1, Math.round((nudgeStep - 0.1) * 10) / 10))}><ChevronDown size={11} /></button>
                        </span>
                      </div>
                    </div>
                    <div className="svg-editor-nudge-grid">
                      <span />
                      <NudgeButton icon={ArrowUp} label={t("svgEditor.moveUp")} onClick={() => onNudge(0, -nudgeStep)} disabled={locked} />
                      <span />
                      <NudgeButton icon={ArrowLeft} label={t("svgEditor.moveLeft")} onClick={() => onNudge(-nudgeStep, 0)} disabled={locked} />
                      <NudgeButton icon={ArrowDown} label={t("svgEditor.moveDown")} onClick={() => onNudge(0, nudgeStep)} disabled={locked} />
                      <NudgeButton icon={ArrowRight} label={t("svgEditor.moveRight")} onClick={() => onNudge(nudgeStep, 0)} disabled={locked} />
                    </div>
                  </div>
                )}
                <div className="svg-editor-subcard svg-editor-actions-card">
                  <div className="svg-editor-action-grid">
                    <QuickAction icon={Copy} label={t("svgEditor.duplicate")} onClick={onDuplicate} disabled={locked} />
                    {tag === "g" ? <QuickAction icon={Ungroup} label={t("svgEditor.ungroup")} onClick={onUngroup} disabled={locked} /> : <QuickAction icon={Group} label={t("svgEditor.groupSelection")} onClick={onGroup} disabled={locked || selectedCount < 2} />}
                    <QuickAction icon={FlipHorizontal} label={t("svgEditor.flipHorizontal")} onClick={() => onFlip("x", bounds)} disabled={locked} />
                    <QuickAction icon={FlipVertical} label={t("svgEditor.flipVertical")} onClick={() => onFlip("y", bounds)} disabled={locked} />
                    <QuickAction icon={Trash2} label={t("svgEditor.delete")} onClick={onDelete} disabled={locked} danger />
                  </div>
                </div>
              </div>
              {supportsPosition && (
                <div className="svg-editor-subcard svg-editor-rotation-card">
                  <div className="svg-editor-subcard-title"><RotateCw size={13} />{t("svgEditor.rotation")}</div>
                  <RotationHalfWheel value={rotation} onCommit={(value) => onRotate(value, bounds)} onLive={(value) => onRotateLive?.(value, bounds)} disabled={locked} label={t("svgEditor.rotation")} hint={t("svgEditor.rotationWheelHint")} />
                  <div className="svg-editor-rotation-fields">
                    <NumberField label={t("svgEditor.rotation")} value={rotation} min={-180} max={180} step={1} suffix="°" onCommit={(value) => onRotate(value, bounds)} onLive={(value) => onRotateLive?.(value, bounds)} onLiveCancel={onLiveCancel} disabled={locked} />
                    <div className="svg-editor-inline-actions">
                      <QuickAction icon={RotateCcw} label={t("svgEditor.resetRotation")} onClick={() => onRotate(0, bounds)} disabled={locked || Number(rotation) === 0} />
                      <QuickAction icon={RotateCw} label="+90°" onClick={() => onRotate(((Number(rotation) || 0) + 90 + 180) % 360 - 180, bounds)} disabled={locked} />
                      <QuickAction icon={RotateCcw} label="-90°" onClick={() => onRotate(((Number(rotation) || 0) - 90 + 180) % 360 - 180, bounds)} disabled={locked} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. SIZE — scale, then width + height (two stacked sliders; the typed value is the only readout,
                   and it is always a whole number). Same section on desktop and in the mobile "Size" sheet. */}
            {supportsPosition && supportsSize && (
              <div className="svg-editor-property-section" data-section="size" data-tabs="size">
                <h3><Maximize2 size={13} />{t("svgEditor.size") || "Size"}</h3>
                <div className="svg-editor-subcard svg-editor-scale-card">
                  <RangeControl
                    key={`uniform-scale-${details.id}`}
                    label={t("svgEditor.scale")}
                    value={100}
                    min={10}
                    max={300}
                    step={1}
                    suffix="%"
                    snapBack
                    onCommit={(value) => onSize("scale", value / 100, bounds)}
                    onLive={(value) => onSizeLive?.("scale", value / 100, bounds)}
                    disabled={locked}
                  />
                </div>
                <div className="svg-editor-subcard svg-editor-size-card">
                  <RangeControl
                    editable
                    integer
                    label={t("svgEditor.width")}
                    value={width}
                    min={1}
                    max={Math.max(200, Math.min(10000, Math.ceil(Math.max(1, width) * 2)))}
                    step={1}
                    suffix="px"
                    onCommit={(value) => onSize("width", value, bounds)}
                    onLive={(value) => onSizeLive?.("width", value, bounds)}
                    onLiveCancel={onLiveCancel}
                    disabled={locked}
                  />
                  <RangeControl
                    editable
                    integer
                    label={t("svgEditor.height")}
                    value={height}
                    min={1}
                    max={Math.max(200, Math.min(10000, Math.ceil(Math.max(1, height) * 2)))}
                    step={1}
                    suffix="px"
                    onCommit={(value) => onSize("height", value, bounds)}
                    onLive={(value) => onSizeLive?.("height", value, bounds)}
                    onLiveCancel={onLiveCancel}
                    disabled={locked}
                  />
                </div>
              </div>
            )}

            {/* 3. COLORS — desktop: lives in the top bar. Mobile: the "Colors" sheet
                   (target, picker, quick palette with the ORIGINAL color first, opacity + stroke width). */}
            <div className="svg-editor-property-section svg-editor-mobile-only" data-section="colors" data-tabs="colors">
              <h3><Palette size={13} />{t("svgEditor.colors") || t("svgEditor.appearance")}</h3>
              <div className="svg-editor-subcard svg-editor-colors-main">
                <div className="svg-editor-color-targets" role="group" aria-label={t("svgEditor.colorTarget")}>
                  <button type="button" className={activeColorTarget === "fill" ? "is-active" : ""} onClick={() => onColorTargetChange?.("fill")}><span className="svg-editor-color-target-dot is-fill" />{t("svgEditor.fill")}</button>
                  <button type="button" className={activeColorTarget === "stroke" ? "is-active" : ""} onClick={() => onColorTargetChange?.("stroke")}><span className="svg-editor-color-target-dot is-stroke" />{t("svgEditor.stroke")}</button>
                </div>
                <ColorPickerCard label={targetLabel} value={colorValue} onChange={(color) => onAttribute(activeColorTarget, color)} onLive={(color) => onAttributeLive?.(activeColorTarget, color)} disabled={locked} t={t} />
              </div>
              <div className="svg-editor-subcard svg-editor-swatches-card">
                <div className="svg-editor-swatches-label">{t("svgEditor.colorSwatches")}</div>
                <ColorSwatches original={originalPaint} current={currentPaint} onPick={(value) => onAttribute(activeColorTarget, value)} disabled={locked} targetLabel={targetLabel} t={t} />
                <p className="svg-editor-help">{t("svgEditor.gradientHelp")}</p>
              </div>
              <div className="svg-editor-subcard svg-editor-opacity-card">
                <RangeControl label={t("svgEditor.opacityPercent")} icon={Blend} value={opacity} min={0} max={100} step={1} suffix="%" onCommit={(value) => onAttribute("opacity", Math.max(0, Math.min(100, value)) / 100)} onLive={(value) => onAttributeLive?.("opacity", Math.max(0, Math.min(100, value)) / 100)} disabled={locked} />
                <div className="svg-editor-quick-pills">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} type="button" className={`svg-editor-preset-pill ${Math.round(opacity) === pct ? "is-active" : ""}`} onClick={() => onAttribute("opacity", pct / 100)} disabled={locked}>
                      {pct}%
                    </button>
                  ))}
                </div>
                <RangeControl label={t("svgEditor.strokeWidth")} icon={Paintbrush} value={strokeWidth} min={0} max={Math.max(20, Math.min(1000, Math.ceil(strokeWidth * 2)))} step={0.5} suffix=" px" onCommit={(value) => onAttribute("stroke-width", value)} onLive={(value) => onAttributeLive?.("stroke-width", value)} disabled={locked || strokeIsNone} />
              </div>
            </div>

            {error && <p className="svg-editor-inline-error" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

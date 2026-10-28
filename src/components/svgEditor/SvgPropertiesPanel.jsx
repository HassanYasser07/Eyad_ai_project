import React from "react";
import {
  SlidersHorizontal, FlipHorizontal, FlipVertical, Copy, Trash2,
  Group, Ungroup, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, Bold, Italic,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoveHorizontal, RotateCcw, Palette, Type,
  RotateCw, Blend, Paintbrush, Maximize2, Image, Sparkles, Upload, Pipette,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

const COLOR_PRESETS = [
  "#111827", "#334155", "#64748b", "#ffffff", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
];

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
const FONT_PRESETS = [
  ["Arial, Helvetica, sans-serif", "Arial"],
  ["Helvetica, Arial, sans-serif", "Helvetica"],
  ["Georgia, serif", "Georgia"],
  ["'Times New Roman', serif", "Times New Roman"],
  ["'Trebuchet MS', sans-serif", "Trebuchet MS"],
  ["Verdana, sans-serif", "Verdana"],
  ["Tahoma, sans-serif", "Tahoma"],
  ["'Courier New', monospace", "Courier New"],
  ["system-ui, sans-serif", "System UI"],
];

function numericValue(value, fallback = 0) {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

function NumberField({ label, value, onCommit, min, max, step = 1, disabled = false, suffix }) {
  const [draft, setDraft] = React.useState(String(value ?? 0));
  React.useEffect(() => setDraft(String(value ?? 0)), [value]);
  const commit = () => {
    if (draft.trim() === "") return;
    const parsed = Number(draft);
    const withinBounds = Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max);
    if (withinBounds && parsed !== Number(value)) onCommit(parsed);
    else setDraft(String(value ?? 0));
  };

  return (
    <label className="svg-editor-field">
      <span>{label}</span>
      <div className="svg-editor-number-input-wrap">
        <input
          type="number"
          value={draft}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
        {suffix && <span className="svg-editor-input-suffix">{suffix}</span>}
      </div>
    </label>
  );
}

function RangeControl({ label, value, min, max, step = 1, suffix = "", onCommit, disabled = false, icon: Icon }) {
  const numeric = numericValue(value, min);
  const safeMax = Math.max(min + step, max, numeric);
  const initial = Math.max(min, Math.min(safeMax, numeric));
  const [draft, setDraft] = React.useState(initial);
  React.useEffect(() => setDraft(Math.max(min, Math.min(safeMax, numericValue(value, min)))), [value, min, safeMax]);
  const shown = Math.abs(draft) < 0.0001 ? 0 : Number(draft.toFixed(step < 1 ? 2 : 0));

  return (
    <div className="svg-editor-range-control">
      <div className="svg-editor-range-heading">
        <span className="svg-editor-range-label">{Icon && <Icon size={13} />}{label}</span>
        <output className="svg-editor-range-output">{shown}{suffix}</output>
      </div>
      <Slider
        aria-label={label}
        value={[draft]}
        min={min}
        max={safeMax}
        step={step}
        disabled={disabled}
        onValueChange={(values) => setDraft(values[0] ?? min)}
        onValueCommit={(values) => {
          const next = values[0] ?? min;
          setDraft(next);
          if (next !== numeric) onCommit(next);
        }}
        className="svg-editor-range-slider"
      />
      <div className="svg-editor-range-scale"><span>{min}{suffix}</span><span>{safeMax}{suffix}</span></div>
    </div>
  );
}

function normalizeAngle(value) {
  const angle = numericValue(value, 0);
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

function RotationWheel({ value, onCommit, disabled, label, hint }) {
  const currentValue = normalizeAngle(value);
  const [draft, setDraft] = React.useState(currentValue);
  const dragging = React.useRef(false);
  React.useEffect(() => setDraft(currentValue), [currentValue]);

  const valueFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return normalizeAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  };
  const startDrag = (event) => {
    if (disabled) return;
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraft(valueFromPointer(event));
  };
  const moveDrag = (event) => {
    if (dragging.current) setDraft(valueFromPointer(event));
  };
  const endDrag = (event) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = valueFromPointer(event);
    setDraft(next);
    if (next !== currentValue) onCommit(next);
  };
  const handleKeys = (event) => {
    let next = draft;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += event.shiftKey ? 15 : 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= event.shiftKey ? 15 : 1;
    else if (event.key === "Home") next = 0;
    else return;
    event.preventDefault();
    next = normalizeAngle(next);
    setDraft(next);
    onCommit(next);
  };
  const radians = draft * Math.PI / 180;
  const endX = 40 + Math.cos(radians) * 23;
  const endY = 40 + Math.sin(radians) * 23;

  return (
    <div className="svg-editor-rotation-control">
      <div className="svg-editor-rotation-wheel-wrap">
        <div
          className={`svg-editor-rotation-wheel ${disabled ? "is-disabled" : ""}`}
          role="slider"
          aria-label={label}
          aria-valuemin={-180}
          aria-valuemax={180}
          aria-valuenow={Math.round(draft)}
          aria-valuetext={`${Math.round(draft)}°`}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeys}
        >
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle className="svg-editor-wheel-track" cx="40" cy="40" r="31" />
            {Array.from({ length: 24 }, (_, index) => {
              const angle = index * 15;
              const rad = angle * Math.PI / 180;
              const major = index % 3 === 0;
              return <line key={angle} className={`svg-editor-wheel-tick ${major ? "is-major" : ""}`} x1={40 + Math.cos(rad) * (major ? 25 : 27)} y1={40 + Math.sin(rad) * (major ? 25 : 27)} x2={40 + Math.cos(rad) * 29} y2={40 + Math.sin(rad) * 29} />;
            })}
            <line className="svg-editor-wheel-needle" x1="40" y1="40" x2={endX} y2={endY} />
            <circle className="svg-editor-wheel-hub" cx="40" cy="40" r="4.5" />
            <circle className="svg-editor-wheel-handle" cx={endX} cy={endY} r="4" />
          </svg>
          <span className="svg-editor-wheel-center">{Math.round(draft)}°</span>
        </div>
      </div>
      <div className="svg-editor-rotation-meta">
        <strong>{label}</strong>
        <span>{hint}</span>
        <div className="svg-editor-angle-presets">
          {[-90, -45, 0, 45, 90].map((angle) => (
            <button type="button" key={angle} onClick={() => { setDraft(angle); onCommit(angle); }} disabled={disabled} className={normalizeAngle(value) === angle ? "is-active" : ""}>{angle}°</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((item) => item + item).join("")}`;
  return "#000000";
}

function ColorPickerCard({ label, value, onChange, disabled = false, t }) {
  const normalized = normalizeColor(value);
  const rawValue = String(value || "").trim();
  const hasSolidHexValue = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(rawValue);
  const [draft, setDraft] = React.useState(normalized.toUpperCase());
  const pickerRef = React.useRef(null);
  React.useEffect(() => setDraft(normalizeColor(value).toUpperCase()), [value]);
  const commitHex = () => {
    const candidate = draft.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(candidate)) {
      const next = `#${candidate.toUpperCase()}`;
      setDraft(next);
      if (!hasSolidHexValue || next.toLowerCase() !== normalized.toLowerCase()) onChange(next);
    } else {
      setDraft(normalized.toUpperCase());
    }
  };
  return (
    <div className="svg-editor-color-picker-card">
      <span className="svg-editor-large-color-swatch" style={{ background: normalized }}>
        <input ref={pickerRef} className="svg-editor-native-color-picker" aria-label={label} type="color" value={normalized} onChange={(event) => { setDraft(event.target.value.toUpperCase()); onChange(event.target.value); }} disabled={disabled} />
      </span>
      <span className="svg-editor-color-value-copy">
        <strong>{label}</strong>
        <input className="svg-editor-color-hex-field" aria-label={`${label} HEX`} value={draft} maxLength={7} spellCheck={false} disabled={disabled} onChange={(event) => setDraft(event.target.value.toUpperCase())} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitHex(); event.currentTarget.blur(); } }} />
      </span>
      <button type="button" className="svg-editor-color-picker-edit" onClick={() => pickerRef.current?.click()} disabled={disabled} aria-label={t?.("svgEditor.chooseColor") || "Choose any color"}>
        <Pipette size={13} aria-hidden="true" />
        <span>{t?.("svgEditor.chooseColor") || "Choose any color"}</span>
      </button>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, disabled = false, danger = false }) {
  return <button type="button" className={`svg-editor-action ${danger ? "is-danger" : ""}`} onClick={onClick} disabled={disabled}><Icon size={14} /><span>{label}</span></button>;
}

function NudgeButton({ icon: Icon, label, onClick, disabled }) {
  return <button type="button" className="svg-editor-nudge-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={16} /></button>;
}

function BgToolbarButton({ icon: Icon, label, isActive, onClick, isDanger }) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div
      className="svg-editor-bg-tool-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <button
        type="button"
        className={`svg-editor-bg-tool-btn ${isActive ? "is-active" : ""} ${isDanger ? "is-danger" : ""}`}
        onClick={onClick}
        aria-label={label}
      >
        <Icon size={18} />
      </button>
      {showTooltip && (
        <div className="svg-editor-bg-tooltip" role="tooltip">
          {label}
        </div>
      )}
    </div>
  );
}

export default function SvgPropertiesPanel({
  selectedCount,
  details,
  bounds,
  onRename,
  onText,
  onSize,
  onRotate,
  onFlip,
  onAttribute,
  onNudge,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onAddText,
  activeMobileTab,
  onSetSolidBackground,
  onSetGradientBackground,
  onSetImageBackground,
  onRotateBackground,
  onRemoveBackground,
  backgroundInfo,
  backgroundSubTab = "solid",
  onSelectBackgroundSubTab,
  locked,
  error,
  t,
  collapsed = false,
  onToggleCollapsed,
}) {
  const [nudgeStep, setNudgeStep] = React.useState(1);
  const [activeColorTarget, setActiveColorTarget] = React.useState("fill");
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

  const attrs = details?.attributes || {};
  const tag = details?.tag || "";
  const supportsPosition = !!details && !details.definition && tag !== "style";
  const supportsSize = supportsPosition && !["line", "textPath", "tspan", "a"].includes(tag);
  const isTextElement = ["text", "tspan"].includes(tag);
  const width = bounds?.width ?? attrs.width ?? (tag === "circle" ? numericValue(attrs.r) * 2 : tag === "ellipse" ? numericValue(attrs.rx) * 2 : 0);
  const height = bounds?.height ?? attrs.height ?? (tag === "circle" ? numericValue(attrs.r) * 2 : tag === "ellipse" ? numericValue(attrs.ry) * 2 : 0);
  const rotation = normalizeAngle(attrs["data-editor-rotation"] ?? parseRotation(attrs.transform));
  const opacity = Math.max(0, Math.min(100, numericValue(attrs.opacity, 1) * 100));
  const strokeWidth = Math.max(0, numericValue(attrs["stroke-width"], 1));
  const fontSize = Math.max(1, numericValue(attrs["font-size"], 16));
  const letterSpacing = numericValue(attrs["letter-spacing"], 0);
  const bold = ["bold", "bolder"].includes(String(attrs["font-weight"] || "").toLowerCase()) || numericValue(attrs["font-weight"], 400) >= 600;
  const fontWeight = Math.max(100, Math.min(900, numericValue(attrs["font-weight"], bold ? 700 : 400)));
  const italic = String(attrs["font-style"] || "normal").toLowerCase() === "italic";
  const fontFamily = attrs["font-family"] || FONT_PRESETS[0][0];
  const colorValue = attrs[activeColorTarget] || (activeColorTarget === "fill" ? "#000000" : "none");

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
            <div className="svg-editor-property-section" data-section="background">
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
                  icon={Trash2}
                  label={t("svgEditor.clearBackground") || "Clear"}
                  isActive={backgroundSubTab === "clear" || (!backgroundInfo && backgroundSubTab !== "solid" && backgroundSubTab !== "gradient" && backgroundSubTab !== "image")}
                  isDanger={true}
                  onClick={() => {
                    onRemoveBackground?.();
                    onSelectBackgroundSubTab?.("clear");
                  }}
                />
              </div>
              {backgroundSubTab === "solid" && (
                <div>
                  <h3><Palette size={14} /> {t("svgEditor.solidColor") || "Solid Color"}</h3>
                  <ColorPickerCard label={t("svgEditor.solidColor") || "Solid Color"} value={backgroundInfo?.color || "#ffffff"} onChange={(color) => onSetSolidBackground?.(color)} t={t} />
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
              )}

              {backgroundSubTab === "gradient" && (
                <div>
                  <h3><Sparkles size={14} /> {t("svgEditor.gradientColor") || "Gradient Color"}</h3>
                  <div className="svg-editor-swatches-label">{t("svgEditor.gradientHelp") || "Preset Gradients"}</div>
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

                  <div className="svg-editor-custom-gradient-box">
                    <strong>{t("svgEditor.customGradient") || "Custom Gradient"}</strong>
                    <div
                      className="svg-editor-gradient-preview"
                      style={{ background: `linear-gradient(${customAngle}deg, ${customColor1}, ${customColor2})` }}
                    />
                    <div className="svg-editor-gradient-color-pickers">
                      <ColorPickerCard label={t("svgEditor.color1") || "Color 1"} value={customColor1} onChange={(color) => { setCustomColor1(color); onSetGradientBackground?.(color, customColor2, customAngle); }} t={t} />
                      <ColorPickerCard label={t("svgEditor.color2") || "Color 2"} value={customColor2} onChange={(color) => { setCustomColor2(color); onSetGradientBackground?.(customColor1, color, customAngle); }} t={t} />
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <span className="text-xs font-semibold">{t("svgEditor.angle") || "Direction"}:</span>
                      <div className="svg-editor-quick-pills" style={{ marginTop: 6 }}>
                        {[
                          { label: "0° (H)", angle: 0 },
                          { label: "90° (V)", angle: 90 },
                          { label: "45°", angle: 45 },
                          { label: "135°", angle: 135 },
                        ].map(({ label, angle }) => (
                          <button
                            key={angle}
                            type="button"
                            className={`svg-editor-preset-pill ${customAngle === angle ? "is-active" : ""}`}
                            onClick={() => {
                              setCustomAngle(angle);
                              onSetGradientBackground?.(customColor1, customColor2, angle);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {backgroundSubTab === "image" && (
                <div>
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
                  <button
                    type="button"
                    className="svg-editor-primary-btn svg-editor-add-text-action"
                    onClick={() => bgImageInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    <span>{t("svgEditor.uploadBackgroundImage") || "Upload background photo"}</span>
                  </button>

                  {backgroundInfo?.type === "image" && (
                    <div style={{ marginTop: 14 }}>
                      <RangeControl
                        label={t("svgEditor.opacityPercent") || "Opacity"}
                        value={customBgOpacity}
                        min={0}
                        max={100}
                        step={1}
                        suffix="%"
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

              {/* Background Rotation Section: enabled for non-solid backgrounds, disabled/appearance-only for solid color */}
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
                  />
                </div>
                {!isRotationEnabled && (
                  <p className="svg-editor-rotation-disabled-hint">
                    {t("svgEditor.rotationDisabledForSolid") || "Rotation is only available for gradients and images."}
                  </p>
                )}
              </div>
            </div>
            {error && <p className="svg-editor-inline-error" role="alert">{error}</p>}
          </div>
        ) : activeMobileTab === "text" ? (
          <div className="svg-editor-properties-scroll">
            <div className="svg-editor-property-section" data-section="text">
              <h3><Type size={14} /> {t("svgEditor.text") || "Text"}</h3>
              <button
                type="button"
                className="svg-editor-primary-btn svg-editor-add-text-action"
                onClick={onAddText}
              >
                <Type size={16} />
                <span>{t("svgEditor.addTextToLogo") || "Add text to logo"}</span>
              </button>

              {details?.textEditable || isTextElement ? (
                <>
                  <label className="svg-editor-field svg-editor-text-field" style={{ marginTop: 12 }}>
                    <span>{t("svgEditor.textContent")}</span>
                    <textarea
                      key={`${details.id}-${details.textContent}`}
                      defaultValue={details.textContent}
                      rows={3}
                      maxLength={1000}
                      disabled={locked}
                      onBlur={(event) => { if (event.target.value !== details.textContent) onText(event.target.value); }}
                    />
                  </label>
                  <label className="svg-editor-field svg-editor-font-family-field" style={{ marginTop: 8 }}>
                    <span>{t("svgEditor.fontFamily")}</span>
                    <select value={fontFamily} disabled={locked} onChange={(event) => onAttribute("font-family", event.target.value)}>
                      {!FONT_PRESETS.some(([font]) => font === fontFamily) && <option value={fontFamily}>{fontFamily}</option>}
                      {FONT_PRESETS.map(([font, label]) => <option key={font} value={font}>{label}</option>)}
                    </select>
                  </label>
                  <RangeControl label={t("svgEditor.fontSize")} value={fontSize} min={1} max={Math.max(200, Math.min(2000, Math.ceil(fontSize * 2)))} step={1} suffix=" px" onCommit={(value) => onAttribute("font-size", value)} disabled={locked} icon={Type} />
                  <RangeControl label={t("svgEditor.fontWeight")} value={fontWeight} min={100} max={900} step={100} onCommit={(value) => onAttribute("font-weight", String(value))} disabled={locked} />
                  <RangeControl label={t("svgEditor.letterSpacing")} value={letterSpacing} min={-40} max={Math.max(40, Math.min(400, Math.ceil(Math.abs(letterSpacing) * 2)))} step={0.5} suffix=" px" onCommit={(value) => onAttribute("letter-spacing", value)} disabled={locked} />
                  <div className="svg-editor-text-style-actions">
                    <button type="button" className={`svg-editor-style-toggle ${bold ? "is-active" : ""}`} onClick={() => onAttribute("font-weight", bold ? "400" : "700")} disabled={locked} aria-pressed={bold} title={t("svgEditor.bold")}><Bold size={15} /><span>{t("svgEditor.bold")}</span></button>
                    <button type="button" className={`svg-editor-style-toggle ${italic ? "is-active" : ""}`} onClick={() => onAttribute("font-style", italic ? "normal" : "italic")} disabled={locked} aria-pressed={italic} title={t("svgEditor.italic")}><Italic size={15} /><span>{t("svgEditor.italic")}</span></button>
                    <label className="svg-editor-field svg-editor-text-align-field"><span>{t("svgEditor.textAlign")}</span><select value={attrs["text-anchor"] || "start"} disabled={locked} onChange={(event) => onAttribute("text-anchor", event.target.value)}><option value="start">{t("svgEditor.alignStart")}</option><option value="middle">{t("svgEditor.alignCenter")}</option><option value="end">{t("svgEditor.alignEnd")}</option></select></label>
                  </div>
                </>
              ) : (
                <p className="svg-editor-help" style={{ marginTop: 10 }}>
                  {t("svgEditor.addTextHelp")}
                </p>
              )}
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
            <div className="svg-editor-selected-heading">
              <span className="svg-editor-selected-object-icon">{isTextElement ? <Type size={17} /> : <MoveHorizontal size={17} />}</span>
              <div><strong>{details.label}</strong><small>{t("svgEditor.editingSelected")}</small></div>
            </div>
            <label className="svg-editor-field">
              <span>{t("svgEditor.editorLabel")}</span>
              <input key={details.id} defaultValue={details.label} disabled={locked} onBlur={(event) => { if (event.target.value !== details.label) onRename(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} maxLength={80} />
            </label>

            {/* 1. CONTROLS: delete, duplicate, flip and 4 icons of moving */}
            <div className="svg-editor-property-section" data-section="controls">
              <h3><SlidersHorizontal size={13} />{t("svgEditor.controls") || "Controls"}</h3>
              <div className="svg-editor-action-grid">
                <QuickAction icon={Copy} label={t("svgEditor.duplicate")} onClick={onDuplicate} disabled={locked} />
                {tag === "g" ? <QuickAction icon={Ungroup} label={t("svgEditor.ungroup")} onClick={onUngroup} disabled={locked} /> : <QuickAction icon={Group} label={t("svgEditor.groupSelection")} onClick={onGroup} disabled={locked || selectedCount < 2} />}
                <QuickAction icon={FlipHorizontal} label={t("svgEditor.flipHorizontal")} onClick={() => onFlip("x", bounds)} disabled={locked} />
                <QuickAction icon={FlipVertical} label={t("svgEditor.flipVertical")} onClick={() => onFlip("y", bounds)} disabled={locked} />
                <QuickAction icon={Trash2} label={t("svgEditor.delete")} onClick={onDelete} disabled={locked} danger />
              </div>
              {supportsPosition && (
                <div className="svg-editor-nudge-wrap">
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
            </div>

            {/* 2. SIZE: scale, width, height */}
            {supportsPosition && supportsSize && (
              <div className="svg-editor-property-section" data-section="size">
                <h3><Maximize2 size={13} />{t("svgEditor.size") || "Size"}</h3>
                <div className="svg-editor-dimensions-card">
                  <RangeControl
                    key={`uniform-scale-${details.id}-${Math.round(width * 100) / 100}-${Math.round(height * 100) / 100}`}
                    label={t("svgEditor.scale")}
                    value={100}
                    min={10}
                    max={300}
                    step={1}
                    suffix="%"
                    onCommit={(value) => onSize("scale", value / 100, bounds)}
                    disabled={locked}
                  />
                  <div className="svg-editor-fields-2 svg-editor-size-number-fields">
                    <NumberField label={t("svgEditor.width")} value={width} min={0} onCommit={(value) => onSize("width", value, bounds)} disabled={locked} />
                    <NumberField label={t("svgEditor.height")} value={height} min={0} onCommit={(value) => onSize("height", value, bounds)} disabled={locked} />
                  </div>
                  <div className="svg-editor-size-sliders">
                    <RangeControl label={t("svgEditor.width")} value={width} min={0} max={Math.max(200, Math.min(10000, Math.ceil(Math.max(1, width) * 2)))} step={1} onCommit={(value) => onSize("width", value, bounds)} disabled={locked} />
                    <RangeControl label={t("svgEditor.height")} value={height} min={0} max={Math.max(200, Math.min(10000, Math.ceil(Math.max(1, height) * 2)))} step={1} onCommit={(value) => onSize("height", value, bounds)} disabled={locked} />
                  </div>
                </div>
              </div>
            )}

            {/* 3. COLORS: appearance, fill, stroke target, palette */}
            <div className="svg-editor-property-section" data-section="colors">
              <h3><Palette size={13} />{t("svgEditor.colors") || t("svgEditor.appearance")}</h3>
              <div className="svg-editor-color-targets" role="group" aria-label={t("svgEditor.colorTarget")}>
                <button type="button" className={activeColorTarget === "fill" ? "is-active" : ""} onClick={() => setActiveColorTarget("fill")}><span className="svg-editor-color-target-dot is-fill" />{t("svgEditor.fill")}</button>
                <button type="button" className={activeColorTarget === "stroke" ? "is-active" : ""} onClick={() => setActiveColorTarget("stroke")}><span className="svg-editor-color-target-dot is-stroke" />{t("svgEditor.stroke")}</button>
              </div>
              <ColorPickerCard label={t(activeColorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke")} value={colorValue} onChange={(color) => onAttribute(activeColorTarget, color)} disabled={locked} t={t} />
              <div className="svg-editor-swatches-label">{t("svgEditor.colorSwatches")}</div>
              <div className="svg-editor-color-swatches">
                {COLOR_PRESETS.map((color) => <button key={color} type="button" className={`svg-editor-color-swatch ${normalizeColor(colorValue).toLowerCase() === color.toLowerCase() ? "is-selected" : ""}`} style={{ "--swatch-color": color }} aria-label={`${t(activeColorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke")} ${color}`} title={color} onClick={() => onAttribute(activeColorTarget, color)} disabled={locked}><span /></button>)}
              </div>
              <p className="svg-editor-help">{t("svgEditor.gradientHelp")}</p>
            </div>

            {/* 4. OPACITY */}
            <div className="svg-editor-property-section" data-section="opacity">
              <h3><Blend size={13} />{t("svgEditor.opacity") || t("svgEditor.opacityPercent")}</h3>
              <RangeControl label={t("svgEditor.opacityPercent")} value={opacity} min={0} max={100} step={1} suffix="%" onCommit={(value) => onAttribute("opacity", Math.max(0, Math.min(100, value)) / 100)} disabled={locked} />
              <div className="svg-editor-quick-pills">
                {[25, 50, 75, 100].map((pct) => (
                  <button key={pct} type="button" className={`svg-editor-preset-pill ${Math.round(opacity) === pct ? "is-active" : ""}`} onClick={() => onAttribute("opacity", pct / 100)} disabled={locked}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* 5. ROTATION */}
            {supportsPosition && (
              <div className="svg-editor-property-section" data-section="rotation">
                <h3><RotateCw size={13} />{t("svgEditor.rotation")}</h3>
                <RotationWheel value={rotation} onCommit={(value) => onRotate(value, bounds)} disabled={locked} label={t("svgEditor.rotation")} hint={t("svgEditor.rotationWheelHint")} />
                <NumberField label={t("svgEditor.rotation")} value={rotation} min={-180} max={180} step={1} suffix="°" onCommit={(value) => onRotate(value, bounds)} disabled={locked} />
                <div className="svg-editor-inline-actions" style={{ marginTop: 8 }}>
                  <QuickAction icon={RotateCcw} label={t("svgEditor.resetRotation")} onClick={() => onRotate(0, bounds)} disabled={locked || Number(rotation) === 0} />
                  <QuickAction icon={RotateCw} label="+90°" onClick={() => onRotate(((Number(rotation) || 0) + 90 + 180) % 360 - 180, bounds)} disabled={locked} />
                  <QuickAction icon={RotateCcw} label="-90°" onClick={() => onRotate(((Number(rotation) || 0) - 90 + 180) % 360 - 180, bounds)} disabled={locked} />
                </div>
              </div>
            )}

            {/* 6. STROKE */}
            <div className="svg-editor-property-section" data-section="stroke">
              <h3><Paintbrush size={13} />{t("svgEditor.stroke")}</h3>
              <RangeControl label={t("svgEditor.strokeWidth")} value={strokeWidth} min={0} max={Math.max(20, Math.min(1000, Math.ceil(strokeWidth * 2)))} step={0.5} suffix=" px" onCommit={(value) => onAttribute("stroke-width", value)} disabled={locked} />
              <div className="svg-editor-stroke-color-wrap" style={{ marginTop: 10 }}>
                <ColorPickerCard label={t("svgEditor.stroke")} value={attrs.stroke || "#000000"} onChange={(color) => onAttribute("stroke", color)} disabled={locked} t={t} />
                <div className="svg-editor-swatches-label">{t("svgEditor.colorSwatches")}</div>
                <div className="svg-editor-color-swatches">
                  {COLOR_PRESETS.map((color) => <button key={color} type="button" className={`svg-editor-color-swatch ${normalizeColor(attrs.stroke || "").toLowerCase() === color.toLowerCase() ? "is-selected" : ""}`} style={{ "--swatch-color": color }} aria-label={`${t("svgEditor.stroke")} ${color}`} title={color} onClick={() => onAttribute("stroke", color)} disabled={locked}><span /></button>)}
                </div>
              </div>
            </div>

            {/* TEXT SECTIONS */}
            {details.textEditable && <div className="svg-editor-property-section" data-section="text">
              <h3>{t("svgEditor.textContent")}</h3>
              <label className="svg-editor-field svg-editor-text-field">
                <span>{t("svgEditor.textContent")}</span>
                <textarea key={`${details.id}-${details.textContent}`} defaultValue={details.textContent} rows={3} maxLength={1000} disabled={locked} onBlur={(event) => { if (event.target.value !== details.textContent) onText(event.target.value); }} />
              </label>
            </div>}

            {isTextElement && <div className="svg-editor-property-section" data-section="typography">
              <h3><Type size={13} />{t("svgEditor.typography")}</h3>
              <label className="svg-editor-field svg-editor-font-family-field">
                <span>{t("svgEditor.fontFamily")}</span>
                <select value={fontFamily} disabled={locked} onChange={(event) => onAttribute("font-family", event.target.value)}>
                  {!FONT_PRESETS.some(([font]) => font === fontFamily) && <option value={fontFamily}>{fontFamily}</option>}
                  {FONT_PRESETS.map(([font, label]) => <option key={font} value={font}>{label}</option>)}
                </select>
              </label>
              <RangeControl label={t("svgEditor.fontSize")} value={fontSize} min={1} max={Math.max(200, Math.min(2000, Math.ceil(fontSize * 2)))} step={1} suffix=" px" onCommit={(value) => onAttribute("font-size", value)} disabled={locked} icon={Type} />
              <RangeControl label={t("svgEditor.fontWeight")} value={fontWeight} min={100} max={900} step={100} onCommit={(value) => onAttribute("font-weight", String(value))} disabled={locked} />
              <RangeControl label={t("svgEditor.letterSpacing")} value={letterSpacing} min={-40} max={Math.max(40, Math.min(400, Math.ceil(Math.abs(letterSpacing) * 2)))} step={0.5} suffix=" px" onCommit={(value) => onAttribute("letter-spacing", value)} disabled={locked} />
              <div className="svg-editor-text-style-actions">
                <button type="button" className={`svg-editor-style-toggle ${bold ? "is-active" : ""}`} onClick={() => onAttribute("font-weight", bold ? "400" : "700")} disabled={locked} aria-pressed={bold} title={t("svgEditor.bold")}><Bold size={15} /><span>{t("svgEditor.bold")}</span></button>
                <button type="button" className={`svg-editor-style-toggle ${italic ? "is-active" : ""}`} onClick={() => onAttribute("font-style", italic ? "normal" : "italic")} disabled={locked} aria-pressed={italic} title={t("svgEditor.italic")}><Italic size={15} /><span>{t("svgEditor.italic")}</span></button>
                <label className="svg-editor-field svg-editor-text-align-field"><span>{t("svgEditor.textAlign")}</span><select value={attrs["text-anchor"] || "start"} disabled={locked} onChange={(event) => onAttribute("text-anchor", event.target.value)}><option value="start">{t("svgEditor.alignStart")}</option><option value="middle">{t("svgEditor.alignCenter")}</option><option value="end">{t("svgEditor.alignEnd")}</option></select></label>
              </div>
            </div>}
            {error && <p className="svg-editor-inline-error" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function parseRotation(transform = "") {
  const match = String(transform).match(/rotate\(\s*(-?[\d.]+)/i);
  return match ? Number(match[1]) : 0;
}

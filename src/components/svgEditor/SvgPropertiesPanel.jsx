import React from "react";
import {
  SlidersHorizontal, FlipHorizontal, FlipVertical, Copy, Trash2,
  Group, Ungroup, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, Bold, Italic,
  ChevronLeft, ChevronRight, MoveHorizontal, RotateCcw, Palette, Type,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

const COLOR_PRESETS = [
  "#111827", "#334155", "#64748b", "#ffffff", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
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

function QuickAction({ icon: Icon, label, onClick, disabled = false, danger = false }) {
  return <button type="button" className={`svg-editor-action ${danger ? "is-danger" : ""}`} onClick={onClick} disabled={disabled}><Icon size={14} /><span>{label}</span></button>;
}

function NudgeButton({ icon: Icon, label, onClick, disabled }) {
  return <button type="button" className="svg-editor-nudge-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={16} /></button>;
}

export default function SvgPropertiesPanel({
  selectedCount,
  details,
  bounds,
  onRename,
  onText,
  onPosition,
  onSize,
  onRotate,
  onFlip,
  onAttribute,
  onNudge,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  locked,
  error,
  t,
  collapsed = false,
  onToggleCollapsed,
}) {
  const [nudgeStep, setNudgeStep] = React.useState(1);
  const [activeColorTarget, setActiveColorTarget] = React.useState("fill");
  const attrs = details?.attributes || {};
  const tag = details?.tag || "";
  const supportsPosition = !!details && !details.definition && tag !== "style";
  const supportsSize = supportsPosition && !["line", "textPath", "tspan", "a"].includes(tag);
  const isTextElement = ["text", "tspan"].includes(tag);
  const positionX = bounds?.x ?? attrs.x ?? attrs.cx ?? attrs.x1 ?? 0;
  const positionY = bounds?.y ?? attrs.y ?? attrs.cy ?? attrs.y1 ?? 0;
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
      <div className="svg-editor-panel-content">
        {!details || selectedCount !== 1 ? (
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

            {supportsPosition && <div className="svg-editor-property-section">
              <h3>{t("svgEditor.positionSize")}</h3>
              {supportsSize && <div className="svg-editor-dimensions-card">
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
              </div>}
              <div className="svg-editor-nudge-wrap">
                <div className="svg-editor-nudge-heading">
                  <strong>{t("svgEditor.preciseMove")}</strong>
                  <label className="svg-editor-nudge-step"><span>{t("svgEditor.moveStep")}</span><input type="number" min="0.1" step="0.1" value={nudgeStep} disabled={locked} onChange={(event) => setNudgeStep(Math.max(0.1, Math.min(1000, Number(event.target.value) || 1)))} /></label>
                </div>
                <div className="svg-editor-nudge-grid">
                  <span />
                  <NudgeButton icon={ArrowUp} label={t("svgEditor.moveUp")} onClick={() => onNudge(0, -nudgeStep)} disabled={locked} />
                  <span />
                  <NudgeButton icon={ArrowLeft} label={t("svgEditor.moveLeft")} onClick={() => onNudge(-nudgeStep, 0)} disabled={locked} />
                  <NudgeButton icon={ArrowDown} label={t("svgEditor.moveDown")} onClick={() => onNudge(0, nudgeStep)} disabled={locked} />
                  <NudgeButton icon={ArrowRight} label={t("svgEditor.moveRight")} onClick={() => onNudge(nudgeStep, 0)} disabled={locked} />
                </div>
                <div className="svg-editor-fields-2 svg-editor-position-number-fields">
                  <NumberField label={t("svgEditor.x")} value={positionX} onCommit={(value) => onPosition("x", value, bounds)} disabled={locked} />
                  <NumberField label={t("svgEditor.y")} value={positionY} onCommit={(value) => onPosition("y", value, bounds)} disabled={locked} />
                </div>
              </div>
              <div className="svg-editor-inline-actions">
                <QuickAction icon={FlipHorizontal} label={t("svgEditor.flipHorizontal")} onClick={() => onFlip("x", bounds)} disabled={locked} />
                <QuickAction icon={FlipVertical} label={t("svgEditor.flipVertical")} onClick={() => onFlip("y", bounds)} disabled={locked} />
              </div>
              <RotationWheel value={rotation} onCommit={(value) => onRotate(value, bounds)} disabled={locked} label={t("svgEditor.rotation")} hint={t("svgEditor.rotationWheelHint")} />
              <NumberField label={t("svgEditor.rotation")} value={rotation} min={-180} max={180} step={1} suffix="°" onCommit={(value) => onRotate(value, bounds)} disabled={locked} />
            </div>}

            {details.textEditable && <div className="svg-editor-property-section">
              <h3>{t("svgEditor.textContent")}</h3>
              <label className="svg-editor-field svg-editor-text-field">
                <span>{t("svgEditor.textContent")}</span>
                <textarea key={`${details.id}-${details.textContent}`} defaultValue={details.textContent} rows={3} maxLength={1000} disabled={locked} onBlur={(event) => { if (event.target.value !== details.textContent) onText(event.target.value); }} />
              </label>
            </div>}

            {isTextElement && <div className="svg-editor-property-section">
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

            <div className="svg-editor-property-section">
              <h3><Palette size={13} />{t("svgEditor.appearance")}</h3>
              <div className="svg-editor-color-targets" role="group" aria-label={t("svgEditor.colorTarget")}>
                <button type="button" className={activeColorTarget === "fill" ? "is-active" : ""} onClick={() => setActiveColorTarget("fill")}><span className="svg-editor-color-target-dot is-fill" />{t("svgEditor.fill")}</button>
                <button type="button" className={activeColorTarget === "stroke" ? "is-active" : ""} onClick={() => setActiveColorTarget("stroke")}><span className="svg-editor-color-target-dot is-stroke" />{t("svgEditor.stroke")}</button>
              </div>
              <label className="svg-editor-color-picker-card">
                <span className="svg-editor-large-color-swatch" style={{ background: normalizeColor(colorValue) }}><input aria-label={t(activeColorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke")} type="color" value={normalizeColor(colorValue)} onChange={(event) => onAttribute(activeColorTarget, event.target.value)} disabled={locked} /></span>
                <span className="svg-editor-color-value-copy"><strong>{t(activeColorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke")}</strong><code>{colorValue}</code></span>
                <span className="svg-editor-color-picker-edit">{t("svgEditor.chooseColor")}</span>
              </label>
              <div className="svg-editor-swatches-label">{t("svgEditor.colorSwatches")}</div>
              <div className="svg-editor-color-swatches">
                {COLOR_PRESETS.map((color) => <button key={color} type="button" className={`svg-editor-color-swatch ${normalizeColor(colorValue).toLowerCase() === color.toLowerCase() ? "is-selected" : ""}`} style={{ "--swatch-color": color }} aria-label={`${t(activeColorTarget === "fill" ? "svgEditor.fill" : "svgEditor.stroke")} ${color}`} title={color} onClick={() => onAttribute(activeColorTarget, color)} disabled={locked}><span /></button>)}
              </div>
              <RangeControl label={t("svgEditor.opacityPercent")} value={opacity} min={0} max={100} step={1} suffix="%" onCommit={(value) => onAttribute("opacity", Math.max(0, Math.min(100, value)) / 100)} disabled={locked} />
              <RangeControl label={t("svgEditor.strokeWidth")} value={strokeWidth} min={0} max={Math.max(20, Math.min(1000, Math.ceil(strokeWidth * 2)))} step={0.5} suffix=" px" onCommit={(value) => onAttribute("stroke-width", value)} disabled={locked} />
              <p className="svg-editor-help">{t("svgEditor.gradientHelp")}</p>
            </div>

            <div className="svg-editor-property-section">
              <h3>{t("svgEditor.arrange")}</h3>
              <div className="svg-editor-action-grid">
                <QuickAction icon={Copy} label={t("svgEditor.duplicate")} onClick={onDuplicate} disabled={locked} />
                {tag === "g" ? <QuickAction icon={Ungroup} label={t("svgEditor.ungroup")} onClick={onUngroup} disabled={locked} /> : <QuickAction icon={Group} label={t("svgEditor.groupSelection")} onClick={onGroup} disabled={locked || selectedCount < 2} />}
                <QuickAction icon={Trash2} label={t("svgEditor.delete")} onClick={onDelete} disabled={locked} danger />
                <QuickAction icon={RotateCcw} label={t("svgEditor.resetRotation")} onClick={() => onRotate(0, bounds)} disabled={locked || Number(rotation) === 0} />
              </div>
            </div>
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

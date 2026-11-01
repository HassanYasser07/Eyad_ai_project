import React from "react";
import { Pipette, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";

/* ─────────────────────────────────────────────────────────────
   Shared constants
   ───────────────────────────────────────────────────────────── */

export const COLOR_PRESETS = [
  "#111827", "#334155", "#64748b", "#ffffff", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
];

/* Fonts, grouped for the font picker. The first group holds the original presets (their values are
   unchanged, so existing artwork keeps its font). Everything else is a Google font that
   `ensureEditorFonts()` loads on demand; every value ends with a generic fallback family. */
export const FONT_GROUPS = [
  {
    id: "system",
    fonts: [
      ["Arial, Helvetica, sans-serif", "Arial"],
      ["Helvetica, Arial, sans-serif", "Helvetica"],
      ["Georgia, serif", "Georgia"],
      ["'Times New Roman', serif", "Times New Roman"],
      ["'Trebuchet MS', sans-serif", "Trebuchet MS"],
      ["Verdana, sans-serif", "Verdana"],
      ["Tahoma, sans-serif", "Tahoma"],
      ["'Courier New', monospace", "Courier New"],
      ["system-ui, sans-serif", "System UI"],
    ],
  },
  {
    id: "sans",
    fonts: [
      ["Inter, sans-serif", "Inter"],
      ["Roboto, sans-serif", "Roboto"],
      ["'Open Sans', sans-serif", "Open Sans"],
      ["Lato, sans-serif", "Lato"],
      ["Montserrat, sans-serif", "Montserrat"],
      ["Poppins, sans-serif", "Poppins"],
      ["Raleway, sans-serif", "Raleway"],
      ["Nunito, sans-serif", "Nunito"],
      ["'Work Sans', sans-serif", "Work Sans"],
      ["'DM Sans', sans-serif", "DM Sans"],
      ["Manrope, sans-serif", "Manrope"],
      ["'Plus Jakarta Sans', sans-serif", "Plus Jakarta Sans"],
      ["Outfit, sans-serif", "Outfit"],
      ["Urbanist, sans-serif", "Urbanist"],
      ["Sora, sans-serif", "Sora"],
      ["Rubik, sans-serif", "Rubik"],
      ["Barlow, sans-serif", "Barlow"],
      ["'Josefin Sans', sans-serif", "Josefin Sans"],
      ["Quicksand, sans-serif", "Quicksand"],
      ["'Space Grotesk', sans-serif", "Space Grotesk"],
    ],
  },
  {
    id: "serif",
    fonts: [
      ["'Playfair Display', serif", "Playfair Display"],
      ["Merriweather, serif", "Merriweather"],
      ["Lora, serif", "Lora"],
      ["'Cormorant Garamond', serif", "Cormorant Garamond"],
      ["'Libre Baskerville', serif", "Libre Baskerville"],
      ["Bitter, serif", "Bitter"],
      ["'DM Serif Display', serif", "DM Serif Display"],
      ["'Abril Fatface', serif", "Abril Fatface"],
    ],
  },
  {
    id: "display",
    fonts: [
      ["Oswald, sans-serif", "Oswald"],
      ["'Bebas Neue', sans-serif", "Bebas Neue"],
      ["Anton, sans-serif", "Anton"],
      ["Righteous, sans-serif", "Righteous"],
      ["Bungee, sans-serif", "Bungee"],
      ["Fredoka, sans-serif", "Fredoka"],
      ["'Permanent Marker', cursive", "Permanent Marker"],
    ],
  },
  {
    id: "script",
    fonts: [
      ["Pacifico, cursive", "Pacifico"],
      ["Lobster, cursive", "Lobster"],
      ["'Dancing Script', cursive", "Dancing Script"],
      ["'Great Vibes', cursive", "Great Vibes"],
      ["Satisfy, cursive", "Satisfy"],
    ],
  },
  {
    id: "mono",
    fonts: [
      ["'Space Mono', monospace", "Space Mono"],
      ["'JetBrains Mono', monospace", "JetBrains Mono"],
    ],
  },
  {
    id: "arabic",
    fonts: [
      ["Cairo, sans-serif", "Cairo"],
      ["Tajawal, sans-serif", "Tajawal"],
      ["Almarai, sans-serif", "Almarai"],
      ["Alexandria, sans-serif", "Alexandria"],
      ["'IBM Plex Sans Arabic', sans-serif", "IBM Plex Sans Arabic"],
      ["'Readex Pro', sans-serif", "Readex Pro"],
      ["Mada, sans-serif", "Mada"],
      ["'Baloo Bhaijaan 2', sans-serif", "Baloo Bhaijaan 2"],
      ["Changa, sans-serif", "Changa"],
      ["Marhey, sans-serif", "Marhey"],
      ["'Noto Kufi Arabic', sans-serif", "Noto Kufi Arabic"],
      ["'Reem Kufi', sans-serif", "Reem Kufi"],
      ["'El Messiri', sans-serif", "El Messiri"],
      ["Amiri, serif", "Amiri"],
      ["'Noto Naskh Arabic', serif", "Noto Naskh Arabic"],
      ["'Markazi Text', serif", "Markazi Text"],
      ["'Aref Ruqaa', serif", "Aref Ruqaa"],
      ["Lalezar, sans-serif", "Lalezar"],
    ],
  },
];

export const FONT_PRESETS = FONT_GROUPS.flatMap((group) => group.fonts);

/* Google families the editor needs on top of what index.css already loads (Alexandria, Almarai, Cairo,
   Changa, DM Sans, El Messiri, IBM Plex Sans Arabic, Inter, Lato, Manrope, Marhey, Merriweather,
   Montserrat, Noto Kufi Arabic, Plus Jakarta Sans, Poppins, Playfair Display, Raleway, Readex Pro,
   Reem Kufi, Roboto, Space Grotesk, Tajawal). Each family gets its own <link>, so one failing request
   can never stop the others from loading. `null` = single-weight family. */
const EXTRA_GOOGLE_FONTS = [
  ["Open Sans", "400;700"], ["Nunito", "400;700"], ["Work Sans", "400;700"], ["Outfit", "400;700"],
  ["Urbanist", "400;700"], ["Sora", "400;700"], ["Rubik", "400;700"], ["Barlow", "400;700"],
  ["Josefin Sans", "400;700"], ["Quicksand", "400;700"], ["Lora", "400;700"], ["Cormorant Garamond", "400;700"],
  ["Libre Baskerville", "400;700"], ["Bitter", "400;700"], ["DM Serif Display", null], ["Abril Fatface", null],
  ["Oswald", "400;700"], ["Bebas Neue", null], ["Anton", null], ["Righteous", null], ["Bungee", null],
  ["Fredoka", "400;700"], ["Permanent Marker", null], ["Pacifico", null], ["Lobster", null],
  ["Dancing Script", "400;700"], ["Great Vibes", null], ["Satisfy", null], ["Space Mono", "400;700"],
  ["JetBrains Mono", "400;700"], ["Mada", "400;700"], ["Baloo Bhaijaan 2", "400;700"], ["Amiri", "400;700"],
  ["Noto Naskh Arabic", "400;700"], ["Markazi Text", "400;700"], ["Aref Ruqaa", "400;700"], ["Lalezar", null],
];

let editorFontsRequested = false;
export function ensureEditorFonts() {
  if (editorFontsRequested || typeof document === "undefined") return;
  editorFontsRequested = true;
  EXTRA_GOOGLE_FONTS.forEach(([family, weights]) => {
    const name = family.replace(/ /g, "+");
    const href = `https://fonts.googleapis.com/css2?family=${name}${weights ? `:wght@${weights}` : ""}&display=swap`;
    if (document.querySelector(`link[data-svg-editor-font="${name}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-svg-editor-font", name);
    document.head.appendChild(link);
  });
}

/* <option> list for a font <select>: grouped, and the element's own font is kept if it is not a preset. */
export function FontOptions({ value, t }) {
  const known = FONT_PRESETS.some(([font]) => font === value);
  return (
    <>
      {!known && value ? <option value={value}>{value}</option> : null}
      {FONT_GROUPS.map((group) => (
        <optgroup key={group.id} label={t?.(`svgEditor.fontGroup.${group.id}`) || group.id}>
          {group.fonts.map(([font, label]) => <option key={font} value={font}>{label}</option>)}
        </optgroup>
      ))}
    </>
  );
}

export const FONT_WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/* ─────────────────────────────────────────────────────────────
   Pure helpers
   ───────────────────────────────────────────────────────────── */

export function numericValue(value, fallback = 0) {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAngle(value) {
  const angle = numericValue(value, 0);
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

export function parseRotation(transform = "") {
  const match = String(transform).match(/rotate\(\s*(-?[\d.]+)/i);
  return match ? Number(match[1]) : 0;
}

let colorProbe = null;
/** Resolves any CSS color (named, rgb(), hsl(), #rgb) to #rrggbb using the browser's own parser. */
function cssColorToHex(color) {
  if (typeof document === "undefined") return null;
  try {
    colorProbe = colorProbe || document.createElement("canvas").getContext("2d");
    if (!colorProbe) return null;
    colorProbe.fillStyle = "#000001";
    colorProbe.fillStyle = color;
    const first = colorProbe.fillStyle;
    colorProbe.fillStyle = "#000002";
    colorProbe.fillStyle = color;
    if (colorProbe.fillStyle !== first) return null; // the browser rejected the value
    if (/^#[0-9a-f]{6}$/i.test(first)) return first;
    const match = String(first).match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    return match ? `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : null;
  } catch {
    return null;
  }
}

export function normalizeColor(value) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((item) => item + item).join("")}`;
  if (color && !/^(none|transparent|url\()/i.test(color)) {
    const resolved = cssColorToHex(color);
    if (resolved) return resolved;
  }
  return "#000000";
}

/** A comparable identity for a paint value: "none", "url(#id)" or a lower-case #rrggbb. */
export function paintKey(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent") return "none";
  if (raw.startsWith("url(")) return raw.replace(/\s+/g, "");
  return normalizeColor(raw).toLowerCase();
}

/**
 * Derives every value the property controls need from the selected element.
 * Shared by the sidebar and the desktop context bar so both always agree.
 */
export function getElementMetrics(details, bounds) {
  const attrs = details?.attributes || {};
  const tag = details?.tag || "";
  const supportsPosition = !!details && !details.definition && tag !== "style";
  const supportsSize = supportsPosition && !["line", "textPath", "tspan", "a"].includes(tag);
  const isTextElement = ["text", "tspan"].includes(tag);
  // Width / height are always whole numbers: measured bounds are long floats (e.g. 183.48217…).
  const width = Math.round(numericValue(bounds?.width ?? attrs.width ?? (tag === "circle" ? numericValue(attrs.r) * 2 : tag === "ellipse" ? numericValue(attrs.rx) * 2 : 0), 0));
  const height = Math.round(numericValue(bounds?.height ?? attrs.height ?? (tag === "circle" ? numericValue(attrs.r) * 2 : tag === "ellipse" ? numericValue(attrs.ry) * 2 : 0), 0));
  const rotation = normalizeAngle(attrs["data-editor-rotation"] ?? parseRotation(attrs.transform));
  const opacity = Math.max(0, Math.min(100, numericValue(attrs.opacity, 1) * 100));
  const strokeWidth = Math.max(0, numericValue(attrs["stroke-width"], 1));
  const fontSize = Math.max(1, numericValue(attrs["font-size"], 16));
  const letterSpacing = numericValue(attrs["letter-spacing"], 0);
  const bold = ["bold", "bolder"].includes(String(attrs["font-weight"] || "").toLowerCase()) || numericValue(attrs["font-weight"], 400) >= 600;
  const fontWeight = Math.max(100, Math.min(900, numericValue(attrs["font-weight"], bold ? 700 : 400)));
  const italic = String(attrs["font-style"] || "normal").toLowerCase() === "italic";
  const fontFamily = attrs["font-family"] || FONT_PRESETS[0][0];
  const textAnchor = attrs["text-anchor"] || "start";
  return {
    attrs, tag, supportsPosition, supportsSize, isTextElement, width, height, rotation,
    opacity, strokeWidth, fontSize, letterSpacing, bold, fontWeight, italic, fontFamily, textAnchor,
  };
}

/* ─────────────────────────────────────────────────────────────
   NumberField
   ───────────────────────────────────────────────────────────── */

export function NumberField({ label, value, onCommit, onLive, onLiveCancel, min, max, step = 1, disabled = false, suffix, inline = false, className = "" }) {
  const [draft, setDraft] = React.useState(String(value ?? 0));
  const liveDirty = React.useRef(false);
  React.useEffect(() => setDraft(String(value ?? 0)), [value]);
  const parse = (text) => {
    if (String(text).trim() === "") return null;
    const parsed = Number(text);
    const withinBounds = Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max);
    return withinBounds ? parsed : null;
  };
  const commit = () => {
    const parsed = parse(draft);
    const wasLive = liveDirty.current;
    liveDirty.current = false;
    if (draft.trim() === "") { if (wasLive) onLiveCancel?.(); setDraft(String(value ?? 0)); return; }
    if (parsed !== null && (wasLive || parsed !== Number(value))) onCommit(parsed);
    else {
      if (wasLive) onLiveCancel?.();
      setDraft(String(value ?? 0));
    }
  };
  const handleChange = (event) => {
    const text = event.target.value;
    setDraft(text);
    const parsed = parse(text);
    if (onLive && parsed !== null && parsed !== Number(value)) {
      liveDirty.current = true;
      onLive(parsed);
    }
  };

  return (
    <label className={`svg-editor-field ${inline ? "is-inline" : ""} ${className}`.trim()}>
      <span>{label}</span>
      <div className="svg-editor-number-input-wrap">
        <input
          type="number"
          value={draft}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
        {suffix && <span className="svg-editor-input-suffix">{suffix}</span>}
      </div>
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Text content textarea
   ───────────────────────────────────────────────────────────── */

export function TextContentField({ id, value, disabled, onLive, onCommit }) {
  const [draft, setDraft] = React.useState(value ?? "");
  const focused = React.useRef(false);
  const dirty = React.useRef(false);
  React.useEffect(() => { if (!focused.current) setDraft(value ?? ""); }, [value, id]);
  return (
    <textarea
      value={draft}
      rows={3}
      maxLength={1000}
      disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (onLive) { dirty.current = true; onLive(next); }
      }}
      onBlur={(event) => {
        focused.current = false;
        const next = event.target.value;
        const wasDirty = dirty.current;
        dirty.current = false;
        if (wasDirty || next !== value) onCommit(next);
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   RangeControl
   · default  : label + value on top, slider underneath (sidebar / sheets)
   · compact  : label · slider · value on one row (top bar)
   · editable : the value is a typed number field (so the value is shown ONCE,
                and can be typed exactly); `integer` rounds everything to whole numbers.
   ───────────────────────────────────────────────────────────── */

export function RangeControl({
  label, value, min, max, step = 1, suffix = "", onCommit, onLive, onLiveCancel,
  snapBack = false, disabled = false, icon: Icon, compact = false, editable = false, integer = false,
}) {
  const round = (n) => (integer ? Math.round(n) : n);
  const numeric = round(numericValue(value, min));
  const naturalMax = Math.max(min + step, max, numeric);
  const initial = Math.max(min, Math.min(naturalMax, numeric));
  const format = (n) => (Math.abs(n) < 0.0001 ? "0" : String(Number(n.toFixed(integer ? 0 : step < 1 ? 2 : 0))));
  const [draft, setDraft] = React.useState(initial);
  const [text, setText] = React.useState(format(initial));
  const interacting = React.useRef(false);
  const liveUsed = React.useRef(false);
  const typing = React.useRef(false);
  const frozenMax = React.useRef(null);
  // While the thumb is being dragged the scale must not move under the pointer,
  // even though the control's own value (and so its natural maximum) changes live.
  const safeMax = interacting.current && frozenMax.current !== null ? frozenMax.current : naturalMax;

  React.useEffect(() => {
    if (interacting.current || typing.current) return;
    const next = Math.max(min, Math.min(naturalMax, round(numericValue(value, min))));
    setDraft(next);
    setText(format(next));
  }, [value, min, naturalMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const slider = (
    <Slider
      variant="wave"
      aria-label={label}
      value={[Math.min(draft, safeMax)]}
      min={min}
      max={safeMax}
      step={step}
      disabled={disabled}
      onValueChange={(values) => {
        const next = round(values[0] ?? min);
        if (!interacting.current) frozenMax.current = naturalMax;
        interacting.current = true;
        setDraft(next);
        setText(format(next));
        if (onLive && next !== numeric) { liveUsed.current = true; onLive(next); }
      }}
      onValueCommit={(values) => {
        const next = round(values[0] ?? min);
        interacting.current = false;
        frozenMax.current = null;
        const settled = snapBack ? initial : next;
        setDraft(settled);
        setText(format(settled));
        const hadLive = liveUsed.current;
        liveUsed.current = false;
        if (hadLive || next !== numeric) onCommit(next);
      }}
      className="svg-editor-range-slider"
    />
  );

  const parseTyped = (raw) => {
    if (String(raw).trim() === "") return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min) return null;
    return round(parsed);
  };
  const finishTyping = () => {
    typing.current = false;
    const parsed = parseTyped(text);
    const hadLive = liveUsed.current;
    liveUsed.current = false;
    if (parsed === null) {
      if (hadLive) onLiveCancel?.();
      setText(format(numeric));
      setDraft(initial);
      return;
    }
    if (hadLive || parsed !== numeric) onCommit(parsed);
    setText(format(parsed));
  };
  const input = (
    <span className="svg-editor-range-input-wrap">
      <input
        type="number"
        className="svg-editor-range-input"
        aria-label={label}
        value={text}
        min={min}
        step={step}
        disabled={disabled}
        inputMode={integer ? "numeric" : "decimal"}
        onFocus={() => { typing.current = true; }}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const parsed = parseTyped(raw);
          if (parsed === null) return;
          setDraft(Math.max(min, Math.min(safeMax, parsed)));
          if (onLive && parsed !== numeric) { liveUsed.current = true; onLive(parsed); }
        }}
        onBlur={finishTyping}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
      />
      {suffix && <span className="svg-editor-input-suffix">{suffix.trim()}</span>}
    </span>
  );
  const shown = Math.abs(draft) < 0.0001 ? 0 : Number(draft.toFixed(integer ? 0 : step < 1 ? 2 : 0));
  const readout = editable ? input : <output className="svg-editor-range-output">{shown}{suffix}</output>;

  if (compact) {
    return (
      <div className={`svg-editor-range-control is-compact ${editable ? "is-editable" : ""} ${disabled ? "is-disabled" : ""}`}>
        <span className="svg-editor-range-label" title={compact ? label : undefined}>{Icon && <Icon size={13} />}<span className="svg-editor-range-label-text">{label}</span></span>
        {slider}
        {readout}
      </div>
    );
  }

  if (editable) {
    return (
      <div className={`svg-editor-range-control is-editable ${disabled ? "is-disabled" : ""}`}>
        <span className="svg-editor-range-label" title={compact ? label : undefined}>{Icon && <Icon size={13} />}<span className="svg-editor-range-label-text">{label}</span></span>
        <div className="svg-editor-range-row">
          {slider}
          {input}
        </div>
      </div>
    );
  }

  return (
    <div className={`svg-editor-range-control ${disabled ? "is-disabled" : ""}`}>
      <div className="svg-editor-range-heading">
        <span className="svg-editor-range-label" title={compact ? label : undefined}>{Icon && <Icon size={13} />}<span className="svg-editor-range-label-text">{label}</span></span>
        {readout}
      </div>
      {slider}
      <div className="svg-editor-range-scale"><span>{min}{suffix}</span><span>{safeMax}{suffix}</span></div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Half rotation wheel
   A professional "gauge" style dial: a dashed half-wheel that spans the
   whole -180° … +180° range (0° at the top, -180° at the far left, +180° at
   the far right). The needle follows the pointer around the pivot.
   ───────────────────────────────────────────────────────────── */

const HW_W = 200;
const HW_H = 124;
const HW_CX = 100;
const HW_CY = 100;
const HW_R = 84;
const HW_MAJOR_VALUES = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
const HW_LABEL_VALUES = [-180, -90, 0, 90, 180];

function hwPoint(angleValue, radius) {
  const dial = (angleValue / 2) * Math.PI / 180; // value → dial angle measured from the top
  return { x: HW_CX + Math.sin(dial) * radius, y: HW_CY - Math.cos(dial) * radius };
}

export function RotationHalfWheel({ value, onCommit, onLive, disabled, label, hint }) {
  const currentValue = normalizeAngle(value);
  const [draft, setDraft] = React.useState(currentValue);
  const dragging = React.useRef(false);
  const lastLive = React.useRef(null);
  React.useEffect(() => { if (!dragging.current) setDraft(currentValue); }, [currentValue]);

  const valueFromPointer = (event, fallback) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return fallback;
    const pivotX = rect.left + rect.width * (HW_CX / HW_W);
    const pivotY = rect.top + rect.height * (HW_CY / HW_H);
    const dx = event.clientX - pivotX;
    const dy = event.clientY - pivotY;
    if (dy > 0) {
      // Pointer dropped below the baseline: clamp to the nearest end of the dial.
      if (dx === 0) return fallback;
      return dx > 0 ? 180 : -180;
    }
    const dial = Math.atan2(dx, -dy) * 180 / Math.PI; // -90 … 90 from the top
    return Math.max(-180, Math.min(180, Math.round(dial * 2)));
  };
  const startDrag = (event) => {
    if (disabled) return;
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const first = valueFromPointer(event, draft);
    setDraft(first);
    lastLive.current = first;
    if (first !== currentValue) onLive?.(first);
  };
  const moveDrag = (event) => {
    if (!dragging.current) return;
    const next = valueFromPointer(event, draft);
    if (next === lastLive.current) return;
    lastLive.current = next;
    setDraft(next);
    onLive?.(next);
  };
  const endDrag = (event) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = valueFromPointer(event, draft);
    lastLive.current = null;
    setDraft(next);
    onCommit(next);
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

  const needleEnd = hwPoint(draft, HW_R - 20);
  const handle = hwPoint(draft, HW_R);
  const top = hwPoint(0, HW_R);
  const arcStart = hwPoint(-180, HW_R);
  const arcEnd = hwPoint(180, HW_R);
  const progressPath = Math.round(draft) === 0
    ? null
    : `M ${top.x} ${top.y} A ${HW_R} ${HW_R} 0 0 ${draft > 0 ? 1 : 0} ${handle.x} ${handle.y}`;

  return (
    <div className="svg-editor-hw">
      <div
        className={`svg-editor-hw-dial ${disabled ? "is-disabled" : ""}`}
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
        <svg viewBox={`0 0 ${HW_W} ${HW_H}`} aria-hidden="true">
          {/* Dashed half-wheel rim */}
          <path className="svg-editor-hw-rim" pathLength="96" d={`M ${arcStart.x} ${arcStart.y} A ${HW_R} ${HW_R} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} />
          {/* Inner hairline arc */}
          <path className="svg-editor-hw-inner" d={`M ${hwPoint(-180, HW_R - 14).x} ${hwPoint(-180, HW_R - 14).y} A ${HW_R - 14} ${HW_R - 14} 0 0 1 ${hwPoint(180, HW_R - 14).x} ${hwPoint(180, HW_R - 14).y}`} />
          {/* Major ticks */}
          {HW_MAJOR_VALUES.map((tick) => {
            const outer = hwPoint(tick, HW_R + 7);
            const inner = hwPoint(tick, HW_R - 14);
            const isZero = tick === 0;
            return <line key={tick} className={`svg-editor-hw-major ${isZero ? "is-zero" : ""}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
          })}
          {/* Labels */}
          {HW_LABEL_VALUES.map((tick) => {
            const pos = hwPoint(tick, HW_R - 27);
            return <text key={tick} className="svg-editor-hw-label" x={pos.x} y={pos.y + 3} textAnchor="middle">{tick}</text>;
          })}
          {/* Progress arc from 0° to the current value */}
          {progressPath && <path className="svg-editor-hw-progress" d={progressPath} />}
          {/* Needle, hub and handle */}
          <line className="svg-editor-hw-needle" x1={HW_CX} y1={HW_CY} x2={needleEnd.x} y2={needleEnd.y} />
          <circle className="svg-editor-hw-hub" cx={HW_CX} cy={HW_CY} r="5" />
          <circle className="svg-editor-hw-handle" cx={handle.x} cy={handle.y} r="7" />
          <text className="svg-editor-hw-value" x={HW_CX} y={HW_H - 4} textAnchor="middle">{Math.round(draft)}°</text>
        </svg>
      </div>
      {hint && <span className="svg-editor-hw-hint">{hint}</span>}
      <div className="svg-editor-angle-presets">
        {[-90, -45, 0, 45, 90].map((angle) => (
          <button type="button" key={angle} onClick={() => { setDraft(angle); onCommit(angle); }} disabled={disabled} className={normalizeAngle(value) === angle ? "is-active" : ""}>{angle}°</button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Color picker card (variant "chip" is the compact top-bar version)
   ───────────────────────────────────────────────────────────── */

export function ColorPickerCard({ label, value, onChange, onLive, disabled = false, t, variant = "card" }) {
  const normalized = normalizeColor(value);
  const rawValue = String(value || "").trim();
  const hasSolidHexValue = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(rawValue);
  const isNone = /^(none|transparent)$/i.test(rawValue);
  const shownValue = isNone ? "NONE" : normalized.toUpperCase();
  const [draft, setDraft] = React.useState(shownValue);
  const pickerRef = React.useRef(null);
  const liveDirty = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => setDraft(shownValue), [shownValue]);
  const finishLive = React.useCallback(() => {
    const pending = liveDirty.current;
    liveDirty.current = null;
    if (pending) onChangeRef.current(pending);
  }, []);
  React.useEffect(() => {
    const input = pickerRef.current;
    if (!input) return undefined;
    input.addEventListener("change", finishLive);
    return () => input.removeEventListener("change", finishLive);
  }, [finishLive]);
  const preview = (next) => {
    if (onLive) { liveDirty.current = next; onLive(next); } else onChange(next);
  };
  const commitHex = () => {
    if (isNone && draft.trim().toUpperCase() === "NONE" && !liveDirty.current) return;
    const candidate = draft.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(candidate)) {
      const next = `#${candidate.toUpperCase()}`;
      setDraft(next);
      if (liveDirty.current) { liveDirty.current = null; onChange(next); }
      else if (!hasSolidHexValue || next.toLowerCase() !== normalized.toLowerCase()) onChange(next);
    } else {
      if (liveDirty.current) { liveDirty.current = null; onChange(normalized.toUpperCase()); }
      setDraft(shownValue);
    }
  };
  return (
    <div className={`svg-editor-color-picker-card ${variant === "chip" ? "is-chip" : ""}`}>
      <span className={`svg-editor-large-color-swatch ${isNone ? "is-none" : ""}`} style={isNone ? undefined : { background: normalized }}>
        <input ref={pickerRef} className="svg-editor-native-color-picker" aria-label={label} title={label} type="color" value={normalized} onChange={(event) => { setDraft(event.target.value.toUpperCase()); preview(event.target.value); }} onBlur={finishLive} disabled={disabled} />
      </span>
      <span className="svg-editor-color-value-copy">
        <strong>{label}</strong>
        <input className="svg-editor-color-hex-field" aria-label={`${label} HEX`} value={draft} maxLength={7} spellCheck={false} disabled={disabled} onChange={(event) => { const text = event.target.value.toUpperCase(); setDraft(text); const candidate = text.trim().replace(/^#/, ""); if (onLive && /^[0-9A-F]{6}$/.test(candidate)) { const next = `#${candidate}`; liveDirty.current = next; onLive(next); } }} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitHex(); event.currentTarget.blur(); } }} />
      </span>
      <button type="button" className="svg-editor-color-picker-edit" onClick={() => pickerRef.current?.click()} disabled={disabled} aria-label={t?.("svgEditor.chooseColor") || "Choose any color"} title={t?.("svgEditor.chooseColor") || "Choose any color"}>
        <Pipette size={13} aria-hidden="true" />
        <span>{t?.("svgEditor.chooseColor") || "Choose any color"}</span>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Color swatches. The element's ORIGINAL color is always the first swatch
   (and is selected while it is still the active color), so a preset can be
   undone with a single click.
   `original` / `current` are { raw, value } paints (see getElementPaint).
   ───────────────────────────────────────────────────────────── */

export function ColorSwatches({ original, current, onPick, disabled = false, targetLabel = "", t, className = "" }) {
  const currentKey = paintKey(current?.value);
  const originalKey = original ? paintKey(original.value) : null;
  const originalSelected = originalKey !== null && originalKey === currentKey;
  const originalKind = originalKey === "none" ? "is-none" : originalKey?.startsWith("url(") ? "is-paint" : "";
  const originalTitle = `${t?.("svgEditor.originalColor") || "Original color"}${originalKind ? "" : ` ${originalKey?.toUpperCase()}`}`;
  return (
    <div className={`svg-editor-color-swatches ${className}`.trim()}>
      {original && (
        <button
          type="button"
          className={`svg-editor-color-swatch is-original ${originalKind} ${originalSelected ? "is-selected" : ""}`}
          style={{ "--swatch-color": originalKind ? undefined : originalKey }}
          aria-label={`${targetLabel} – ${originalTitle}`}
          aria-pressed={originalSelected}
          title={originalTitle}
          onClick={() => onPick(original.raw)}
          disabled={disabled}
        >
          <span><RotateCcw size={9} aria-hidden="true" /></span>
        </button>
      )}
      {COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          className={`svg-editor-color-swatch ${!originalSelected && currentKey === color.toLowerCase() ? "is-selected" : ""}`}
          style={{ "--swatch-color": color }}
          aria-label={`${targetLabel} ${color}`}
          title={color}
          onClick={() => onPick(color)}
          disabled={disabled}
        ><span /></button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Small buttons
   ───────────────────────────────────────────────────────────── */

export function QuickAction({ icon: Icon, label, onClick, disabled = false, danger = false }) {
  return <button type="button" className={`svg-editor-action ${danger ? "is-danger" : ""}`} onClick={onClick} disabled={disabled}><Icon size={14} /><span>{label}</span></button>;
}

export function NudgeButton({ icon: Icon, label, onClick, disabled }) {
  return <button type="button" className="svg-editor-nudge-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={16} /></button>;
}

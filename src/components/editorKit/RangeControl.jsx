import React from "react";
import { Slider } from "@/components/ui/slider";
import { numericValue } from "./utils.js";

/**
 * Wave-slider row (ported 1:1 from the SVG editor).
 * Layouts: default (label + readout on top) | compact (one row) | editable (slider + typed number).
 * Omit `onLive` for commit-on-release behaviour (what the presentation editor uses).
 */
export function RangeControl({
  label, value, min, max, step = 1, suffix = "", onCommit, onLive, onLiveCancel,
  snapBack = false, disabled = false, icon: Icon, compact = false, editable = false, integer = false,
  decimals, inputTestId, className = "",
}) {
  const dp = decimals ?? (integer ? 0 : step < 1 ? 2 : 0);
  const round = (n) => (integer ? Math.round(n) : n);
  const numeric = round(numericValue(value, min));
  const naturalMax = Math.max(min + step, max, numeric);
  const initial = Math.max(min, Math.min(naturalMax, numeric));
  const format = (n) => (Math.abs(n) < 0.0001 ? "0" : String(Number(n.toFixed(dp))));
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
      className="ek-range-slider"
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
    <span className="ek-range-input-wrap">
      <input
        type="number"
        className="ek-range-input"
        aria-label={label}
        data-testid={inputTestId}
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
      {suffix && <span className="ek-input-suffix">{suffix.trim()}</span>}
    </span>
  );
  const shown = Math.abs(draft) < 0.0001 ? 0 : Number(draft.toFixed(dp));
  const readout = editable ? input : <output className="ek-range-output">{shown}{suffix}</output>;

  if (compact) {
    return (
      <div className={`ek-range-control is-compact ${editable ? "is-editable" : ""} ${disabled ? "is-disabled" : ""} ${className}`.trim()}>
        <span className="ek-range-label" title={compact ? label : undefined}>{Icon && <Icon size={13} />}<span className="ek-range-label-text">{label}</span></span>
        {slider}
        {readout}
      </div>
    );
  }

  if (editable) {
    return (
      <div className={`ek-range-control is-editable ${disabled ? "is-disabled" : ""} ${className}`.trim()}>
        <span className="ek-range-label" title={compact ? label : undefined}>{Icon && <Icon size={13} />}<span className="ek-range-label-text">{label}</span></span>
        <div className="ek-range-row">
          {slider}
          {input}
        </div>
      </div>
    );
  }

  return (
    <div className={`ek-range-control ${disabled ? "is-disabled" : ""} ${className}`.trim()}>
      <div className="ek-range-heading">
        <span className="ek-range-label" title={compact ? label : undefined}>{Icon && <Icon size={13} />}<span className="ek-range-label-text">{label}</span></span>
        {readout}
      </div>
      {slider}
      <div className="ek-range-scale"><span>{min}{suffix}</span><span>{safeMax}{suffix}</span></div>
    </div>
  );
}

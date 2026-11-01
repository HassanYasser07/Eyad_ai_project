import React from "react";
import { formatNumber } from "./utils.js";

/**
 * Labeled number input with an end suffix chip. Presentation-editor semantics:
 * commit on blur / Enter, ArrowUp / ArrowDown step, clamp to min/max, comma → dot.
 */
export function NumberField({ label, value, onCommit, onLive, onLiveCancel, step = 1, min = -9999, max = 9999, suffix, decimals = 1, testId, disabled = false, inline = false, className = "" }) {
  const fmt = (v) => formatNumber(Number(v), decimals);
  const [text, setText] = React.useState(fmt(value));
  React.useEffect(() => setText(fmt(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveDirty = React.useRef(false);
  const parse = (raw) => {
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) && String(raw).trim() !== "" ? Math.min(max, Math.max(min, n)) : null;
  };
  const commit = (raw) => {
    const wasLive = liveDirty.current;
    liveDirty.current = false;
    const v = parse(raw);
    if (v === null) { if (wasLive) onLiveCancel?.(); setText(fmt(value)); return; }
    setText(fmt(v));
    if (v !== value) onCommit(v);
    else if (wasLive) onLiveCancel?.();
  };
  const handleChange = (raw) => {
    setText(raw);
    if (!onLive) return;
    const v = parse(raw);
    if (v !== null && v !== value) { liveDirty.current = true; onLive(v); }
  };
  return (
    <label className={`ek-field ${inline ? "is-inline" : ""} ${disabled ? "is-disabled" : ""} ${className}`.trim()}>
      <span>{label}</span>
      <div className="ek-number-input-wrap">
        <input
          inputMode="decimal"
          value={text}
          data-testid={testId}
          aria-label={label}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const base = Number(String(text).replace(",", ".")) || 0;
              commit(base + (e.key === "ArrowUp" ? step : -step));
            }
          }}
        />
        {suffix && <span className="ek-input-suffix">{suffix}</span>}
      </div>
    </label>
  );
}

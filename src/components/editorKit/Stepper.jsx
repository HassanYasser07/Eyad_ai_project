import React from "react";
import { Minus, Plus } from "lucide-react";
import { formatNumber } from "./utils.js";

/** Compact − / typed value / + stepper (toolbars and ribbons). */
export function Stepper({ label, value, min, max, step = 1, decimals = 0, suffix, onCommit, disabled = false, testId }) {
  const fmt = (v) => formatNumber(Number(v), decimals);
  const [text, setText] = React.useState(fmt(value));
  React.useEffect(() => setText(fmt(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (raw) => {
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) { setText(fmt(value)); return; }
    const next = Math.min(max, Math.max(min, decimals === 0 ? Math.round(n) : n));
    setText(fmt(next));
    if (next !== value) onCommit(next);
  };
  return (
    <span className={`ek-stepper ${disabled ? "is-disabled" : ""}`} title={label}>
      <button type="button" className="ek-stepper-btn" aria-label={`${label} −`} title={`${label} −`} disabled={disabled} onClick={() => commit(Number(value) - step)}><Minus size={14} strokeWidth={1.7} aria-hidden="true" /></button>
      <input
        inputMode={decimals ? "decimal" : "numeric"}
        value={text}
        aria-label={label}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); commit(Number(value) + (e.key === "ArrowUp" ? step : -step)); }
        }}
      />
      {suffix && <em className="ek-stepper-suffix">{suffix}</em>}
      <button type="button" className="ek-stepper-btn" aria-label={`${label} +`} title={`${label} +`} disabled={disabled} onClick={() => commit(Number(value) + step)}><Plus size={14} strokeWidth={1.7} aria-hidden="true" /></button>
    </span>
  );
}

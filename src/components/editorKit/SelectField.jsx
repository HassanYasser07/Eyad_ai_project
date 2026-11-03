import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Styled native select. `options`: [{ value, label }] or groups [{ label, options: [...] }].
 * `bare` removes the label column (toolbars / ribbons); `compact` makes it a one-line chip.
 */
export function SelectField({ label, value, options, onChange, testId, disabled = false, bare = false, compact = false, className = "", title }) {
  const render = (o) => <option key={o.value} value={o.value}>{o.label}</option>;
  const select = (
    <span className={`ek-select ${compact ? "is-compact" : ""}`}>
      <select value={value} aria-label={label} title={title || label} data-testid={testId} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (o.options ? <optgroup key={o.label} label={o.label}>{o.options.map(render)}</optgroup> : render(o)))}
      </select>
      <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
  if (bare) return <span className={`ek-select-bare ${disabled ? "is-disabled" : ""} ${className}`.trim()}>{select}</span>;
  return (
    <label className={`ek-field ek-select-field ${disabled ? "is-disabled" : ""} ${className}`.trim()}>
      <span>{label}</span>
      {select}
    </label>
  );
}

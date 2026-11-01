import React from "react";

/** Row of preset pills (e.g. 25 / 50 / 75 / 100 %). */
export function PresetPills({ values, current, onPick, suffix = "%", disabled = false, label }) {
  return (
    <div className="ek-quick-pills" role="group" aria-label={label}>
      {values.map((v) => (
        <button key={v} type="button" className={`ek-preset-pill ${Math.round(current) === v ? "is-active" : ""}`} onClick={() => onPick(v)} disabled={disabled}>{v}{suffix}</button>
      ))}
    </div>
  );
}

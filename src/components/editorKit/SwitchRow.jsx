import React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

/** Label on the start side, soft switch on the end side. Built directly on Radix (the shared ui/switch is untouched). */
export function SwitchRow({ label, hint, checked, onCheckedChange, disabled = false, testId, title }) {
  const id = React.useId();
  return (
    <div className={`ek-switch-row ${disabled ? "is-disabled" : ""}`} title={title}>
      <label htmlFor={id} className="ek-switch-copy">
        <span className="ek-switch-label">{label}</span>
        {hint && <small>{hint}</small>}
      </label>
      <SwitchPrimitives.Root id={id} className="ek-switch" checked={!!checked} onCheckedChange={onCheckedChange} disabled={disabled} data-testid={testId}>
        <SwitchPrimitives.Thumb className="ek-switch-thumb" />
      </SwitchPrimitives.Root>
    </div>
  );
}

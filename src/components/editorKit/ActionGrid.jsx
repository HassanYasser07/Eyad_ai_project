import React from "react";

/** Grid of QuickAction buttons. cols: 2 | 3 | 4 (collapses to 2 on very narrow panels). */
export function ActionGrid({ children, cols = 3, className = "", label }) {
  return <div className={`ek-action-grid ek-cols-${cols} ${className}`.trim()} role="group" aria-label={label}>{children}</div>;
}

/** Icon + label action. `active` renders a toggle (aria-pressed); `danger` the destructive tint. */
export function QuickAction({ icon: Icon, label, onClick, disabled = false, danger = false, active, testId, wide = false }) {
  return (
    <button
      type="button"
      className={`ek-action ${danger ? "is-danger" : ""} ${active ? "is-active" : ""} ${wide ? "is-wide" : ""}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active === undefined ? undefined : !!active}
      data-testid={testId}
    >
      {Icon && <Icon size={14} strokeWidth={1.7} aria-hidden="true" />}<span>{label}</span>
    </button>
  );
}

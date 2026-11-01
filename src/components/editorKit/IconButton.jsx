import React from "react";

/** Square icon button (36–40px card). `text` adds the label beside the icon. */
export function KitIconButton({ icon: Icon, label, onClick, active, disabled, danger, text, size = 18, testId, className = "" }) {
  return (
    <button
      type="button"
      className={`ek-icon-btn ${active ? "is-active" : ""} ${danger ? "is-danger" : ""} ${text ? "has-text" : ""} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : !!active}
      data-testid={testId}
    >
      {Icon && <Icon size={size} strokeWidth={1.7} aria-hidden="true" />}
      {text && <span>{label}</span>}
    </button>
  );
}

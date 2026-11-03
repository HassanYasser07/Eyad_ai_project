import React from "react";

/**
 * Segmented group of icon / text buttons.
 * items: [{ key, icon, label, active, onClick, disabled, testId }]
 */
export function Segmented({ items, className = "", label }) {
  return (
    <span className={`ek-segmented ${className}`.trim()} role="group" aria-label={label}>
      {items.map(({ key, icon: Icon, label: itemLabel, active, onClick, disabled, testId, text }) => (
        <button
          key={key}
          type="button"
          className={`ek-seg-btn ${active ? "is-active" : ""}`}
          title={itemLabel}
          aria-label={itemLabel}
          aria-pressed={active === undefined ? undefined : !!active}
          disabled={disabled}
          data-testid={testId}
          onClick={onClick}
        >
          {Icon && <Icon size={16} strokeWidth={1.7} aria-hidden="true" />}
          {text && <span>{itemLabel}</span>}
        </button>
      ))}
    </span>
  );
}

/** Small vertical divider between toolbar groups. */
export const Divider = () => <i className="ek-divider" aria-hidden="true" />;

import React from "react";
import { ChevronDown } from "lucide-react";

/** Titled section (icon + h3) that holds SubCards. `collapsible` adds a chevron toggle (default open). */
export function PropertySection({ icon: Icon, title, children, collapsible = false, defaultOpen = true, testId, className = "" }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const body = collapsible && !open ? null : <div className="ek-section-body">{children}</div>;
  return (
    <section className={`ek-property-section ${className}`.trim()} data-testid={testId}>
      {collapsible ? (
        <h3><button type="button" className="ek-section-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {Icon && <Icon size={13} strokeWidth={1.7} aria-hidden="true" />}<span>{title}</span><ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
        </button></h3>
      ) : (
        <h3>{Icon && <Icon size={13} strokeWidth={1.7} aria-hidden="true" />}<span>{title}</span></h3>
      )}
      {body}
    </section>
  );
}

export function SubCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`ek-subcard ${className}`.trim()}>
      {title && <div className="ek-subcard-title">{Icon && <Icon size={13} strokeWidth={1.7} aria-hidden="true" />}{title}</div>}
      {children}
    </div>
  );
}

/** Soft "nothing selected" card. */
export function EmptyCard({ icon: Icon, title, children }) {
  return (
    <div className="ek-property-empty">
      {Icon && <span className="ek-property-empty-icon"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>}
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
    </div>
  );
}

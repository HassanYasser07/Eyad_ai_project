import React from "react";
import { X } from "lucide-react";
import { KitIconButton } from "./IconButton.jsx";

/** Bottom sheet (floating card on desktop via the host's CSS): grab handle, header, scroll body, sticky footer. */
export function EditorSheet({ title, onClose, children, testId, tall = false, footer, closeLabel = "Close", className = "" }) {
  return (
    <div className={`pe-sheet ek-sheet ${tall ? "is-tall" : ""} ${className}`.trim()} role="dialog" aria-label={title} data-testid={testId}>
      <div className="pe-sheet-grab ek-sheet-grab" aria-hidden="true" />
      <div className="pe-sheet-head ek-sheet-head"><strong>{title}</strong><KitIconButton icon={X} label={closeLabel} onClick={onClose} testId={testId ? `${testId}-close` : undefined} /></div>
      <div className="pe-sheet-body ek-sheet-body">{children}</div>
      {footer && <div className="pe-sheet-foot ek-sheet-foot">{footer}</div>}
    </div>
  );
}

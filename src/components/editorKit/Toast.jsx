import React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info };

/** Floating status toast. kind: error | success | info */
export function Toast({ kind = "info", children, testId, className = "" }) {
  const Icon = ICONS[kind] || Info;
  return (
    <div className={`ek-toast is-${kind} ${className}`.trim()} role="status" aria-live="polite" data-testid={testId}>
      <Icon size={16} strokeWidth={1.7} aria-hidden="true" /><span>{children}</span>
    </div>
  );
}

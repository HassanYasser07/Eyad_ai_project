import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Side-panel shell: heading (icon, title, count, collapse chevron), vertical rail title when collapsed,
 * optional tab row and the content area. `side` is the edge the panel sits on ("end" | "start") and only
 * decides which way the collapse chevron points.
 */
export function PanelShell({ icon: Icon, title, count, collapsed = false, onToggleCollapsed, side = "end", tabs, activeTab, onTabChange, railTitle, collapseLabel, expandLabel, headingActions, children, testId, className = "" }) {
  const Collapse = (side === "end") === !collapsed ? ChevronRight : ChevronLeft;
  return (
    <section className={`ek-panel ${collapsed ? "is-collapsed" : ""} ${className}`.trim()} aria-label={title} data-testid={testId}>
      <div className="ek-panel-heading">
        <span className="ek-panel-heading-title">
          {Icon && <Icon size={16} strokeWidth={1.7} aria-hidden="true" />}
          <span className="ek-panel-heading-label">{title}</span>
        </span>
        <div className="ek-panel-heading-actions">
          {headingActions}
          {count !== undefined && count !== null && <small className="ek-count">{count}</small>}
          {onToggleCollapsed && (
            <button type="button" className="ek-panel-toggle" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? expandLabel : collapseLabel} title={collapsed ? expandLabel : collapseLabel}>
              <Collapse size={15} strokeWidth={1.7} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <span className="ek-rail-title" aria-hidden="true">{railTitle || title}</span>
      <div className="ek-panel-body">
        {tabs && (
          <div className="ek-panel-tabs" role="tablist">
            {tabs.map(({ key, icon: TabIcon, label, disabled, testId: tabTestId }) => (
              <button key={key} type="button" role="tab" aria-selected={activeTab === key} className={`ek-panel-tab ${activeTab === key ? "is-active" : ""}`} disabled={disabled} data-testid={tabTestId} onClick={() => onTabChange?.(key)}>
                {TabIcon && <TabIcon size={14} strokeWidth={1.7} aria-hidden="true" />}<span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="ek-panel-content">{children}</div>
      </div>
    </section>
  );
}

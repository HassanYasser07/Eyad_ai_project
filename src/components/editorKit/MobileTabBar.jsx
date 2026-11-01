import React from "react";

/**
 * Bottom tab bar. tabs: [{ key, icon, label, active, disabled, onClick, divider, testId }]
 * `divider: true` draws a separator before the tab.
 */
export function MobileTabBar({ tabs, testId, label, className = "" }) {
  return (
    <nav className={`ek-mobile-tabbar ${className}`.trim()} data-testid={testId} aria-label={label}>
      {tabs.map(({ key, icon: Icon, label: tabLabel, active, disabled, onClick, divider, testId: tabTestId }) => (
        <React.Fragment key={key}>
          {divider && <i className="ek-mobile-tab-divider" aria-hidden="true" />}
          <button type="button" className={`ek-mobile-tab ${active ? "is-active" : ""}`} aria-pressed={!!active} aria-label={tabLabel} title={tabLabel} disabled={disabled} data-testid={tabTestId} onClick={onClick}>
            {Icon && <Icon size={22} aria-hidden="true" />}
            <span>{tabLabel}</span>
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

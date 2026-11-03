import React from "react";

/**
 * Generic layer row. The grip is passed in (so the host keeps its own pointer-drag handlers),
 * `thumb` is the 36px tile, `actions` the trailing icon buttons.
 */
export function LayerCard({
  selected, hidden, locked, dragging, over, depth = 0, grip, thumb, thumbKind, title, subtitle, actions,
  onSelect, draggable, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  dataLayerIndex, ariaLabel, tabIndex = 0, onKeyDown, dragAttr,
}) {
  return (
    <li
      className={`ek-layer-card ${selected ? "is-selected" : ""} ${hidden ? "is-hidden" : ""} ${locked ? "is-locked" : ""} ${dragging ? "is-dragging" : ""} ${over ? "is-drop-target" : ""}`.trim()}
      style={{ "--layer-depth": depth }}
      data-layer-index={dataLayerIndex}
      data-dragging={dragAttr}
      draggable={draggable}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-current={selected || undefined}
      onClick={(event) => { if (event.target.closest("button")) return; onSelect?.(event); }}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {grip}
      <button type="button" className="ek-layer-select" onClick={onSelect} aria-pressed={!!selected} aria-label={ariaLabel} title={title}>
        <span className="ek-layer-thumbnail" data-kind={thumbKind} aria-hidden="true">{thumb}</span>
        <span className="ek-layer-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span>
      </button>
      {actions && <span className="ek-layer-actions">{actions}</span>}
    </li>
  );
}

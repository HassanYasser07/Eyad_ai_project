import React from "react";
import { normalizeAngle } from "./utils.js";

const HW_W = 200;
const HW_H = 124;
const HW_CX = 100;
const HW_CY = 100;
const HW_R = 84;
const HW_MAJOR_VALUES = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
const HW_LABEL_VALUES = [-180, -90, 0, 90, 180];

function hwPoint(angleValue, radius) {
  const dial = (angleValue / 2) * Math.PI / 180; // value → dial angle measured from the top
  return { x: HW_CX + Math.sin(dial) * radius, y: HW_CY - Math.cos(dial) * radius };
}

export function RotationHalfWheel({ value, onCommit, onLive, disabled, label, hint, presets = [-90, -45, 0, 45, 90], hideHint = false }) {
  const currentValue = normalizeAngle(value);
  const [draft, setDraft] = React.useState(currentValue);
  const dragging = React.useRef(false);
  const lastLive = React.useRef(null);
  React.useEffect(() => { if (!dragging.current) setDraft(currentValue); }, [currentValue]);

  const valueFromPointer = (event, fallback) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return fallback;
    const pivotX = rect.left + rect.width * (HW_CX / HW_W);
    const pivotY = rect.top + rect.height * (HW_CY / HW_H);
    const dx = event.clientX - pivotX;
    const dy = event.clientY - pivotY;
    if (dy > 0) {
      // Pointer dropped below the baseline: clamp to the nearest end of the dial.
      if (dx === 0) return fallback;
      return dx > 0 ? 180 : -180;
    }
    const dial = Math.atan2(dx, -dy) * 180 / Math.PI; // -90 … 90 from the top
    return Math.max(-180, Math.min(180, Math.round(dial * 2)));
  };
  const startDrag = (event) => {
    if (disabled) return;
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const first = valueFromPointer(event, draft);
    setDraft(first);
    lastLive.current = first;
    if (first !== currentValue) onLive?.(first);
  };
  const moveDrag = (event) => {
    if (!dragging.current) return;
    const next = valueFromPointer(event, draft);
    if (next === lastLive.current) return;
    lastLive.current = next;
    setDraft(next);
    onLive?.(next);
  };
  const endDrag = (event) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = valueFromPointer(event, draft);
    lastLive.current = null;
    setDraft(next);
    onCommit(next);
  };
  const handleKeys = (event) => {
    let next = draft;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next += event.shiftKey ? 15 : 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= event.shiftKey ? 15 : 1;
    else if (event.key === "Home") next = 0;
    else return;
    event.preventDefault();
    next = normalizeAngle(next);
    setDraft(next);
    onCommit(next);
  };

  const needleEnd = hwPoint(draft, HW_R - 20);
  const handle = hwPoint(draft, HW_R);
  const top = hwPoint(0, HW_R);
  const arcStart = hwPoint(-180, HW_R);
  const arcEnd = hwPoint(180, HW_R);
  const progressPath = Math.round(draft) === 0
    ? null
    : `M ${top.x} ${top.y} A ${HW_R} ${HW_R} 0 0 ${draft > 0 ? 1 : 0} ${handle.x} ${handle.y}`;

  return (
    <div className="ek-hw">
      <div
        className={`ek-hw-dial ${disabled ? "is-disabled" : ""}`}
        role="slider"
        aria-label={label}
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={Math.round(draft)}
        aria-valuetext={`${Math.round(draft)}°`}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeys}
      >
        <svg viewBox={`0 0 ${HW_W} ${HW_H}`} aria-hidden="true">
          {/* Dashed half-wheel rim */}
          <path className="ek-hw-rim" pathLength="96" d={`M ${arcStart.x} ${arcStart.y} A ${HW_R} ${HW_R} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} />
          {/* Inner hairline arc */}
          <path className="ek-hw-inner" d={`M ${hwPoint(-180, HW_R - 14).x} ${hwPoint(-180, HW_R - 14).y} A ${HW_R - 14} ${HW_R - 14} 0 0 1 ${hwPoint(180, HW_R - 14).x} ${hwPoint(180, HW_R - 14).y}`} />
          {/* Major ticks */}
          {HW_MAJOR_VALUES.map((tick) => {
            const outer = hwPoint(tick, HW_R + 7);
            const inner = hwPoint(tick, HW_R - 14);
            const isZero = tick === 0;
            return <line key={tick} className={`ek-hw-major ${isZero ? "is-zero" : ""}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
          })}
          {/* Labels */}
          {HW_LABEL_VALUES.map((tick) => {
            const pos = hwPoint(tick, HW_R - 27);
            return <text key={tick} className="ek-hw-label" x={pos.x} y={pos.y + 3} textAnchor="middle">{tick}</text>;
          })}
          {/* Progress arc from 0° to the current value */}
          {progressPath && <path className="ek-hw-progress" d={progressPath} />}
          {/* Needle, hub and handle */}
          <line className="ek-hw-needle" x1={HW_CX} y1={HW_CY} x2={needleEnd.x} y2={needleEnd.y} />
          <circle className="ek-hw-hub" cx={HW_CX} cy={HW_CY} r="5" />
          <circle className="ek-hw-handle" cx={handle.x} cy={handle.y} r="7" />
          <text className="ek-hw-value" x={HW_CX} y={HW_H - 4} textAnchor="middle">{Math.round(draft)}°</text>
        </svg>
      </div>
      {hint && !hideHint && <span className="ek-hw-hint">{hint}</span>}
      <div className="ek-angle-presets">
        {presets.map((angle) => (
          <button type="button" key={angle} onClick={() => { setDraft(angle); onCommit(angle); }} disabled={disabled} className={normalizeAngle(value) === angle ? "is-active" : ""}>{angle}°</button>
        ))}
      </div>
    </div>
  );
}

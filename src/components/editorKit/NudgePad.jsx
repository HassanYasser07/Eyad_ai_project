import React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";

function NudgeButton({ icon: Icon, label, onClick, disabled, testId }) {
  return <button type="button" className="ek-nudge-button" aria-label={label} title={label} onClick={onClick} disabled={disabled} data-testid={testId}><Icon size={16} strokeWidth={1.7} aria-hidden="true" /></button>;
}

/**
 * "Precise move" card: title, move-step stepper and ↑ ← ↓ → pad.
 * `onNudge(dx, dy)` receives values already multiplied by the current step.
 * The step is uncontrolled unless `step` + `onStepChange` are provided.
 */
export function NudgePad({ title, stepLabel, step: stepProp, onStepChange, defaultStep = 1, stepMin = 0.1, stepMax = 1000, stepDelta = 0.1, unit = "", onNudge, disabled = false, labels = {}, testIds = {}, hint }) {
  const [inner, setInner] = React.useState(defaultStep);
  const step = stepProp ?? inner;
  const setStep = (n) => (onStepChange ? onStepChange(n) : setInner(n));
  const bump = (dir) => setStep(Math.min(stepMax, Math.max(stepMin, Math.round((step + dir * stepDelta) * 10) / 10)));
  return (
    <div className="ek-subcard ek-nudge-wrap">
      <div className="ek-nudge-heading">
        <strong>{title}</strong>
        <div className="ek-nudge-step">
          <span>{stepLabel}</span>
          <output className="ek-nudge-step-value" aria-live="polite">{Number(step.toFixed(1))}{unit && <small>{unit}</small>}</output>
          <span className="ek-nudge-step-arrows">
            <button type="button" aria-label={`${stepLabel} +`} title={`${stepLabel} +`} disabled={disabled || step >= stepMax} onClick={() => bump(1)}><ChevronUp size={11} aria-hidden="true" /></button>
            <button type="button" aria-label={`${stepLabel} −`} title={`${stepLabel} −`} disabled={disabled || step <= stepMin} onClick={() => bump(-1)}><ChevronDown size={11} aria-hidden="true" /></button>
          </span>
        </div>
      </div>
      <div className="ek-nudge-grid" role="group" aria-label={title}>
        <span />
        <NudgeButton icon={ArrowUp} label={labels.up} onClick={() => onNudge(0, -step)} disabled={disabled} testId={testIds.up} />
        <span />
        <NudgeButton icon={ArrowLeft} label={labels.left} onClick={() => onNudge(-step, 0)} disabled={disabled} testId={testIds.left} />
        <NudgeButton icon={ArrowDown} label={labels.down} onClick={() => onNudge(0, step)} disabled={disabled} testId={testIds.down} />
        <NudgeButton icon={ArrowRight} label={labels.right} onClick={() => onNudge(step, 0)} disabled={disabled} testId={testIds.right} />
      </div>
      {hint && <p className="ek-note">{hint}</p>}
    </div>
  );
}

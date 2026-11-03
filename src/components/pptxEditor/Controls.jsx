import React from "react";
import {
  KitIconButton, ColorPopoverField, NumberField as KitNumberField, RangeControl, SelectField as KitSelectField,
  PropertySection, hexToCss, cssToHex,
} from "@/components/editorKit";

/*
 * Presentation-editor control adapters. The names and props below are what the rest of the editor
 * already imports; each one is a thin layer over the shared editor kit, so this editor and the SVG
 * editor render the same controls. Colours in the PPTX model are "RRGGBB" (no #); the kit uses "#rrggbb".
 */

export function IconButton({ icon, label, onClick, active, disabled, danger, text, size = 18, testId }) {
  // `pe-btn` stays on the element so the chrome rules that target it (slide nav, present mode…) keep working.
  return <KitIconButton icon={icon} label={label} onClick={onClick} active={active} disabled={disabled} danger={danger} text={text} size={size} testId={testId} className="pe-btn" />;
}

export function ColorField({ label, value, onChange, onLive, onNone, themeColors = [], noneLabel, testId, customColorLabel = "Choose any color", icon, disabled = false, themeLabel }) {
  return (
    <ColorPopoverField
      label={label}
      value={value ? hexToCss(value) : null}
      onChange={(css) => onChange(cssToHex(css))}
      onLive={onLive ? (css) => onLive(cssToHex(css)) : undefined}
      onNone={onNone}
      noneLabel={noneLabel}
      themeColors={themeColors.map((c) => hexToCss(c))}
      themeLabel={themeLabel}
      customColorLabel={customColorLabel}
      testId={testId}
      icon={icon}
      disabled={disabled}
    />
  );
}

/** Numeric field (commit on blur / Enter, ArrowUp/Down step, clamped). */
export const NumberField = KitNumberField;

/** Wave slider. Commit-on-release only: the presentation engine records one undo step per gesture. */
export function SliderField({ label, value, onCommit, onLive, onLiveCancel, min = 0, max = 100, step = 1, suffix = "%", testId, layout = "editable", disabled = false, icon, snapBack = false, integer = true, decimals, inputTestId }) {
  return (
    <div className="pe-slider-field" data-testid={testId}>
      <RangeControl
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        compact={layout === "compact"}
        editable={layout !== "plain"}
        integer={integer}
        decimals={decimals}
        inputTestId={inputTestId}
        snapBack={snapBack}
        disabled={disabled}
        icon={icon}
        onCommit={onCommit}
        onLive={onLive}
        onLiveCancel={onLiveCancel}
      />
    </div>
  );
}

/** Styled select. `options`: [{ value, label }] (or groups with `options`). */
export const SelectField = KitSelectField;

export function Section({ title, icon, children }) {
  return <PropertySection icon={icon} title={title}>{children}</PropertySection>;
}

export { SwitchRow, Segmented, Stepper, Divider } from "@/components/editorKit";

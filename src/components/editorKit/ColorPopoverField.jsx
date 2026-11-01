import React from "react";
import { X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPickerCard } from "./ColorPickerCard.jsx";
import { ColorSwatches } from "./ColorSwatches.jsx";
import { hexToCss } from "./utils.js";

/**
 * Chip trigger (swatch + label) that opens a popover with the colour picker card, swatches and an
 * optional "none" action. `value` / `onChange` use "#rrggbb" (or null/"none").
 * The popover is portaled outside any editor root, hence the unscoped `ek-pop` class.
 */
export function ColorPopoverField({ label, value, onChange, onNone, noneLabel, themeColors = [], themeLabel, customColorLabel, onLive, testId, disabled = false, icon: Icon, closeOnPick = true, t }) {
  const [open, setOpen] = React.useState(false);
  const isNone = !value || /^(none|transparent)$/i.test(String(value));
  const css = isNone ? null : hexToCss(value);
  const tt = React.useMemo(() => (key) => (key === "svgEditor.chooseColor" && customColorLabel ? customColorLabel : t?.(key)), [t, customColorLabel]);
  const pick = (c) => { onChange(c); if (closeOnPick) setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="ek-color-chip" aria-label={label} title={label} disabled={disabled} data-testid={testId}>
          {Icon && <Icon size={15} strokeWidth={1.7} aria-hidden="true" />}
          <span className="ek-chip-swatch" style={{ background: css || "transparent" }} data-none={isNone} />
          <span className="ek-chip-label">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="ek-pop" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <ColorPickerCard label={label} value={css || "none"} onChange={onChange} onLive={onLive || (() => {})} t={tt} />
        <ColorSwatches current={{ value: css || "none" }} onPick={pick} themeColors={themeColors.map((c) => hexToCss(c))} themeLabel={themeLabel} targetLabel={label} t={t} />
        {onNone && (
          <button type="button" className="ek-link-btn" onClick={() => { onNone(); setOpen(false); }}>
            <X size={13} aria-hidden="true" />{noneLabel}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

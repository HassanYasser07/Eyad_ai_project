import React from "react";
import { RotateCcw } from "lucide-react";
import { COLOR_PRESETS, paintKey } from "./utils.js";

/**
 * Swatch grid. `palette` defaults to the shared presets; `themeColors` (array of #rrggbb) render first
 * under a caption. `original` (optional { raw, value }) is the reset swatch; the presentation editor omits it.
 */
export function ColorSwatches({ original, current, onPick, disabled = false, targetLabel = "", t, className = "", palette = COLOR_PRESETS, themeColors, themeLabel }) {
  const currentKey = paintKey(current?.value);
  const originalKey = original ? paintKey(original.value) : null;
  const originalSelected = originalKey !== null && originalKey === currentKey;
  const originalKind = originalKey === "none" ? "is-none" : originalKey?.startsWith("url(") ? "is-paint" : "";
  const originalTitle = `${t?.("svgEditor.originalColor") || "Original color"}${originalKind ? "" : ` ${originalKey?.toUpperCase()}`}`;
  const swatch = (color) => (
    <button
      key={color}
      type="button"
      className={`ek-color-swatch ${!originalSelected && currentKey === color.toLowerCase() ? "is-selected" : ""}`}
      style={{ "--swatch-color": color }}
      aria-label={`${targetLabel} ${color}`.trim()}
      title={color}
      onClick={() => onPick(color)}
      disabled={disabled}
    ><span /></button>
  );
  const themed = (themeColors || []).filter(Boolean);
  const rest = palette.filter((c) => !themed.some((x) => x.toLowerCase() === c.toLowerCase()));
  return (
    <div className="ek-swatches-block">
      {themed.length > 0 && (
        <>
          {themeLabel && <div className="ek-swatches-caption">{themeLabel}</div>}
          <div className={`ek-color-swatches ${className}`.trim()}>{themed.map(swatch)}</div>
          <div className="ek-swatches-caption" aria-hidden="true">&nbsp;</div>
        </>
      )}
      <div className={`ek-color-swatches ${className}`.trim()}>
        {original && (
          <button
            type="button"
            className={`ek-color-swatch is-original ${originalKind} ${originalSelected ? "is-selected" : ""}`}
            style={{ "--swatch-color": originalKind ? undefined : originalKey }}
            aria-label={`${targetLabel} – ${originalTitle}`}
            aria-pressed={originalSelected}
            title={originalTitle}
            onClick={() => onPick(original.raw)}
            disabled={disabled}
          >
            <span><RotateCcw size={9} aria-hidden="true" /></span>
          </button>
        )}
        {rest.map(swatch)}
      </div>
    </div>
  );
}

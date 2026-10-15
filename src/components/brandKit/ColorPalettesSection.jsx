/**
 * Color Palettes section — visual palette cards with real swatches.
 * Clicking a palette updates the Live Brand Preview instantly (local state).
 * Apply/Save persists the selection to the Brand Source of Truth.
 */
import React from "react";
import { Check, Loader2 } from "lucide-react";

export default function ColorPalettesSection({
  palettes,
  savedPaletteId,
  currentPaletteId,
  onSelect,
  onApply,
  dirty,
  saving,
  ar,
}) {
  return (
    <section className="vi-section">
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon">◑</span>
          <h2>{ar ? "لوحات الألوان" : "Color Palettes"}</h2>
        </div>
        <span className="vi-section-hint">
          {ar ? "اضغط لتجربة فورية" : "Tap to try instantly"}
        </span>
      </div>

      <div className="vi-palettes-grid">
        {palettes.map((palette) => {
          const isSaved = palette.id === savedPaletteId;
          const isCurrent = palette.id === currentPaletteId;
          const isPreviewing = isCurrent && !isSaved;
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => onSelect(palette.id)}
              className={`vi-palette-card ${isCurrent ? "is-current" : ""} ${isSaved ? "is-saved" : ""}`}
            >
              <div className="vi-palette-swatches">
                {palette.swatches.map((swatch) => (
                  <span key={swatch} style={{ background: swatch }} className="vi-palette-swatch" />
                ))}
              </div>
              <div className="vi-palette-info">
                <span className="vi-palette-name">{ar ? palette.name.ar : palette.name.en}</span>
                <span className="vi-palette-hex">{palette.primary}</span>
              </div>
              {isSaved && (
                <span className="vi-palette-badge">
                  <Check className="w-3 h-3" />
                  {ar ? "معتمدة" : "Active"}
                </span>
              )}
              {isPreviewing && (
                <span className="vi-palette-preview-tag">
                  {ar ? "تجربة" : "Preview"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {dirty && (
        <button
          type="button"
          onClick={onApply}
          disabled={saving}
          className="vi-apply-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "اعتماد اللوحة" : "Apply Palette")}
        </button>
      )}
    </section>
  );
}
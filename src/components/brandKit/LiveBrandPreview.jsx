/**
 * Live Brand Preview — sticky card at the top of Visual Identity Studio.
 * Shows the transparent logo, brand name, typography samples, and current
 * color swatches. Updates instantly from preview state — no API calls.
 */
import React from "react";

export default function LiveBrandPreview({ brand, palette, background, backgroundOpacity = 70, onBackgroundOpacityChange, arabicFont, englishFont, ar, dirty }) {
  const logoUrl = brand?.logo?.url;
  const brandName = brand?.brand_name || (ar ? "اسم العلامة" : "Brand Name");

  return (
    <div
      className="vi-preview"
      style={{
        "--vi-primary": palette.primary,
        "--vi-secondary": palette.secondary,
        "--vi-accent": palette.accent,
        "--vi-surface": palette.surface,
      }}
    >
      <div
        className="vi-preview-card"
        style={{
          "--vi-bg-value": background?.value || "linear-gradient(135deg,#ffffff 0%,#eaf4ff 100%)",
          "--vi-bg-opacity": Math.max(0, Math.min(100, Number(backgroundOpacity) || 0)) / 100,
          "--vi-palette-overlay": "linear-gradient(135deg, color-mix(in srgb, " + palette.surface + " 78%, transparent) 0%, color-mix(in srgb, " + palette.accent + " 34%, transparent) 48%, color-mix(in srgb, " + palette.secondary + " 28%, transparent) 100%)",
        }}
      >
        <div className="vi-preview-logo">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="vi-preview-logo-img" />
          ) : (
            <div className="vi-preview-logo-empty">
              <span>{ar ? "لا شعار" : "No logo"}</span>
            </div>
          )}
        </div>
        <div className="vi-preview-info">
          <h3
            className="vi-preview-name"
            style={{ fontFamily: ar ? arabicFont.family : englishFont.family }}
          >
            {brandName}
          </h3>
          <div className="vi-preview-samples">
            <p className="vi-preview-sample" style={{ fontFamily: arabicFont.family }}>
              {ar ? "نموذج الخط العربي للهوية البصرية" : "Arabic typography sample for visual identity"}
            </p>
            <p className="vi-preview-sample" style={{ fontFamily: englishFont.family }}>
              {ar ? "English typography sample for visual identity" : "English typography sample for visual identity"}
            </p>
          </div>
        </div>
        <div className="vi-preview-controls">
          <div className="vi-preview-swatches">
            {palette.swatches.map((swatch) => (
              <span key={swatch} style={{ background: swatch }} className="vi-preview-swatch" />
            ))}
          </div>
          <div className="vi-palette-opacity-control">
            <div className="vi-palette-opacity-label">
              <span>{ar ? "شفافية الخلفية" : "Background opacity"}</span>
              <strong>{Math.round(backgroundOpacity)}%</strong>
            </div>
            <input
              className="vi-palette-opacity-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={backgroundOpacity}
              onChange={(event) => onBackgroundOpacityChange?.(Number(event.target.value))}
              aria-label={ar ? "شفافية الخلفية" : "Background opacity"}
            />
          </div>
        </div>
      </div>
      {dirty && (
        <div className="vi-preview-dirty">
          <span className="vi-preview-dirty-dot" />
          {ar ? "تغييرات غير محفوظة — اضغط اعتماد للحفظ" : "Unsaved changes — press Apply to save"}
        </div>
      )}
    </div>
  );
}
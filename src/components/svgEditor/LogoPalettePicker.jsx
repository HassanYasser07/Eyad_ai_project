import React from "react";
import { Check } from "lucide-react";
import { LOGO_PALETTES } from "@/components/svgEditor/logoPalettes";

/**
 * Palette gallery for logos. Each card previews the palette on a tiny logo mock-up
 * (background · primary mark · secondary mark · accent dot · wordmark) with its four swatches underneath.
 */
export default function LogoPalettePicker({ onSelect, selectedPaletteId, t = (value) => value }) {
  const nameOf = (palette) => {
    const key = `svgEditor.logoPalette.${palette.id}`;
    const translated = t(key);
    return translated && translated !== key ? translated : palette.name;
  };
  return (
    <div className="svg-editor-logo-palettes" role="list" aria-label={t("svgEditor.logoPalettesTitle")}>
      {LOGO_PALETTES.map((palette) => {
        const [bg, primary, secondary, accent] = palette.colors;
        const selected = selectedPaletteId === palette.id;
        const name = nameOf(palette);
        return (
          <button
            key={palette.id}
            type="button"
            role="listitem"
            className={`svg-editor-logo-palette-card ${selected ? "is-selected" : ""}`}
            aria-pressed={selected}
            title={name}
            onClick={() => onSelect(palette)}
          >
            <span className="svg-editor-logo-palette-preview" style={{ background: bg }}>
              <svg viewBox="0 0 120 72" aria-hidden="true" focusable="false">
                <circle cx="40" cy="30" r="18" fill={primary} />
                <rect x="52" y="22" width="30" height="30" rx="8" fill={secondary} />
                <circle cx="82" cy="20" r="6" fill={accent} />
                <rect x="30" y="58" width="60" height="5" rx="2.5" fill={primary} />
              </svg>
              {selected && <span className="svg-editor-logo-palette-check"><Check size={12} /></span>}
            </span>
            <span className="svg-editor-logo-palette-copy">
              <strong>{name}</strong>
              <small>{palette.colors.map((color) => <i key={color} style={{ background: color }} />)}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

import React from "react";
import { Check, Palette } from "lucide-react";
import { PRESENTATION_PALETTES } from "./presentationPalettes";
import "./colorPalettePicker.css";

export default function ColorPalettePicker({ onSelect, selectedPaletteId, t = (value) => value }) {
  return (
    <div className="presentation-palette-gallery" role="list" aria-label={t("palette.galleryTitle")}>
      {PRESENTATION_PALETTES.map((palette) => {
        const selected = selectedPaletteId === palette.id;
        return (
          <button key={palette.id} type="button" className={`presentation-palette-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(palette)} role="listitem" aria-pressed={selected} title={t(`palette.${palette.id}`)}>
            <span className="presentation-palette-preview" style={{ "--palette-bg": palette.colors[0], "--palette-ink": palette.colors[1] }}>
              <span className="presentation-palette-title-mark" />
              <span className="presentation-palette-line-mark" />
              <span className="presentation-palette-bars">{palette.colors.slice(2).map((color) => <i key={color} style={{ background: color }} />)}</span>
              {selected && <span className="presentation-palette-check"><Check size={14} /></span>}
            </span>
            <span className="presentation-palette-card-copy"><strong>{t(`palette.${palette.id}`)}</strong><small>{palette.colors.map((color) => <i key={color} style={{ background: color }} />)}</small></span>
          </button>
        );
      })}
    </div>
  );
}

import React from "react";
import { Check, Sparkles, X } from "lucide-react";
import { LOGO_STYLE_REFERENCES } from "@/config/logoStyleReferences";
import "./logoStyleReferencePicker.css";

/**
 * Single-select gallery of reference logos. The selected one is sent with the generation
 * request so it steers the style of the new logos (same idea as "Visual style" in the
 * AI Images Studio). Click the selected card again, or "Clear", to remove it.
 */
export default function LogoStyleReferencePicker({ value, onChange, onCreate, creating = false, ar = false }) {
  const items = LOGO_STYLE_REFERENCES;
  const selected = items.find((item) => item.id === value) || null;

  if (!items.length) {
    // Nothing to show in production; in dev tell the developer where to drop the SVG files.
    if (!import.meta.env.DEV) return null;
    return (
      <section className="lsr">
        <div className="lsr-empty">
          Add .svg files to <code>src/assets/logoStyles/</code> and they will appear here.
        </div>
      </section>
    );
  }

  return (
    <section className="lsr" aria-labelledby="lsr-heading">
      <div className="lsr-head">
        <div>
          <h2 id="lsr-heading">{ar ? "ستايل اللوجو المرجعي" : "Logo style reference"}</h2>
          <p>
            {ar
              ? "اختر لوجو واحد يكون مرجع للستايل، وإياد يصمم لوجو جديد بنفس الروح."
              : "Pick one logo as a style reference — EYAD designs a new logo with the same feel."}
          </p>
        </div>
        <span className="lsr-tag">{ar ? "اختياري" : "Optional"}</span>
      </div>

      <div className="lsr-grid" role="radiogroup" aria-label={ar ? "ستايل اللوجو المرجعي" : "Logo style reference"}>
        {items.map((item) => {
          const isSelected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={"lsr-card" + (isSelected ? " is-selected" : "")}
              onClick={() => onChange(isSelected ? null : item.id)}
            >
              <span className="lsr-thumb">
                <img src={item.url} alt="" loading="lazy" draggable="false" />
              </span>
              <span className="lsr-name">{ar ? item.ar : item.en}</span>
              {isSelected ? <span className="lsr-check"><Check /></span> : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="lsr-bar" role="status">
          <span className="lsr-bar-thumb"><img src={selected.url} alt="" /></span>
          <span className="lsr-bar-text">
            <small>{ar ? "الستايل المختار" : "Selected style"}</small>
            <strong>{ar ? selected.ar : selected.en}</strong>
          </span>
          <button type="button" className="lsr-clear" onClick={() => onChange(null)}>
            <X />{ar ? "إلغاء" : "Clear"}
          </button>
          {onCreate ? (
            <button type="button" className="lsr-create" disabled={creating} onClick={onCreate}>
              <Sparkles />{creating ? (ar ? "جاري الإنشاء..." : "Generating...") : (ar ? "إنشاء الشعارات بهذا الستايل" : "Create logos with this style")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

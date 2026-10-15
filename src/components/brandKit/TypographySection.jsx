/**
 * Typography section — Arabic and English font options with real previews.
 * Selecting a font updates the Live Brand Preview instantly (local state).
 * Apply/Save persists the selection to the Brand Source of Truth.
 */
import React from "react";
import { Check, Loader2 } from "lucide-react";

function FontCard({ font, isSaved, isCurrent, isPreviewing, onSelect, ar }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(font.id)}
      className={`vi-font-card ${isCurrent ? "is-current" : ""} ${isSaved ? "is-saved" : ""}`}
    >
      <span className="vi-font-sample" style={{ fontFamily: font.family }}>
        {font.sample}
      </span>
      <span className="vi-font-name">{font.name}</span>
      {isSaved && (
        <span className="vi-font-badge">
          <Check className="w-3 h-3" />
          {ar ? "معتمد" : "Active"}
        </span>
      )}
      {isPreviewing && (
        <span className="vi-font-preview-tag">
          {ar ? "تجربة" : "Preview"}
        </span>
      )}
    </button>
  );
}

export default function TypographySection({
  arabicFonts,
  englishFonts,
  savedArabicFontId,
  savedEnglishFontId,
  currentArabicFontId,
  currentEnglishFontId,
  onSelectArabic,
  onSelectEnglish,
  onApply,
  dirty,
  saving,
  ar,
}) {
  return (
    <section className="vi-section">
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon">Aa</span>
          <h2>{ar ? "الخطوط" : "Typography"}</h2>
        </div>
        <span className="vi-section-hint">
          {ar ? "عربي وإنجليزي" : "Arabic & English"}
        </span>
      </div>

      <div className="vi-typography-group">
        <h3 className="vi-typography-subtitle">{ar ? "الخط العربي" : "Arabic Font"}</h3>
        <div className="vi-fonts-grid">
          {arabicFonts.map((font) => (
            <FontCard
              key={font.id}
              font={font}
              isSaved={font.id === savedArabicFontId}
              isCurrent={font.id === currentArabicFontId}
              isPreviewing={font.id === currentArabicFontId && font.id !== savedArabicFontId}
              onSelect={onSelectArabic}
              ar={ar}
            />
          ))}
        </div>
      </div>

      <div className="vi-typography-group">
        <h3 className="vi-typography-subtitle">{ar ? "الخط الإنجليزي" : "English Font"}</h3>
        <div className="vi-fonts-grid">
          {englishFonts.map((font) => (
            <FontCard
              key={font.id}
              font={font}
              isSaved={font.id === savedEnglishFontId}
              isCurrent={font.id === currentEnglishFontId}
              isPreviewing={font.id === currentEnglishFontId && font.id !== savedEnglishFontId}
              onSelect={onSelectEnglish}
              ar={ar}
            />
          ))}
        </div>
      </div>

      {dirty && (
        <button
          type="button"
          onClick={onApply}
          disabled={saving}
          className="vi-apply-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "اعتماد الخطوط" : "Apply Typography")}
        </button>
      )}
    </section>
  );
}
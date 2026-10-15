import React from "react";
import { Check, Loader2 } from "lucide-react";

export default function BackgroundsSection({
  backgrounds,
  savedBackgroundId,
  currentBackgroundId,
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
          <span className="vi-section-icon">◌</span>
          <h2>{ar ? "خلفيات الهوية" : "Brand Backgrounds"}</h2>
        </div>
        <span className="vi-section-hint">
          {ar ? "اضغط للتجربة الفورية" : "Tap to preview instantly"}
        </span>
      </div>

      <div className="vi-backgrounds-grid">
        {backgrounds.map((background) => {
          const isSaved = background.id === savedBackgroundId;
          const isCurrent = background.id === currentBackgroundId;
          const isPreviewing = isCurrent && !isSaved;
          return (
            <button
              key={background.id}
              type="button"
              onClick={() => onSelect(background.id)}
              className={`vi-background-card ${isCurrent ? "is-current" : ""} ${isSaved ? "is-saved" : ""}`}
            >
              <span
                className="vi-background-swatch"
                style={{ background: background.value }}
                aria-hidden="true"
              />
              <span className="vi-background-name">{ar ? background.name.ar : background.name.en}</span>
              {isSaved && (
                <span className="vi-background-badge">
                  <Check className="w-3 h-3" />
                  {ar ? "معتمدة" : "Active"}
                </span>
              )}
              {isPreviewing && (
                <span className="vi-background-preview-tag">
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
          {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "اعتماد الخلفية" : "Apply Background")}
        </button>
      )}
    </section>
  );
}

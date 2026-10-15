/**
 * Brand Logo section — displays the approved logo from Logo Studio or EYAD Chat.
 * If no logo is attached, shows a prompt to design one in Logo Studio.
 * Also includes the editable brand name field.
 */
import React from "react";
import { Check, ImagePlus, Loader2, Upload, Shapes } from "lucide-react";

export default function BrandLogoSection({ logo, brandName, onNameChange, onSaveName, onUploadLogo, onUploadRequest, saving, uploading, projectId, ar, hasApprovedLogo, attention }) {
  const inputRef = React.useRef(null);
  const openLogoStudio = () => {
    window.location.href = projectId ? `/studios/logo?project=${encodeURIComponent(projectId)}` : "/studios/logo";
  };

  return (
    <section className={`vi-section vi-logo-section ${attention ? "vi-logo-section--attention" : ""}`}>
      {attention && (
        <div className="vi-logo-attention" role="alert" style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 14, padding: "12px 14px", border: "1px solid rgba(37,99,235,.24)", borderRadius: 16, background: "rgba(239,246,255,.9)", boxShadow: "0 10px 30px rgba(37,99,235,.08)" }}>
          <span style={{ fontWeight: 800, color: "#1d4ed8", fontSize: 14 }}>{ar ? "لم يتم اعتماد شعار" : "No approved logo"}</span>
          <small style={{ color: "#64748b", fontSize: 12, lineHeight: 1.55 }}>{ar ? "أنشئ شعارًا أو ارفع شعارك أولًا، ثم ارجع للموك أب لبدء التوليد." : "Create or upload a logo first, then return to Mockup to start generation."}</small>
        </div>
      )}
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon">◈</span>
          <h2>{ar ? "الشعار" : "Logo"}</h2>
        </div>
        <span className="vi-section-hint">{ar ? "الأصل المعتمد" : "Approved asset"}</span>
      </div>

      <div className="vi-logo-display">
        {hasApprovedLogo && (logo?.svg_url || logo?.url) ? (
          <div className="vi-logo-img-wrap">
            <img src={logo.svg_url || logo.url} alt={brandName || "Logo"} className="vi-logo-img" />
            <span className="vi-logo-badge">
              <Check className="w-3 h-3" />
              {ar ? "معتمد" : "Approved"}
            </span>
          </div>
        ) : (
          <div className="vi-logo-empty">
            <ImagePlus className="w-7 h-7 vi-logo-empty-icon" />
            <p className="vi-logo-empty-text">
{hasApprovedLogo ? (ar ? "لا يوجد شعار محفوظ. صمّم شعارًا في استوديو الشعارات أو ارفع شعارك من جهازك." : "No saved logo yet. Design one in Logo Studio or upload your own logo.") : (ar ? "لم يتم اعتماد شعار بعد. صمّم شعارًا أو ارفع شعارك لاستخدامه في الموك أب." : "No logo has been approved yet. Design or upload a logo to use it in Mockups.")}
            </p>
            <div className="vi-logo-empty-actions">
              <button type="button" onClick={openLogoStudio} className="vi-logo-action-btn vi-logo-action-primary">
                <Shapes className="w-4 h-4" />
                {ar ? "صمم شعار" : "Design Logo"}
              </button>
              <button type="button" onClick={onUploadRequest} className="vi-logo-action-btn vi-logo-action-secondary" disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? (ar ? "جارٍ الرفع..." : "Uploading...") : (ar ? "ارفع شعار" : "Upload Logo")}
              </button>
              <input ref={inputRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="vi-hidden-file-input" onChange={(e) => onUploadLogo?.(e.target.files?.[0])} />
            </div>
          </div>
        )}
      </div>

      <label className="vi-brand-name-field">
        <span className="vi-brand-name-label">{ar ? "اسم العلامة" : "Brand name"}</span>
        <div className="vi-brand-name-row">
          <input
            value={brandName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={ar ? "اكتب اسم العلامة" : "Enter brand name"}
            className="vi-brand-name-input"
          />
          <button
            type="button"
            onClick={onSaveName}
            disabled={saving || !brandName?.trim()}
            className="vi-brand-name-save"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (ar ? "حفظ" : "Save")}
          </button>
        </div>
      </label>
    </section>
  );
}
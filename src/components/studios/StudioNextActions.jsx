import React from "react";
import { ArrowRight, ArrowLeft, Palette, LayoutTemplate, Image, Video, Presentation, BriefcaseBusiness, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { getNextStudioIds, buildStudioHandoffUrl, setStudioHandoff } from "@/services/projectContextService";
import { getStudioById } from "@/studios/studioRegistry";
import { exportImagePng, exportImagePdf, exportImageSvg, exportImagePptx, safeFilename } from "@/services/exportService";
import { runEyadEngine } from "@/services/eyadEngineService";
import "./StudioNextActions.css";

const ICONS = { "brand-kit": Palette, templates: LayoutTemplate, "ai-images": Image, video: Video, presentations: Presentation, "company-profile": BriefcaseBusiness };

export default function StudioNextActions({ projectId, fromStudio, asset = null, title, description, hideExports = false }) {
  const navigate = useNavigate();
  const { loc, direction } = useI18n();
  const ids = getNextStudioIds(fromStudio);
  const canExport = Boolean(asset?.url) && fromStudio !== "video";
  const exportFormats = fromStudio === "logo" ? [["png", "PNG"], ["pdf", "PDF"], ["svg", "SVG"]] : [["png", "PNG"], ["pdf", "PDF"], ["svg", "SVG"], ["pptx", "PPTX"]];
  const [exporting, setExporting] = React.useState("");
  const [activeFormat, setActiveFormat] = React.useState("");
  const [exportError, setExportError] = React.useState("");
  if (!ids.length && !canExport) return null;
  const ar = direction === "rtl";
  const handleExport = async (format) => {
    if (!asset?.url || exporting) return;
    setExporting(format);
    setActiveFormat(format);
    setExportError("");
    try {
      const base = safeFilename(asset?.name || fromStudio || "eyad-export");
      if (format === "png") await exportImagePng(asset.url, base + ".png");
      if (format === "pdf") await exportImagePdf(asset.url, base + ".pdf");
      if (format === "svg") {
        let svgUrl = asset?.svg_url || asset?.svgUrl || null;
        if (!svgUrl && fromStudio === "logo") {
          const sourceAssetId = asset?.id || asset?.asset_id;
          if (!projectId || !sourceAssetId) throw new Error("SVG_SOURCE_MISSING");
          const result = await runEyadEngine({
            message: "Vectorize the approved logo asset into a production SVG only because the user requested an SVG download.",
            projectId,
            studioId: "logo",
            language: ar ? "ar" : "en",
            action: "vectorize_logo",
            designOptions: { selected_asset_id: sourceAssetId },
          });
          svgUrl = result?.svg_url || result?.asset?.svg_url || null;
          if (!svgUrl) throw new Error("SVG_VECTORIZE_FAILED");
        }
        await exportImageSvg(asset.url, base + ".svg", svgUrl);
      }
      if (format === "pptx") await exportImagePptx(asset.url, base + ".pptx", base);
    } catch {
      setExportError(loc({ ar: "تعذر إنشاء الملف. حاول مرة أخرى.", en: "Could not create the file. Please try again." }));
    } finally {
      setExporting("");
    }
  };
  const handleNext = async (toStudio) => {
    if (projectId) {
      try {
        await setStudioHandoff(projectId, {
          fromStudio,
          toStudio,
          asset,
          intent: "continue",
          metadata: { source: "studio-next-actions" },
        });
      } catch {}
    }
    navigate(buildStudioHandoffUrl(toStudio, projectId, {
      from: fromStudio,
      assetId: asset?.id,
      intent: "continue",
    }));
  };
  return (
    <section className="studio-next-actions" dir={direction}>
      <div className="studio-next-actions__head">
        <div>
          <span>{loc({ ar: "الخطوة التالية", en: "NEXT STEP" })}</span>
          <strong>{title || loc({ ar: "ماذا تريد أن تفعل الآن؟", en: "What do you want to do next?" })}</strong>
          {description && <small>{description}</small>}
        </div>
      </div>
      <div className="studio-next-actions__grid">
        {ids.map((id) => {
          const studio = getStudioById(id);
          if (!studio) return null;
          const Icon = ICONS[id] || LayoutTemplate;
          const label = fromStudio === "logo"
            ? (id === "brand-kit"
              ? loc({ ar: "حوّل الشعار إلى هوية بصرية", en: "Turn logo into visual identity" })
              : id === "presentations"
                ? loc({ ar: "حوّل الشعار إلى عرض تقديمي", en: "Turn logo into presentation" })
                : (ar ? studio.name.ar : studio.name.en))
            : (ar ? studio.name.ar : studio.name.en);
          return (
            <button key={id} type="button" onClick={() => handleNext(id)}>
              <Icon />
              <span>{label}</span>
              {ar ? <ArrowLeft /> : <ArrowRight />}
            </button>
          );
        })}
        {canExport && !hideExports && (
          <div className="studio-next-actions__exports">
            <div className="studio-next-actions__exports-title">{loc({ ar: "تصدير النتيجة", en: "Export result" })}</div>
            <div className="studio-next-actions__export-grid">
              {exportFormats.map(([format, label]) => (
                <button key={format} type="button" className={"studio-next-actions__export " + (activeFormat === format ? "is-active" : "")} onClick={() => handleExport(format)} disabled={Boolean(exporting)}>
                  {exporting === format ? <span className="studio-next-actions__spinner" /> : <Download />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {exportError && <small className="studio-next-actions__export-error">{exportError}</small>}
          </div>
        )}
      </div>
    </section>
  );
}

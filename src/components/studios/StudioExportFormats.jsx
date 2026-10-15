import React from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { exportImagePng, exportImagePdf, exportImageSvg, exportImagePptx, safeFilename } from "@/services/exportService";
import { runEyadEngine } from "@/services/eyadEngineService";

export default function StudioExportFormats({ projectId, fromStudio, asset = null, ar: arProp }) {
  const { loc, direction } = useI18n();
  const ar = typeof arProp === "boolean" ? arProp : direction === "rtl";
  const [exporting, setExporting] = React.useState("");
  const [activeFormat, setActiveFormat] = React.useState("");
  const [exportError, setExportError] = React.useState("");
  const canExport = Boolean(asset?.url) && fromStudio !== "video";
  if (!canExport) return null;

  const exportFormats = fromStudio === "logo"
    ? [["png", "PNG"], ["pdf", "PDF"], ["svg", "SVG"]]
    : [["png", "PNG"], ["pdf", "PDF"], ["svg", "SVG"], ["pptx", "PPTX"]];

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

  return (
    <div className="studio-next-actions__exports" dir={ar ? "rtl" : "ltr"}>
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
  );
}

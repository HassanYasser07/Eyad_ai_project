import React, { useState } from "react";
import { Download } from "lucide-react";
import { exportImagePng, exportImagePdf, exportImageSvg, exportImagePptx, safeFilename } from "@/services/exportService";

export default function ExportFormats({ sourceUrl, filenameBase = "eyad-export", trueSvgUrl = null, onPrepareSvg = null, ar = true, includePng = true }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [activeFormat, setActiveFormat] = useState("");
  if (!sourceUrl) return null;

  const run = async (format) => {
    if (busy) return;
    setBusy(format);
    setActiveFormat(format);
    setError("");
    try {
      const base = safeFilename(filenameBase);
      if (format === "png") await exportImagePng(sourceUrl, base + ".png");
      if (format === "pdf") await exportImagePdf(sourceUrl, base + ".pdf");
      if (format === "svg") {
        const preparedSvgUrl = trueSvgUrl || (onPrepareSvg ? await onPrepareSvg() : null);
        await exportImageSvg(sourceUrl, base + ".svg", preparedSvgUrl);
      }
      if (format === "pptx") await exportImagePptx(sourceUrl, base + ".pptx", base);
    } catch (caughtError) {
      const detail = caughtError instanceof Error ? caughtError.message : String(caughtError || "UNKNOWN_ERROR");
      console.error("[EYAD Export] failed", { format, filenameBase, detail, error: caughtError });
      setError(ar ? `خطأ ${format.toUpperCase()}: ${detail}` : `${format.toUpperCase()} error: ${detail}`);
    } finally {
      setBusy("");
    }
  };

  const formats = includePng ? [["png", "PNG"], ["pdf", "PDF"], ["svg", "SVG"], ["pptx", "PPTX"]] : [["pdf", "PDF"], ["svg", "SVG"], ["pptx", "PPTX"]];
  return (
    <div className="eyad-export-formats" dir={ar ? "rtl" : "ltr"}>
      <div className="eyad-export-title">{ar ? "تصدير النتيجة" : "Export result"}</div>
      <div className="eyad-export-grid">
        {formats.map(([format, label]) => (
          <button key={format} type="button" className={activeFormat === format ? "is-active" : ""} onClick={() => run(format)} disabled={Boolean(busy)}>
            {busy === format ? <span className="eyad-export-spinner" /> : <Download className="w-4 h-4" />}
            <span>{label}</span>
          </button>
        ))}
      </div>
      {error && <small className="eyad-export-error">{error}</small>}
    </div>
  );
}

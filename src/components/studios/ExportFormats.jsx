import React, { useState } from "react";
import { Download } from "lucide-react";
import { exportImagePng, exportImagePdf, safeFilename } from "@/services/exportService";

/**
 * Export buttons for a generated result. Only PNG and PDF are offered.
 *
 * `prepareSource` (optional) is an async function returning the exact image to
 * export — used by the Mockup studio to export the user's cropped version.
 */
export default function ExportFormats({ sourceUrl, filenameBase = "eyad-export", prepareSource = null, ar = true, includePng = true }) {
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
      const source = prepareSource ? await prepareSource() : sourceUrl;
      if (format === "png") await exportImagePng(source, base + ".png");
      if (format === "pdf") await exportImagePdf(source, base + ".pdf");
    } catch (caughtError) {
      const detail = caughtError instanceof Error ? caughtError.message : String(caughtError || "UNKNOWN_ERROR");
      console.error("[EYAD Export] failed", { format, filenameBase, detail, error: caughtError });
      setError(ar ? `خطأ ${format.toUpperCase()}: ${detail}` : `${format.toUpperCase()} error: ${detail}`);
    } finally {
      setBusy("");
    }
  };

  const formats = includePng ? [["png", "PNG"], ["pdf", "PDF"]] : [["pdf", "PDF"]];
  return (
    <div className="eyad-export-formats" dir={ar ? "rtl" : "ltr"}>
      <div className="eyad-export-title">{ar ? "تصدير النتيجة" : "Export result"}</div>
      <div className="eyad-export-grid eyad-export-grid--two">
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

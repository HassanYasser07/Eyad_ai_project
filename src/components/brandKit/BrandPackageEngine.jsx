import React, { useEffect, useMemo, useState } from "react";
import { Check, Download, FileText, Image as ImageIcon, Loader2, PackageCheck, Palette, Type } from "lucide-react";
import { projectService } from "@/services/projectService";
import { ensureRasterLogoUrl, isSvgSource } from "@/services/logoImageService";
import { runEyadEngine } from "@/services/eyadEngineService";
import { generateAndWait } from "@/services/generationWait";
import { buildBrandGuidelinesPdf } from "./brandProfilePdf";
import { detectSector } from "./brandProfileData";

function safeName(value) {
  return String(value || "brand")
    .trim()
    .replace(/[^\w؀-ۿ-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "brand";
}

function getMockupImageUrl(item) {
  return item?.previewUrl || item?.preview_url || item?.imageUrl || item?.image_url || item?.url || item?.asset_url || null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Fetches a remote image and returns it as a data URL (null on any failure). */
async function toDataUrl(url) {
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

export default function BrandPackageEngine({ brand, palette, background, arabicFont, englishFont, projectId, hasApprovedLogo, onRequireApprovedLogo, ar }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [resultNote, setResultNote] = useState("");

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setProject(null);
      return undefined;
    }
    projectService.get(projectId).then((p) => { if (active) setProject(p || null); }).catch(() => { if (active) setProject(null); });
    return () => { active = false; };
  }, [projectId]);

  const mockups = useMemo(() => {
    const saved = project?.project_data?.mockups;
    return Array.isArray(saved) ? saved : [];
  }, [project]);

  const activity = useMemo(
    () => String(project?.project_data?.logo_brief?.activity || "").trim(),
    [project],
  );

  const packageName = useMemo(() => safeName(brand?.brand_name || "EYAD-Brand"), [brand?.brand_name]);

  const createPackage = async () => {
    if (loading) return;
    if (!hasApprovedLogo) {
      onRequireApprovedLogo?.();
      return;
    }
    setLoading(true);
    setDownloaded(false);
    setResultNote("");
    let stage = ar ? "تهيئة الملف" : "Preparing";
    try {
      // 1) Logo as a raster data URL (SVG logos are rasterized first).
      stage = ar ? "تحميل الشعار" : "Loading the logo";
      setResultNote(ar ? "جارٍ تجهيز الشعار…" : "Preparing your logo…");
      const logoSource = isSvgSource(brand?.logo?.url, brand?.logo?.name || "")
        ? await ensureRasterLogoUrl(brand?.logo)
        : brand?.logo?.url;
      const logoDataUrl = await toDataUrl(logoSource);
      if (!logoDataUrl) throw new Error(ar ? "تعذر تحميل الشعار" : "The logo could not be loaded");

      // 2) Saved mockups (up to 6) become the "Applications" pages.
      stage = ar ? "تحميل التطبيقات" : "Loading applications";
      const mockupImages = [];
      for (const item of mockups.slice(-6)) {
        const dataUrl = await toDataUrl(getMockupImageUrl(item));
        if (dataUrl) mockupImages.push({ dataUrl, label: item?.name || "" });
      }

      // 3) Business-specific imagery (best effort, falls back to built-in artwork).
      stage = ar ? "توليد خلفيات العلامة" : "Creating brand imagery";
      setResultNote(ar ? "جارٍ إنشاء صور مناسبة لنشاطك…" : "Creating imagery that fits your business…");
      const sector = detectSector(activity, brand?.brand_name);
      const colors = {
        primary: palette?.primary, secondary: palette?.secondary, accent: palette?.accent, surface: palette?.surface,
      };
      const generate = async (page, extra) => {
        try {
          const result = await generateAndWait(runEyadEngine, {
            message: `Generate a cinematic landscape (16:9) background photograph for the brand guidelines of "${brand?.brand_name || "the brand"}"${activity ? `, a ${activity} business` : ""}. Scene: ${sector.scene}. ${extra} Colour grading harmonised with ${colors.primary}, ${colors.secondary} and ${colors.accent}. Absolutely no text, no logos, no watermarks, no close-up faces.`,
            projectId,
            studioId: "brand-kit",
            language: ar ? "ar" : "en",
            designOptions: {
              brand_profile_page: page,
              brand_profile_name: brand?.brand_name || "",
              brand_profile_activity: activity,
              brand_profile_scene: sector.scene,
              brand_profile_palette: colors,
              aspect_ratio: "16:9",
            },
          });
          const url = result?.image?.url || result?.image?.data_url || result?.images?.[0]?.url || result?.images?.[0]?.data_url || result?.asset?.asset_url || null;
          return await toDataUrl(url);
        } catch (error) {
          console.warn("[EYAD Brand Package] AI imagery unavailable; using built-in artwork.", error);
          return null;
        }
      };
      const [heroImage, lifestyleImage] = await Promise.all([
        generate(1, "Hero image: wide, atmospheric, with calm space in the centre for a logo."),
        generate(2, "Secondary image: a detail or texture shot related to the business, slightly abstract."),
      ]);

      // 4) Compose the PDF.
      stage = ar ? "إنشاء ملف PDF" : "Building the PDF";
      const info = project?.project_data?.mockup_business_info || {};
      const blob = await buildBrandGuidelinesPdf({
        brand,
        palette,
        arabicFont,
        englishFont,
        logoDataUrl,
        mockupImages,
        heroImage,
        lifestyleImage,
        activity,
        businessInfo: info,
        ar,
        onProgress: (page, total) => setResultNote(ar ? `جارٍ تصميم الصفحات… ${page}/${total}` : `Designing pages… ${page}/${total}`),
      });

      stage = ar ? "بدء التنزيل" : "Starting download";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${packageName}-Brand-Package.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);

      setResultNote(ar ? "تم إنشاء دليل الهوية PDF" : "Brand package PDF created");
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 2400);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error || "UNKNOWN_ERROR");
      console.error("[EYAD Brand Package] failed", { stage, detail, error });
      setResultNote((ar ? "فشل عند: " : "Failed at: ") + stage + " — " + detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="vi-section brand-package-engine">
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon"><PackageCheck className="w-4 h-4" /></span>
          <h2>{ar ? "حزمة الهوية" : "Brand Package"}</h2>
        </div>
        <span className="vi-section-hint">{ar ? "دليل الهوية في ملف PDF واحد" : "Your brand guidelines in one PDF"}</span>
      </div>

      <div className="brand-package-summary">
        <div className="brand-package-icon"><FileText className="w-5 h-5" /></div>
        <div>
          <strong>{brand?.brand_name || (ar ? "اسم العلامة" : "Brand Name")}</strong>
          <span>{ar ? "الشعار • الألوان • الخطوط • التطبيقات • قواعد الاستخدام" : "Logo • Colors • Typography • Applications • Usage rules"}</span>
        </div>
      </div>

      <div className="brand-package-files">
        <div><ImageIcon className="w-4 h-4" /><span>{ar ? "الشعار ومساحة الأمان" : "Logo & clear space"}</span></div>
        <div><Palette className="w-4 h-4" /><span>{ar ? "الألوان HEX / RGB / CMYK" : "Colors HEX / RGB / CMYK"}</span></div>
        <div><Type className="w-4 h-4" /><span>{ar ? "نظام الخطوط" : "Typography system"}</span></div>
        <div><FileText className="w-4 h-4" /><span>{mockups.length} {ar ? "تطبيقات محفوظة" : "saved applications"}</span></div>
      </div>

      <button type="button" className="vi-apply-btn brand-package-download" onClick={createPackage} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        {loading ? (ar ? "جارٍ تجهيز الدليل…" : "Building PDF…") : downloaded ? (ar ? "تم التنزيل" : "Downloaded") : (ar ? "تحميل Brand Package (PDF)" : "Download Brand Package (PDF)")}
      </button>

      {resultNote && <p className="brand-package-note">{resultNote}</p>}
    </section>
  );
}

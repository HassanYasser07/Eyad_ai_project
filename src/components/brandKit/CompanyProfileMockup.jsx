/**
 * EYAD AI — Company Profile Mockup
 *
 * The Company Profile counterpart of <MockupEngine /> (Visual Identity → Mockup), with the exact same
 * functionality and flow:
 *   launcher card → gallery of visual mockups → business details form → AI generation (approved logo +
 *   brand colors) → result with crop, PDF download, export formats and "Approve & Save".
 *
 * It only differs in the gallery: the 7 company-profile booklet mockups (covers, rolled booklet, page flip,
 * inner spreads…). Generation, polling, the saved business details (project_data.mockup_business_info) and the
 * saved mockups list (project_data.mockups, through `onSave`) are shared with the Visual Identity Mockup section.
 *
 * Like the business card, a company-profile mockup is generated as one finished artwork by the image model
 * (logo + brand colors + business details), so no text box is composited on top of the generated image.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, FileText, Layers3, NotebookPen, Package, ReceiptText, X,
  ArrowLeft, ArrowRight, Mail, Phone, MapPin, Globe2, Instagram, Printer, Download, Loader2, Save, BriefcaseBusiness,
} from "lucide-react";
import { projectService } from "@/services/projectService";
import { runEyadEngine } from "@/services/eyadEngineService";
import { jobService } from "@/services/jobService";
import { assetService } from "@/services/assetService";
import { useAuth } from "@/lib/AuthContext";
import { COMPANY_PROFILE_MOCKUP_IMAGES } from "./companyProfileMockupImages";
import { COMPANY_PROFILE_MOCKUP_HERO_IMAGE } from "./companyProfileMockupHeroImage";
import ExportFormats from "@/components/studios/ExportFormats";
import ImageCropper, { cropImageSource } from "./ImageCropper";
import { exportImagePdf, safeFilename } from "@/services/exportService";
import { ensureRasterLogoUrl } from "@/services/logoImageService";

/**
 * `scene` is the English art direction sent to the image model with the request (and as
 * design_options.mockup_prompt) so every variant renders the same composition as its gallery image.
 */
const COMPANY_PROFILE_MOCKUP_TYPES = [
  {
    id: "cp-cover-stack", ar: "ستاك أغلفة البروفايل", en: "Cover Stack", icon: Layers3,
    scene: "Three landscape company-profile booklets fanned in a slightly offset stack, seen from a high three-quarter angle, front covers facing the camera.",
  },
  {
    id: "cp-cover-spread", ar: "الغلاف الأمامي والخلفي", en: "Front & Back Cover", icon: BookOpen,
    scene: "A landscape company-profile booklet opened flat so the back cover and the front cover are both visible, spine slightly lifted, shot from a high angle.",
  },
  {
    id: "cp-rolled", ar: "بروفايل ملفوف", en: "Rolled Booklet", icon: NotebookPen,
    scene: "A landscape company-profile booklet lying open with its left half rolled up into a tight curl, revealing a full inner page, shot from a high angle.",
  },
  {
    id: "cp-flip-pages", ar: "تقليب الصفحات", en: "Page Flip", icon: FileText,
    scene: "A landscape company-profile booklet standing open with its upper pages bending upward in a smooth mid-flip curve, showing two inner spreads, soft long shadow.",
  },
  {
    id: "cp-spread-services", ar: "صفحات داخلية — الخدمات", en: "Inner Spread · Services", icon: ReceiptText,
    scene: "A landscape company-profile booklet opened flat on a table, a clean double-page spread of services and project management pages with icons and photos, one page corner lightly lifted.",
  },
  {
    id: "cp-stack-dark", ar: "نسخ مكدّسة", en: "Stacked Copies", icon: Package,
    scene: "Three landscape company-profile booklets stacked neatly on top of each other with a slight offset, seen from above at an angle, showing the cover and the thick page edges.",
  },
  {
    id: "cp-spread-vision", ar: "صفحات داخلية — الرؤية", en: "Inner Spread · Vision", icon: BookOpen,
    scene: "A landscape company-profile booklet opened flat, a double-page spread of vision, mission and values and an architectural design page, front-on view with a slightly lifted page corner.",
  },
];

const EMPTY_INFO = {
  companyName: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  instagram: "",
};

function Field({ icon: Icon, label, value, onChange, type = "text", dir }) {
  return (
    <label className="mockup-form-field">
      <span><Icon className="w-3.5 h-3.5" />{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} />
    </label>
  );
}

export default function CompanyProfileMockup({ brand, palette, background, projectId, onSave, ar, hasApprovedLogo, onRequireApprovedLogo }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("gallery");
  const [businessInfo, setBusinessInfo] = useState(EMPTY_INFO);
  const [profileInfo, setProfileInfo] = useState({});
  const [saved, setSaved] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generationError, setGenerationError] = useState("");
  const [crop, setCrop] = useState({ rect: null, natural: { w: 0, h: 0 }, active: false });
  const [creatingPdf, setCreatingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const { isAnonymous, requireAccount } = useAuth();

  const MOCKUP_MAX_WAIT_MS = 240000;
  const MOCKUP_POLL_MS = 2000;

  useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    setLoadingInfo(true);
    projectService.get(projectId)
      .then((project) => {
        if (!active) return;
        const data = project?.project_data || {};
        const savedInfo = data.mockup_business_info || {};
        const profile = data.company_profile || {};
        setProfileInfo(profile);
        // Contact details already entered for the company profile are reused when the mockup
        // details have not been filled yet, so the user never types them twice.
        setBusinessInfo({
          ...EMPTY_INFO,
          phone: profile.phone || "",
          email: profile.email || "",
          address: profile.address || "",
          website: profile.website || "",
          instagram: profile.instagram || "",
          ...Object.fromEntries(Object.entries(savedInfo).filter(([, value]) => String(value || "").trim())),
          // The saved Brand Source of Truth always wins for the business name.
          companyName: brand?.brand_name || savedInfo.companyName || profile.companyName || "",
        });
      })
      .catch(() => {})
      .finally(() => active && setLoadingInfo(false));
    return () => { active = false; };
  }, [projectId, brand?.brand_name]);

  const current = useMemo(
    () => COMPANY_PROFILE_MOCKUP_TYPES.find((item) => item.id === selected) || COMPANY_PROFILE_MOCKUP_TYPES[0],
    [selected]
  );

  const openGallery = () => {
    if (!hasApprovedLogo) {
      onRequireApprovedLogo?.();
      return;
    }
    setGalleryOpen(true);
    setStep("gallery");
    setSelected(null);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
    setStep("gallery");
    setSelected(null);
  };

  const chooseMockup = (id) => {
    if (!hasApprovedLogo) {
      onRequireApprovedLogo?.();
      return;
    }
    setSelected(id);
    setPdfError("");
    setGeneratedImage(null);
    setGenerationError("");
    setBusinessInfo((prev) => ({ ...prev, companyName: prev.companyName || brand?.brand_name || "" }));
    setStep("form");
  };

  const continueToPreview = async () => {
    if (projectId) {
      try {
        const project = await projectService.get(projectId);
        await projectService.update(projectId, {
          project_data: {
            ...(project?.project_data || {}),
            mockup_business_info: { ...businessInfo },
          },
        });
      } catch {}
    }
    generateMockup(selected);
  };

  const backToGallery = () => {
    setStep("gallery");
    setSelected(null);
    setGeneratedImage(null);
    setJobId(null);
    setGenerating(false);
    setGenerationError("");
  };

  async function generateMockup(mockupId = selected) {
    if (!mockupId || generating) return;
    if (isAnonymous) {
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    setSelected(mockupId);
    setGenerating(true);
    setGenerationError("");
    setGeneratedImage(null);
    setStep("generating");
    try {
      const type = COMPANY_PROFILE_MOCKUP_TYPES.find((item) => item.id === mockupId);
      // The image model only accepts raster images. SVG logos are converted to a
      // transparent PNG here so they behave exactly like PNG logos.
      const logoForGeneration = (await ensureRasterLogoUrl(brand?.logo)) || null;
      const baseMessage = ar
        ? `أنشئ موك أب واقعي احترافي لبروفايل شركة مطبوع (${type?.ar || "بروفايل الشركة"}) باستخدام الشعار المعتمد.`
        : `Create a photorealistic professional printed company profile booklet mockup (${type?.en || "company profile"}) using the approved logo.`;
      const data = await runEyadEngine({
        message: `${baseMessage} ${type?.scene || ""}`.trim(),
        projectId: projectId || null,
        studioId: "ai-images",
        language: ar ? "ar" : "en",
        action: "generate",
        referenceImage: logoForGeneration,
        designOptions: {
          mockup_type: mockupId,
          mockup_family: "company-profile",
          mockup_name: `Company Profile — ${type?.en || mockupId}`,
          mockup_prompt: type?.scene || "",
          approved_logo_url: logoForGeneration,
          brand_name: brand?.brand_name || businessInfo.companyName || "",
          palette,
          background,
          business_info: businessInfo,
          company_profile: {
            companyName: profileInfo?.companyName || businessInfo.companyName || "",
            tagline: profileInfo?.tagline || "",
            industry: profileInfo?.industry || "",
          },
        },
      });
      if (data?.project?.id && !projectId) {
        window.history.replaceState({}, "", `${window.location.pathname}?project=${encodeURIComponent(data.project.id)}`);
      }
      if (data?.status === "generated") {
        const resultImage = data?.images?.[0] || data?.image || null;
        setGeneratedImage(resultImage);
        setStep("result");
        setGenerating(false);
        return;
      }
      if (data?.job_id) {
        setJobId(data.job_id);
        return;
      }
      throw new Error(data?.error || "GENERATION_NOT_STARTED");
    } catch (error) {
      setGenerating(false);
      setGenerationError(error?.message || "GENERATION_FAILED");
      setStep("result");
    }
  }

  useEffect(() => {
    if (!jobId || !generating) return undefined;
    let active = true;
    const startedAt = Date.now();

    const poll = async () => {
      if (!active) return;
      try {
        const data = await jobService.pollGeneration(jobId);
        if (!active) return;
        if (data?.status === "generated") {
          const resultImage = data?.images?.[0] || data?.image || null;
          setGeneratedImage(resultImage);
          setGenerating(false);
          setStep("result");
          setJobId(null);
          return;
        }
        if (data?.error || data?.status === "failed") {
          const raw = String(data?.detail || data?.error || "GENERATION_FAILED");
          const friendly = raw === "MOCKUP_GENERATION_TIMEOUT"
            ? (ar ? "التوليد تجاوز الوقت المسموح. تم إيقاف العملية بدون انتظار إضافي." : "Mockup generation exceeded the safe time limit and was stopped.")
            : raw === "OPENAI_RESPONSE_POLL_FAILED"
              ? (ar ? "تعذر متابعة نتيجة التوليد من مزود الصور." : "The image provider could not be reached while checking the result.")
              : raw;
          setGenerationError(friendly);
          setGenerating(false);
          setStep("result");
          setJobId(null);
          return;
        }
      } catch {
        // Transient polling/network errors do not fail the generation. The
        // durable backend job remains authoritative and the next poll retries.
      }

      if (Date.now() - startedAt >= MOCKUP_MAX_WAIT_MS && active) {
        setGenerationError(ar ? "التوليد استغرق وقتًا أطول من المتوقع وتم إيقاف الانتظار." : "Generation took longer than expected and the wait was stopped.");
        setGenerating(false);
        setStep("result");
        setJobId(null);
      }
    };

    poll();
    const timer = window.setInterval(poll, MOCKUP_POLL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, generating, ar]);

  const save = async () => {
    const sourceImage = generatedImage?.data_url || generatedImage?.url;
    if (!sourceImage) return;
    let imageUrl = sourceImage;
    let assetId = generatedImage?.asset_id || null;
    if (sourceImage.startsWith("data:")) {
      try {
        const blob = await (await fetch(sourceImage)).blob();
        const uploaded = await assetService.uploadImageAsset({
          projectId,
          file: blob,
          name: `${selected}-company-profile-mockup.png`,
          metadata: {
            source: "company-profile-mockup",
            mockup_type: selected,
            business_info: { ...businessInfo },
            source_generated_asset_id: generatedImage?.asset_id || null,
          },
        });
        imageUrl = uploaded.url;
        assetId = uploaded.id;
      } catch (error) {
        console.error("Company profile mockup asset upload failed", error);
      }
    }
    const item = {
      id: `${selected}-${Date.now()}`,
      type: selected,
      imageUrl,
      assetId,
      businessInfo,
      createdAt: new Date().toISOString(),
      brandName: businessInfo.companyName || brand?.brand_name || "",
      generation: "openai-gpt-image-2",
    };
    await onSave?.(item);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const updateInfo = (key, value) => {
    // Company/business name is owned by Brand Source of Truth.
    if (key === "companyName") return;
    setBusinessInfo((prev) => ({ ...prev, [key]: value }));
  };

  // The image the user wants to export: the crop (if any) of the generated mockup.
  const exportSourceUrl = generatedImage?.data_url || generatedImage?.url || null;
  const handleCropChange = useCallback((next) => setCrop(next), []);

  const prepareExportSource = async () => {
    if (!exportSourceUrl) throw new Error("EXPORT_SOURCE_MISSING");
    return crop.active && crop.rect ? cropImageSource(exportSourceUrl, crop.rect) : exportSourceUrl;
  };

  // Main download button — identical to the bottom "PDF" button (same exporter,
  // same file name, same cropped source).
  const downloadPdf = async () => {
    if (!exportSourceUrl || creatingPdf) return;
    setCreatingPdf(true);
    setPdfError("");
    try {
      const source = await prepareExportSource();
      await exportImagePdf(source, safeFilename("eyad-" + selected + "-mockup") + ".pdf");
    } catch (error) {
      console.error("EYAD company profile mockup PDF export failed", error);
      const detail = error instanceof Error ? error.message : String(error || "UNKNOWN_ERROR");
      setPdfError(ar ? `خطأ PDF: ${detail}` : `PDF error: ${detail}`);
    } finally {
      setCreatingPdf(false);
    }
  };

  const count = COMPANY_PROFILE_MOCKUP_TYPES.length;

  const modal = galleryOpen && (
    <div className="mockup-modal-backdrop" role="dialog" aria-modal="true">
      <div className={`mockup-modal ${step === "gallery" ? "is-gallery" : ""}`}>
        <div className="mockup-modal-head">
          <div>
            <strong>
              {step === "gallery"
                ? (ar ? "موك أب بروفايل الشركة" : "Company Profile Mockup")
                : step === "form"
                  ? (ar ? `بيانات ${current.ar}` : `${current.en} Details`)
                  : (ar ? current.ar : current.en)}
            </strong>
            <span>
              {step === "gallery"
                ? (ar ? "اختر موك أب بصريًا" : "Choose a visual mockup")
                : step === "form"
                  ? (ar ? "هذه البيانات ستظهر داخل الـ Mockup" : "These details will appear inside the mockup")
                  : (ar ? "معاينة حقيقية ببيانات نشاطك" : "Live preview with your business data")}
            </span>
          </div>
          <button type="button" className="mockup-modal-close" onClick={closeGallery} aria-label="Close"><X /></button>
        </div>

        {step === "gallery" && (
          <div className="mockup-gallery">
            {COMPANY_PROFILE_MOCKUP_TYPES.map((item) => (
              <button key={item.id} type="button" className="mockup-gallery-card" onClick={() => chooseMockup(item.id)}>
                <div className="mockup-gallery-thumb">
                  <img
                    src={COMPANY_PROFILE_MOCKUP_IMAGES[item.id]}
                    alt={ar ? item.ar : item.en}
                    className="mockup-gallery-image"
                    loading="lazy"
                  />
                </div>
                <div className="mockup-gallery-label">
                  <span>{ar ? item.ar : item.en}</span>
                  <item.icon className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "form" && (
          <div className="mockup-form-view">
            <div className="mockup-form-intro">
              <div className="mockup-form-preview mockup-business-details-logo">
                <img
                  src={COMPANY_PROFILE_MOCKUP_IMAGES[current.id]}
                  alt={ar ? current.ar : current.en}
                  className="mockup-business-details-logo-img"
                />
                {brand?.logo?.url && (
                  <img
                    src={brand.logo.url}
                    alt={brand?.brand_name || "Approved logo"}
                    className="mockup-business-details-logo-overlay"
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                  />
                )}
              </div>
              <div>
                <strong>{ar ? "بيانات النشاط" : "Business details"}</strong>
                <span>{ar ? "أدخل البيانات مرة واحدة، وسيحتفظ بها المشروع لاستخدامها في التطبيقات التالية." : "Enter them once. The project keeps them for the next applications."}</span>
              </div>
            </div>

            {loadingInfo && <div className="mockup-form-loading">{ar ? "جاري تحميل بيانات النشاط..." : "Loading saved business details..."}</div>}

            <div className="mockup-form-grid">
              <Field icon={BriefcaseBusiness} label={ar ? "اسم الشركة / النشاط" : "Company / Business name"} value={brand?.brand_name || businessInfo.companyName} onChange={() => {}} dir={ar ? "rtl" : "ltr"} />
              <Field icon={Phone} label={ar ? "رقم الهاتف" : "Phone"} value={businessInfo.phone} onChange={(v) => updateInfo("phone", v)} type="tel" dir="ltr" />
              <Field icon={Mail} label={ar ? "البريد الإلكتروني" : "Email"} value={businessInfo.email} onChange={(v) => updateInfo("email", v)} type="email" dir="ltr" />
              <Field icon={MapPin} label={ar ? "العنوان" : "Address"} value={businessInfo.address} onChange={(v) => updateInfo("address", v)} dir={ar ? "rtl" : "ltr"} />
              <Field icon={Globe2} label={ar ? "الموقع الإلكتروني" : "Website"} value={businessInfo.website} onChange={(v) => updateInfo("website", v)} dir="ltr" />
              <Field icon={Instagram} label={ar ? "حساب إنستغرام" : "Instagram"} value={businessInfo.instagram} onChange={(v) => updateInfo("instagram", v)} dir="ltr" />
            </div>

            <div className="mockup-form-actions">
              <button type="button" className="mockup-secondary-btn" onClick={backToGallery}>
                <ArrowRight className="w-4 h-4" /> {ar ? "رجوع للتطبيقات" : "Back to applications"}
              </button>
              <button type="button" className="vi-apply-btn" onClick={continueToPreview}>
                {ar ? "معاينة الـ Mockup" : "Preview Mockup"} <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="mockup-ai-state">
            <div className="mockup-ai-orb"><span /><span /><span /><span /><span /></div>
            <strong>{ar ? "إياد بيجهز الموك أب" : "EYAD is generating the mockup"}</strong>
            <span>{ar ? "يتم تركيب الشعار المعتمد على المنتج بشكل واقعي وإخراج صورة عالية الجودة." : "Applying the approved logo realistically and creating a high-quality image."}</span>
            <div className="mockup-ai-progress"><i /></div>
          </div>
        )}

        {step === "result" && (
          <div className="mockup-ai-result">
            {generationError ? (
              <div className="mockup-ai-error">
                <strong>{ar ? "تعذر إنشاء الموك أب" : "Mockup generation failed"}</strong>
                <span>{generationError}</span>
                <button type="button" className="vi-apply-btn" onClick={() => generateMockup(selected)}>{ar ? "إعادة التوليد" : "Generate again"}</button>
              </div>
            ) : generatedImage ? (
              <>
                <ImageCropper
                  src={exportSourceUrl}
                  alt={ar ? current.ar : current.en}
                  ar={ar}
                  onChange={handleCropChange}
                />

                <div className="mockup-ai-result-copy">
                  <strong>{ar ? `موك أب ${current.ar} جاهز` : `${current.en} mockup is ready`}</strong>
                  <span>{ar ? "EYAD يستخدم الشعار المعتمد وبيانات نشاطك لإنشاء موك أب احترافي وواقعي." : "EYAD uses your approved logo and business data to create a professional, photorealistic mockup."}</span>
                </div>

                <section className="mockup-print-file-panel" aria-label={ar ? "تنزيل الموك أب" : "Download mockup"}>
                  <div className="mockup-print-file-head">
                    <Printer size={22} color="#2875d0" />
                    <div>
                      <strong>{ar ? "تنزيل الموك أب" : "Download mockup"}</strong>
                      <span>
                        {crop.active
                          ? (ar ? "سيتم تنزيل الجزء المحدد داخل إطار القص فقط." : "Only the area inside the crop frame will be downloaded.")
                          : (ar ? "سيتم تنزيل الصورة كاملة. استخدم أداة القص أعلاه لاقتصاص جزء منها." : "The full image will be downloaded. Use the crop tool above to clip part of it.")}
                      </span>
                    </div>
                  </div>
                  {pdfError && <p role="alert" className="mockup-print-file-error">{pdfError}</p>}
                  <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={creatingPdf}
                    className="vi-apply-btn mockup-print-file-btn"
                  >
                    {creatingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    {creatingPdf ? (ar ? "جاري إنشاء ملف PDF..." : "Creating PDF...") : (ar ? "تنزيل PDF" : "Download PDF")}
                  </button>
                </section>

                <div className="mockup-form-actions">
                  <button type="button" className="mockup-secondary-btn" onClick={backToGallery}><ArrowRight className="w-4 h-4" /> {ar ? "اختيار موك أب آخر" : "Choose another"}</button>
                  <div className="mockup-actions">
                    <button type="button" className="vi-apply-btn mockup-save-btn" onClick={save}><Save className="w-4 h-4" /> {saved ? (ar ? "تم الحفظ" : "Saved") : (ar ? "اعتماد وحفظ" : "Approve & Save")}</button>
                    <div className="mockup-export-holder">
                      <ExportFormats
                        sourceUrl={exportSourceUrl}
                        prepareSource={prepareExportSource}
                        filenameBase={"eyad-" + selected + "-mockup"}
                        ar={ar}
                        includePng={true}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="cp-mockup">
        <button type="button" className="mockup-launch-card" onClick={openGallery}>
          <img
            className="mockup-launch-hero-image"
            src={COMPANY_PROFILE_MOCKUP_HERO_IMAGE}
            alt={ar ? "موك أب بروفايل الشركة" : "Company profile mockup"}
          />
          <div className="mockup-launch-overlay" />
          <div className="mockup-launch-copy">
            <div className="mockup-launch-top-badge"><Layers3 /> <span>{ar ? "موك أب" : "Mockup"}</span></div>
            <strong>{ar ? "موك أب بروفايل الشركة" : "Company Profile Mockup"}</strong>
            <span className="mockup-launch-description">
              {ar ? "اعرض بروفايل شركتك المطبوع بشكل احترافي واختر الزاوية المناسبة" : "Present your printed company profile professionally and pick the right angle"}
            </span>
            <span className="mockup-launch-action"><ArrowLeft /></span>
            <div className="mockup-launch-bottom-badge">
              <Layers3 />
              <div><strong>{ar ? `${count} موك أب جاهز` : `${count} READY MOCKUPS`}</strong><span>{ar ? "لعرض بروفايل شركتك بشكل احترافي" : "Present your company profile professionally"}</span></div>
            </div>
          </div>
        </button>

        <p className="mockup-note">
          {ar
            ? "اختر نوع العرض أولًا، ثم أدخل بيانات الشركة قبل إنشاء الموك أب. الـ Mockup للعرض والتقديم فقط."
            : "Choose the view first, then enter company details before creating the mockup. Mockups are presentation-only."}
        </p>
      </div>

      {/* Rendered in a portal: the Company Profile section is a glass card (backdrop-filter), which would
          otherwise turn this full-screen dialog into a dialog positioned inside the card. */}
      {modal && createPortal(modal, document.body)}
    </>
  );
}

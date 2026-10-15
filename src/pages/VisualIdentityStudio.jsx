/**
 * EYAD AI — Visual Identity Studio (Phase 1)
 *
 * The foundation for building a complete brand visual identity.
 * - Receives the approved logo from Logo Studio / EYAD Chat automatically.
 * - Manages a Brand Source of Truth (logo, brand name, palette, typography).
 * - Live Brand Preview (sticky) updates instantly from local preview state.
 * - Color Palettes and Typography sections let users try and Apply changes.
 *
 * Architecture is prepared for future Mockup Engine / Print Production Engine
 * without rebuilding the Brand Source of Truth.
 */
import React from "react";
import { ArrowLeft, Palette, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { useBrandState } from "@/hooks/useBrandState";
import { projectService } from "@/services/projectService";
import { COLOR_PALETTES, ARABIC_FONTS, ENGLISH_FONTS, BACKGROUNDS } from "@/studios/brandKit/presets";
import LiveBrandPreview from "@/components/brandKit/LiveBrandPreview";
import BrandLogoSection from "@/components/brandKit/BrandLogoSection";
import ColorPalettesSection from "@/components/brandKit/ColorPalettesSection";
import TypographySection from "@/components/brandKit/TypographySection";
import BackgroundsSection from "@/components/brandKit/BackgroundsSection";
import MockupEngine from "@/components/brandKit/MockupEngine";
import ProductionEngine from "@/components/brandKit/ProductionEngine";
import BrandPackageEngine from "@/components/brandKit/BrandPackageEngine";
import StudioNextActions from "@/components/studios/StudioNextActions";
import "./visualIdentityStudio.css";

export default function VisualIdentityStudio() {
  const { direction } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [logoAttention, setLogoAttention] = React.useState(false);
  const projectId = searchParams.get("project");
  const assetId = searchParams.get("asset");
  const ar = direction === "rtl";

  const {
    brand,
    loading,
    hasApprovedLogo,
    approvedAssetId,
    saving,
    uploading,
    activePalette,
    activeArabicFont,
    activeEnglishFont,
    activeBackground,
    activeBackgroundOpacity,
    isPaletteDirty,
    isTypographyDirty,
    isBackgroundDirty,
    setPreviewPalette,
    setPreviewBackgroundOpacity,
    setPreviewArabicFont,
    setPreviewEnglishFont,
    setPreviewBackground,
    applyPalette,
    applyTypography,
    applyBackground,
    setBrandName,
    saveBrandName,
    uploadLogo,
  } = useBrandState({ projectId, initialAssetId: assetId });

  const guard = (fn) => (...args) => {
    if (isAnonymous) {
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    fn(...args);
  };

  const handleUploadRequest = (openPicker) => {
    if (isAnonymous) {
      // Authenticate BEFORE opening the file picker. A File object selected before
      // navigation is discarded by the browser when the login page replaces it.
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    openPicker?.();
  };

  const handleUploadLogo = async (file) => {
    const result = await uploadLogo(file);
    if (result?.projectId && result.projectId !== projectId) {
      navigate(`/studios/brand-kit?project=${encodeURIComponent(result.projectId)}&asset=${encodeURIComponent(result.id)}`, { replace: true });
    }
  };

  const back = () => navigate("/studios");

  const saveMockup = async (mockup) => {
    if (isAnonymous || !projectId) {
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    const project = await projectService.get(projectId);
    const current = project?.project_data || {};
    const existing = Array.isArray(current.mockups) ? current.mockups : [];
    await projectService.update(projectId, {
      project_data: {
        ...current,
        mockups: [...existing, mockup].slice(-24),
        mockup_business_info: mockup?.businessInfo || current.mockup_business_info || {},
      },
    });
  };

  if (loading) {
    return (
      <div className="vi-studio vi-studio--loading">
        <div className="vi-spinner" />
      </div>
    );
  }

  const hasProject = Boolean(projectId);

  return (
    <div className="vi-studio">
      <header className="vi-header">
        <button type="button" onClick={back} className="vi-back-btn">
          <ArrowLeft className="w-4 h-4" />
          {ar ? "الاستوديوهات" : "Studios"}
        </button>
        <div className="vi-studio-badge">
          <Palette className="w-3.5 h-3.5" />
          <span>{ar ? "ستوديو الهوية البصرية" : "Visual Identity Studio"}</span>
        </div>
      </header>

      {/* Sticky Live Brand Preview */}
      <div className="vi-sticky-preview">
        <LiveBrandPreview
          brand={brand}
          palette={activePalette}
          background={activeBackground}
          backgroundOpacity={activeBackgroundOpacity}
          onBackgroundOpacityChange={setPreviewBackgroundOpacity}
          arabicFont={activeArabicFont}
          englishFont={activeEnglishFont}
          ar={ar}
          dirty={isPaletteDirty || isTypographyDirty || isBackgroundDirty}
        />
      </div>

      {/* Scrollable Brand Foundation sections */}
      <div className="vi-content">
        {!hasProject && (
          <div className="vi-no-project-hint">
            <Sparkles className="w-4 h-4" />
            <span>
              {ar
                ? "تتصفح الاستوديو بدون مشروع. التغييرات تجريبية — سجّل الدخول وأنشئ مشروعًا لحفظ الهوية."
                : "You're exploring without a project. Changes are trial-only — sign in and create a project to save the identity."}
            </span>
          </div>
        )}

        <BrandLogoSection
          logo={brand?.logo}
          hasApprovedLogo={hasApprovedLogo}
          attention={logoAttention}
          brandName={brand?.brand_name || ""}
          onNameChange={setBrandName}
          onSaveName={guard(saveBrandName)}
          onUploadLogo={handleUploadLogo}
          onUploadRequest={() => handleUploadRequest(() => document.querySelector(".vi-hidden-file-input")?.click())}
          saving={saving}
          uploading={uploading}
          projectId={projectId}
          ar={ar}
        />

        <ColorPalettesSection
          palettes={COLOR_PALETTES}
          savedPaletteId={brand?.palette?.id}
          currentPaletteId={activePalette.id}
          onSelect={setPreviewPalette}
          onApply={guard(applyPalette)}
          dirty={isPaletteDirty}
          saving={saving}
          ar={ar}
        />

        <TypographySection
          arabicFonts={ARABIC_FONTS}
          englishFonts={ENGLISH_FONTS}
          savedArabicFontId={brand?.typography?.arabic?.id}
          savedEnglishFontId={brand?.typography?.english?.id}
          currentArabicFontId={activeArabicFont.id}
          currentEnglishFontId={activeEnglishFont.id}
          onSelectArabic={setPreviewArabicFont}
          onSelectEnglish={setPreviewEnglishFont}
          onApply={guard(applyTypography)}
          dirty={isTypographyDirty}
          saving={saving}
          ar={ar}
        />

        <BackgroundsSection
          backgrounds={BACKGROUNDS}
          savedBackgroundId={brand?.background?.id}
          currentBackgroundId={activeBackground.id}
          onSelect={setPreviewBackground}
          onApply={guard(applyBackground)}
          dirty={isBackgroundDirty}
          saving={saving}
          ar={ar}
        />

        <MockupEngine
          brand={brand}
          hasApprovedLogo={hasApprovedLogo}
          onRequireApprovedLogo={() => {
            setLogoAttention(true);
            window.setTimeout(() => document.querySelector(".vi-logo-section")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
            window.setTimeout(() => setLogoAttention(false), 6000);
          }}
          palette={activePalette}
          background={activeBackground}
          projectId={projectId}
          onSave={saveMockup}
          ar={ar}
        />

        <ProductionEngine
          brand={brand}
          palette={activePalette}
          background={activeBackground}
          projectId={projectId}
          approvedAssetId={approvedAssetId}
          ar={ar}
        />

        <BrandPackageEngine
          brand={brand}
          palette={activePalette}
          background={activeBackground}
          arabicFont={activeArabicFont}
          englishFont={activeEnglishFont}
          projectId={projectId}
          hasApprovedLogo={hasApprovedLogo}
          onRequireApprovedLogo={() => {
            setLogoAttention(true);
            window.setTimeout(() => document.querySelector(".vi-logo-section")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
            window.setTimeout(() => setLogoAttention(false), 6000);
          }}
          ar={ar}
        />

        {hasApprovedLogo && projectId && (
          <StudioNextActions
            projectId={projectId}
            fromStudio="brand-kit"
            asset={brand?.logo ? { id: brand.logo.asset_id, url: brand.logo.url } : null}
            title={ar ? "تم تحديث الهوية البصرية. اختر الخطوة التالية" : "Visual identity is ready. Choose the next step"}
            description={ar ? "سيتم تمرير الشعار والهوية والألوان والخطوط تلقائيًا إلى الاستوديو التالي." : "The approved logo, identity, colors and typography will be carried into the next studio automatically."}
            hideExports={true}
          />
        )}
      </div>
    </div>
  );
}
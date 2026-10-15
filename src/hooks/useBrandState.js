/**
 * EYAD AI — Brand Source of Truth state hook.
 *
 * Manages the separation between:
 * - PREVIEW state (temporary): what the user is trying in the Live Brand Preview.
 * - SAVED/APPLIED state (persisted): the active brand identity stored in project_data.brand_identity.
 *
 * The Live Brand Preview always reads from the "active" display state, which is
 * preview-if-set, otherwise saved. This lets users try palettes/fonts instantly
 * without API calls, then Apply to persist.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { projectService } from "@/services/projectService";
import { assetService } from "@/services/assetService";
import { saveBrandIdentity } from "@/services/brandService";
import {
  COLOR_PALETTES,
  ARABIC_FONTS,
  ENGLISH_FONTS,
  BACKGROUNDS,
  DEFAULT_PALETTE,
  DEFAULT_ARABIC_FONT,
  DEFAULT_ENGLISH_FONT,
} from "@/studios/brandKit/presets";

function serializeBrand(brand) {
  if (!brand) return {};
  return {
    brand_name: brand.brand_name || "",
    logo: brand.logo
      ? {
          asset_id: brand.logo.asset_id || null,
          url: brand.logo.url || null,
          name: brand.logo.name || null,
          svg_url: brand.logo.svg_url || brand.logo.svgUrl || null,
        }
      : null,
    palette: brand.palette ? { ...brand.palette } : null,
    typography: brand.typography
      ? {
          arabic: brand.typography.arabic ? { ...brand.typography.arabic } : null,
          english: brand.typography.english ? { ...brand.typography.english } : null,
        }
      : null,
    background: brand.background ? { ...brand.background } : null,
  };
}

async function persistBrand(projectId, brand) {
  return saveBrandIdentity(projectId, serializeBrand(brand));
}

export function useBrandState({ projectId, initialAssetId } = {}) {
  const [brand, setBrand] = useState(null);
  const [preview, setPreview] = useState({});
  const [loading, setLoading] = useState(Boolean(projectId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approvedAssetId, setApprovedAssetId] = useState(null);

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setApprovedAssetId(null);
      setLoading(false);
      return undefined;
    }
    (async () => {
      try {
        const project = await projectService.get(projectId);
        if (!active) return;
        const bi = project?.project_data?.brand_identity || {};
        const savedApprovedAssetId = project?.project_data?.approved_asset_id || null;
        setApprovedAssetId(savedApprovedAssetId);

        // The explicitly selected/current approved asset takes precedence over a
        // possibly stale URL cached in brand_identity.logo.
        let logo = bi.logo || null;
        const logoAssetId = initialAssetId || project?.project_data?.approved_asset_id;
        if (logoAssetId) {
          try {
            const asset = await assetService.get(logoAssetId);
            if (asset?.url) {
              logo = {
                asset_id: asset.id,
                url: asset.url,
                name: asset.name,
              };
              setApprovedAssetId(asset.id);
            }
          } catch {
            // Keep the saved identity logo if the current asset cannot be resolved.
          }
        }
        if (!logo?.url && project?.project_data?.latest_asset_url) {
          logo = { url: project.project_data.latest_asset_url };
        }

        setBrand({
          ...bi,
          logo,
          brand_name: bi.brand_name || project?.project_data?.logo_brief?.name || project?.title || "",
        });
      } catch {
        // anonymous or network error — show defaults
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [projectId, initialAssetId]);

  const activePalette = useMemo(() => {
    if (preview.paletteId) return COLOR_PALETTES.find((p) => p.id === preview.paletteId) || DEFAULT_PALETTE;
    return brand?.palette || DEFAULT_PALETTE;
  }, [preview.paletteId, brand?.palette]);

  const activeBackgroundOpacity = useMemo(() => {
    const value = preview.backgroundOpacity ?? brand?.background?.opacity ?? 70;
    return Math.max(0, Math.min(100, Number(value) || 0));
  }, [preview.backgroundOpacity, brand?.background?.opacity]);

  const activeArabicFont = useMemo(() => {
    if (preview.arabicFontId) return ARABIC_FONTS.find((f) => f.id === preview.arabicFontId) || DEFAULT_ARABIC_FONT;
    return brand?.typography?.arabic || DEFAULT_ARABIC_FONT;
  }, [preview.arabicFontId, brand?.typography?.arabic]);

  const activeEnglishFont = useMemo(() => {
    if (preview.englishFontId) return ENGLISH_FONTS.find((f) => f.id === preview.englishFontId) || DEFAULT_ENGLISH_FONT;
    return brand?.typography?.english || DEFAULT_ENGLISH_FONT;
  }, [preview.englishFontId, brand?.typography?.english]);

  const activeBackground = useMemo(() => {
    if (preview.backgroundId) return BACKGROUNDS.find((b) => b.id === preview.backgroundId) || BACKGROUNDS[0];
    return brand?.background || BACKGROUNDS[0];
  }, [preview.backgroundId, brand?.background]);

  const isPaletteDirty = Boolean(preview.paletteId) && preview.paletteId !== brand?.palette?.id;
  const isArabicFontDirty = Boolean(preview.arabicFontId) && preview.arabicFontId !== brand?.typography?.arabic?.id;
  const isEnglishFontDirty = Boolean(preview.englishFontId) && preview.englishFontId !== brand?.typography?.english?.id;
  const isTypographyDirty = isArabicFontDirty || isEnglishFontDirty;
  const isBackgroundDirty =
    (Boolean(preview.backgroundId) && preview.backgroundId !== brand?.background?.id) ||
    activeBackgroundOpacity !== Number(brand?.background?.opacity ?? 70);

  const setPreviewPalette = useCallback((paletteId) => {
    setPreview((p) => ({ ...p, paletteId }));
  }, []);

  const setPreviewBackgroundOpacity = useCallback((opacity) => {
    const value = Math.max(0, Math.min(100, Number(opacity) || 0));
    setPreview((p) => ({ ...p, backgroundOpacity: value }));
  }, []);

  const setPreviewArabicFont = useCallback((fontId) => {
    setPreview((p) => ({ ...p, arabicFontId: fontId }));
  }, []);

  const setPreviewEnglishFont = useCallback((fontId) => {
    setPreview((p) => ({ ...p, englishFontId: fontId }));
  }, []);

  const setPreviewBackground = useCallback((backgroundId) => {
    setPreview((p) => ({ ...p, backgroundId }));
  }, []);

  const applyPalette = useCallback(async () => {
    if (!projectId || !activePalette) return;
    setSaving(true);
    try {
      const next = { ...brand, palette: activePalette };
      setBrand(next);
      setPreview((p) => ({ ...p, paletteId: undefined }));
      await persistBrand(projectId, next);
    } finally {
      setSaving(false);
    }
  }, [projectId, activePalette, brand]);

  const applyBackground = useCallback(async () => {
    if (!projectId || !activeBackground) return;
    setSaving(true);
    try {
      const next = { ...brand, background: { ...activeBackground, opacity: activeBackgroundOpacity } };
      setBrand(next);
      setPreview((p) => ({ ...p, backgroundId: undefined, backgroundOpacity: undefined }));
      await persistBrand(projectId, next);
    } finally {
      setSaving(false);
    }
  }, [projectId, activeBackground, activeBackgroundOpacity, brand]);

  const applyTypography = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const next = { ...brand, typography: { arabic: activeArabicFont, english: activeEnglishFont } };
      setBrand(next);
      setPreview((p) => ({ ...p, arabicFontId: undefined, englishFontId: undefined }));
      await persistBrand(projectId, next);
    } finally {
      setSaving(false);
    }
  }, [projectId, activeArabicFont, activeEnglishFont, brand]);

  const setBrandName = useCallback((name) => {
    setBrand((b) => ({ ...b, brand_name: name }));
  }, []);

  const uploadLogo = useCallback(async (file) => {
    if (!file) return null;
    setUploading(true);
    try {
      let targetProjectId = projectId;
      if (!targetProjectId) {
        const created = await projectService.create({
          title: brand?.brand_name || file.name?.replace(/\.[^.]+$/, "") || "Visual Identity",
          studio_type: "brand-kit",
          status: "draft",
          language: "ar",
          project_data: { brand_identity: { brand_name: brand?.brand_name || "" } },
        });
        targetProjectId = created.id;
      }
      const asset = await assetService.uploadLogo({ projectId: targetProjectId, file });
      setBrand((b) => ({
        ...(b || {}),
        logo: { asset_id: asset.id, url: asset.url, name: asset.name },
      }));
      setApprovedAssetId(asset.id);
      return { ...asset, projectId: targetProjectId };
    } finally {
      setUploading(false);
    }
  }, [projectId, brand?.brand_name]);

  const saveBrandName = useCallback(async () => {
    if (!projectId || !brand?.brand_name) return;
    setSaving(true);
    try {
      await persistBrand(projectId, brand);
    } finally {
      setSaving(false);
    }
  }, [projectId, brand]);

  return {
    brand,
    loading,
    approvedAssetId,
    hasApprovedLogo: Boolean(approvedAssetId || brand?.logo?.asset_id || brand?.logo?.url),
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
    isArabicFontDirty,
    isEnglishFontDirty,
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
  };
}

export default useBrandState;
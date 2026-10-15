/**
 * EYAD AI Core — tool registry.
 * Studios describe intent; tools describe executable capabilities.
 * Providers are intentionally separated so AI keys never live in the browser.
 */
export const aiToolRegistry = {
  generate_logo: {
    id: "generate_logo",
    studio: "logo",
    category: "generation",
    requiresAccount: true,
    creditMeter: "logo_generation",
    providerRoute: "ai/generate/logo",
  },
  generate_image: {
    id: "generate_image",
    studio: "ai-images",
    category: "generation",
    requiresAccount: true,
    creditMeter: "image_generation",
    providerRoute: "ai/generate/image",
  },
  create_brand_kit: {
    id: "create_brand_kit",
    studio: "brand-kit",
    category: "production",
    requiresAccount: true,
    creditMeter: "brand_kit",
    providerRoute: "ai/create/brand-kit",
  },
  create_company_profile: {
    id: "create_company_profile",
    studio: "company-profile",
    category: "production",
    requiresAccount: true,
    creditMeter: "company_profile",
    providerRoute: "ai/create/company-profile",
  },
  create_video: {
    id: "create_video",
    studio: "video",
    category: "generation",
    requiresAccount: true,
    creditMeter: "video_generation",
    providerRoute: "ai/generate/video",
  },
  create_presentation: {
    id: "create_presentation",
    studio: "presentations",
    category: "production",
    requiresAccount: true,
    creditMeter: "presentation",
    providerRoute: "ai/create/presentation",
  },
};

export function getTool(toolId) {
  return aiToolRegistry[toolId] || null;
}

export function getToolsForStudio(studioId) {
  return Object.values(aiToolRegistry).filter((tool) => tool.studio === studioId);
}

/**
 * EYAD AI — Central application configuration.
 *
 * This module is the single source of truth for app-level constants.
 * It is intentionally free of any Base44-specific imports so it can travel
 * with the codebase when exported to GitHub and deployed outside Base44
 * (e.g. Cloudflare / Android). Swap asset hosts / API roots here only.
 */
export const appConfig = {
  name: "EYAD AI",
  tagline: {
    en: "AI Creative Workspace",
    ar: "مساحة الإبداع بالذكاء الاصطناعي",
  },
  // Official EYAD AI brand assets — used as-is, never redrawn or recolored.
  assets: {
    logoIcon:
      "/images/brand/logo-icon.png",
    logoFull:
      "/images/brand/logo-full.png",
  },
  // Core product flow: Idea → Create → Refine → Production
  flow: ["idea", "create", "refine", "production"],
  // Default UI language. Persisted/overridden by the i18n provider.
  defaultLanguage: "en",
  supportedLanguages: ["en", "ar"],
  // Guest trial: number of normal text-chat messages an anonymous visitor
  // can send before being asked to log in. Creative generation always
  // requires login regardless of this limit. Change this ONE value to
  // adjust the free trial.
  guestChatLimit: 50,
};

export default appConfig;
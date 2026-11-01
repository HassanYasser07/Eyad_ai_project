import { AUTO, LIMITS, PRESENTATION_AUDIENCES, PRESENTATION_LANGUAGES, PRESENTATION_PURPOSES, SLIDE_COUNT_OPTIONS } from "./presentationOptions.js";
import { getColorPackage } from "./presentationColorPackages.js";

/** Returns { fieldName: "REQUIRED" | "TOO_LONG" | "INVALID" } — empty object when valid. */
export function validatePresentationSettings(settings) {
  const errors = {};
  const topic = String(settings.topic || "").trim();
  if (!topic) errors.topic = "REQUIRED";
  else if (topic.length > LIMITS.topicMax) errors.topic = "TOO_LONG";

  if (!settings.purpose) errors.purpose = "REQUIRED";
  else if (!PRESENTATION_PURPOSES.some((o) => o.value === settings.purpose)) errors.purpose = "INVALID";

  if (!settings.audience) errors.audience = "REQUIRED";
  else if (!PRESENTATION_AUDIENCES.some((o) => o.value === settings.audience)) errors.audience = "INVALID";
  if (settings.audience === "custom") {
    const custom = String(settings.customAudience || "").trim();
    if (!custom) errors.customAudience = "REQUIRED";
    else if (custom.length > LIMITS.customAudienceMax) errors.customAudience = "TOO_LONG";
  }

  if (!SLIDE_COUNT_OPTIONS.some((o) => o.value === (settings.slideCount || AUTO))) errors.slideCount = "INVALID";

  if (!settings.language) errors.language = "REQUIRED";
  else if (!PRESENTATION_LANGUAGES.some((o) => o.value === settings.language)) errors.language = "INVALID";
  if (settings.language === "other") {
    const other = String(settings.otherLanguage || "").trim();
    if (!other) errors.otherLanguage = "REQUIRED";
    else if (other.length > LIMITS.otherLanguageMax) errors.otherLanguage = "TOO_LONG";
  }

  if (String(settings.additionalInstructions || "").length > LIMITS.additionalInstructionsMax) errors.additionalInstructions = "TOO_LONG";
  if (!getColorPackage(settings.colorPackageId)) errors.colorPackage = "INVALID";
  return errors;
}

/** Shape sent to the backend (the backend re-validates everything). */
export function buildSettingsPayload(settings) {
  const pkg = getColorPackage(settings.colorPackageId);
  return {
    topic: String(settings.topic || "").trim(),
    purpose: settings.purpose,
    audience: settings.audience,
    customAudience: settings.audience === "custom" ? String(settings.customAudience || "").trim() : "",
    slideCount: settings.slideCount || AUTO,
    language: settings.language,
    otherLanguage: settings.language === "other" ? String(settings.otherLanguage || "").trim() : "",
    additionalInstructions: String(settings.additionalInstructions || "").trim(),
    colorPackage: pkg ? { id: pkg.id, name: pkg.name, colors: [...pkg.colors] } : null,
  };
}

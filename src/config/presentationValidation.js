import { AUTO, DEFAULT_DETAIL, DETAIL_OPTIONS, LIMITS, PRESENTATION_LANGUAGES, SLIDE_COUNT_OPTIONS } from "./presentationOptions.js";

/**
 * Returns { fieldName: "REQUIRED" | "TOO_LONG" | "INVALID" } — empty object when valid.
 * The topic OR an attached file (with extracted text) is enough to generate.
 */
export function validatePresentationSettings(settings, file = null) {
  const errors = {};
  const topic = String(settings.topic || "").trim();
  const hasFile = Boolean(file?.text && String(file.text).trim());
  if (!topic && !hasFile) errors.topic = "REQUIRED";
  else if (topic.length > LIMITS.topicMax) errors.topic = "TOO_LONG";

  if (!DETAIL_OPTIONS.some((o) => o.value === (settings.detail || DEFAULT_DETAIL))) errors.detail = "INVALID";
  if (!SLIDE_COUNT_OPTIONS.some((o) => o.value === (settings.slideCount || AUTO))) errors.slideCount = "INVALID";
  if (!PRESENTATION_LANGUAGES.some((o) => o.value === (settings.language || AUTO))) errors.language = "INVALID";
  return errors;
}

/** Shape sent to the backend (the backend re-validates everything). */
export function buildSettingsPayload(settings, file = null) {
  return {
    topic: String(settings.topic || "").trim(),
    fileName: file?.name ? String(file.name).slice(0, 200) : "",
    fileText: file?.text ? String(file.text).slice(0, LIMITS.fileTextMax) : "",
    detail: settings.detail || DEFAULT_DETAIL,
    slideCount: settings.slideCount || AUTO,
    language: settings.language || AUTO,
  };
}

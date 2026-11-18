/**
 * EYAD AI — Image hand-off (Chat → AI Images Studio)
 *
 * When the user opens a generated image from the chat, the image itself must
 * travel with them so the AI Images Studio can show it immediately and use it
 * as the prompt reference. The asset id travels in the URL; the image source
 * (an https URL or a data URL, which is too large for a query string) travels
 * through this tiny hand-off store. It is kept in memory and mirrored to
 * sessionStorage on a best-effort basis (quota / private mode can throw).
 */
const STORAGE_KEY = "eyad:image-handoff";
const MAX_AGE_MS = 15 * 60 * 1000;

let memory = null;

export function setImageHandoff({ assetId = null, url = null, projectId = null, name = null } = {}) {
  if (!url && !assetId) return;
  memory = { assetId: assetId || null, url: url || null, projectId: projectId || null, name: name || null, at: Date.now() };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Data URLs can exceed the storage quota; the in-memory copy still works for SPA navigation.
  }
}

/**
 * Returns the stored hand-off when it is fresh and matches the requested asset
 * (when the URL carries one). Never throws.
 */
export function peekImageHandoff({ assetId = null } = {}) {
  let entry = memory;
  if (!entry) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      entry = raw ? JSON.parse(raw) : null;
    } catch {
      entry = null;
    }
  }
  if (!entry || Date.now() - Number(entry.at || 0) > MAX_AGE_MS) return null;
  if (assetId && entry.assetId && entry.assetId !== assetId) return null;
  return entry;
}

export function clearImageHandoff() {
  memory = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

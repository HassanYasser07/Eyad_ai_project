import { Capacitor } from "@capacitor/core";

export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const MAX_UPLOAD = 100 * 1024 * 1024;
export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };

export function safeName(name, fallback = "presentation") {
  const base = String(name || fallback).replace(/\.pptx$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim().slice(0, 80) || fallback;
  return base;
}

/** Cheap pre-check before reading the file. Deep validation happens in PptxPackage.open. */
export function checkPptxFile(file) {
  if (!file) return "NO_FILE";
  if (!/\.pptx$/i.test(file.name || "")) return "BAD_TYPE";
  if (file.size === 0) return "EMPTY_FILE";
  if (file.size > MAX_UPLOAD) return "FILE_TOO_LARGE";
  return null;
}

export function readFile(file) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsArrayBuffer(file); });
}

/**
 * Deliver bytes to the user.
 * Native (Capacitor): write to the app cache then open the OS share sheet, because
 * <a download> is not reliable inside WKWebView / Android WebView.
 * Web: Web Share (files) on touch devices when available, else a normal download.
 */
export async function saveBytes(bytes, filename, mime = PPTX_MIME) {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    const written = await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Cache });
    try {
      await Share.share({ title: filename, url: written.uri, dialogTitle: filename });
    } catch (err) {
      if (/cancel/i.test(String(err?.message || err))) return { method: "native-cancelled" };
      throw err;
    }
    return { method: "native-share" };
  }
  const blob = new Blob([bytes], { type: mime });
  const file = typeof File === "function" ? new File([blob], filename, { type: mime }) : null;
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  if (touch && file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return { method: "web-share" }; }
    catch (err) { if (err?.name === "AbortError") return { method: "web-share-cancelled" }; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return { method: "download" };
}

/** Opens the system file chooser. Returns the File or null. MIME is listed too: Android pickers grey out unknown extensions. */
export function pickFile({ accept, onPick }) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = accept; input.style.display = "none";
  input.onchange = () => { const f = input.files?.[0] || null; input.remove(); onPick(f); };
  document.body.appendChild(input);
  input.click();
}
export const PPTX_ACCEPT = `.pptx,${PPTX_MIME}`;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,.png,.jpg,.jpeg,.gif";

// ---------- drafts (IndexedDB; falls back silently when unavailable) ----------
const DB = "eyad-pptx-editor", STORE = "drafts", KEY = "current";
function db() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no idb"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode); const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { d.close(); resolve(r?.result); };
    t.onerror = () => { d.close(); reject(t.error); };
  });
}
export const saveDraft = (draft) => tx("readwrite", (s) => s.put(draft, KEY)).catch(() => {});
export const loadDraft = () => tx("readonly", (s) => s.get(KEY)).catch(() => null);
export const clearDraft = () => tx("readwrite", (s) => s.delete(KEY)).catch(() => {});

export async function imageInfo(file) {
  const bytes = new Uint8Array(await readFile(file));
  const type = file.type || "";
  let ext = /png/i.test(type) ? "png" : /jpe?g/i.test(type) ? "jpeg" : /gif/i.test(type) ? "gif" : null;
  if (!ext) { const m = /\.(png|jpe?g|gif)$/i.exec(file.name || ""); ext = m ? m[1].toLowerCase().replace("jpg", "jpeg") : null; }
  if (!ext) return null;
  const url = URL.createObjectURL(new Blob([bytes], { type: `image/${ext}` }));
  try {
    const dims = await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = reject; im.src = url; });
    return { bytes, ext, ...dims };
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

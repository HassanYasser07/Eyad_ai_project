import { ACCEPTED_FILE_EXTENSIONS, LIMITS } from "@/config/presentationOptions";

/**
 * Extracts plain text from a file the user attaches in the prompt box, entirely in the browser
 * (nothing is uploaded). Supported: TXT, MD, CSV, JSON, DOCX, PPTX.
 * Resolves with { name, size, text, truncated, chars }; rejects with an Error whose `code` is one of
 * UNSUPPORTED_FILE | FILE_TOO_LARGE | EMPTY_FILE | FILE_UNREADABLE (see fileErrorMessage()).
 */
export class FileTextError extends Error {
  constructor(code) { super(code); this.name = "FileTextError"; this.code = code; }
}

const extensionOf = (name) => {
  const match = /\.[A-Za-z0-9]+$/.exec(String(name || ""));
  return match ? match[0].toLowerCase() : "";
};

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeXmlText(value) {
  return String(value)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => XML_ENTITIES[name]);
}
function safeCodePoint(code) {
  try { return String.fromCodePoint(code); } catch { return ""; }
}

/** Text of a WordprocessingML (docx) body: one line per paragraph, tabs and breaks preserved. */
export function docxXmlToText(xml) {
  return decodeXmlText(
    String(xml)
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/\n{3,}/g, "\n\n");
}

/** Text of a PresentationML (pptx) slide: one line per paragraph. */
export function pptxSlideXmlToText(xml) {
  return decodeXmlText(
    String(xml)
      .replace(/<a:br\b[^>]*\/>/g, "\n")
      .replace(/<\/a:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/\n{3,}/g, "\n\n");
}

async function readZip(file) {
  const { default: JSZip } = await import("jszip");
  try {
    return await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new FileTextError("FILE_UNREADABLE");
  }
}

async function readDocx(file) {
  const zip = await readZip(file);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new FileTextError("FILE_UNREADABLE");
  return docxXmlToText(await entry.async("string"));
}

async function readPptx(file) {
  const zip = await readZip(file);
  const slides = Object.keys(zip.files)
    .map((path) => ({ path, n: Number((/^ppt\/slides\/slide(\d+)\.xml$/.exec(path) || [])[1]) }))
    .filter((slide) => Number.isFinite(slide.n) && slide.n > 0)
    .sort((a, b) => a.n - b.n);
  if (!slides.length) throw new FileTextError("FILE_UNREADABLE");
  const parts = [];
  for (const slide of slides) {
    const text = pptxSlideXmlToText(await zip.file(slide.path).async("string")).trim();
    if (text) parts.push(`Slide ${slide.n}:\n${text}`);
  }
  return parts.join("\n\n");
}

export async function extractFileText(file, { maxChars = LIMITS.fileTextMax } = {}) {
  if (!file) throw new FileTextError("FILE_UNREADABLE");
  const ext = extensionOf(file.name);
  if (!ACCEPTED_FILE_EXTENSIONS.includes(ext)) throw new FileTextError("UNSUPPORTED_FILE");
  if (file.size > LIMITS.fileBytesMax) throw new FileTextError("FILE_TOO_LARGE");
  if (file.size === 0) throw new FileTextError("EMPTY_FILE");

  let raw;
  try {
    raw = ext === ".docx" ? await readDocx(file) : ext === ".pptx" ? await readPptx(file) : await file.text();
  } catch (error) {
    if (error instanceof FileTextError) throw error;
    throw new FileTextError("FILE_UNREADABLE");
  }
  const text = String(raw).replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
  if (!text) throw new FileTextError("EMPTY_FILE");
  const truncated = text.length > maxChars;
  return { name: file.name, size: file.size, text: truncated ? text.slice(0, maxChars) : text, truncated, chars: Math.min(text.length, maxChars) };
}

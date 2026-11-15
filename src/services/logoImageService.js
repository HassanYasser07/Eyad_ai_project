/**
 * EYAD AI — Logo image helpers.
 *
 * Raster image pipelines (AI image generation, canvas compositing, PDF/ZIP
 * packaging) cannot consume SVG files directly. These helpers detect SVG logos
 * and convert them to a high-resolution transparent PNG data URL in the browser,
 * so SVG logos behave exactly like PNG logos everywhere in the studio.
 */

const RASTER_CACHE = new Map();
const DEFAULT_MAX_SIDE = 1024;
const FALLBACK_SIZE = 512;

/** True when the URL / name / mime clearly points to an SVG file. */
export function isSvgSource(source, hint = "") {
  const value = String(source || "").trim();
  if (!value && !hint) return false;
  if (/^data:image\/svg\+xml/i.test(value)) return true;
  const path = value.split("#")[0].split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return true;
  const hinted = String(hint || "").toLowerCase();
  return hinted.includes("image/svg") || hinted.endsWith(".svg");
}

function parseLength(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || text.endsWith("%")) return null;
  const n = parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readSvgText(source) {
  if (/^data:image\/svg\+xml/i.test(source)) {
    const comma = source.indexOf(",");
    const meta = source.slice(0, comma);
    const body = source.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const binary = atob(body);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      return Promise.resolve(new TextDecoder("utf-8").decode(bytes));
    }
    return Promise.resolve(decodeURIComponent(body));
  }
  return fetch(source, { mode: "cors" }).then((response) => {
    if (!response.ok) throw new Error("SVG_LOGO_FETCH_FAILED");
    return response.text();
  });
}

/** Normalises an SVG document so browsers always report a real intrinsic size. */
function normaliseSvg(svgText, maxSide) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("SVG_LOGO_INVALID");
  }

  let width = parseLength(root.getAttribute("width"));
  let height = parseLength(root.getAttribute("height"));
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const hasViewBox = viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0;

  if (hasViewBox) {
    if (!width && !height) { width = viewBox[2]; height = viewBox[3]; }
    else if (!width) width = height * (viewBox[2] / viewBox[3]);
    else if (!height) height = width * (viewBox[3] / viewBox[2]);
  } else {
    width = width || FALLBACK_SIZE;
    height = height || FALLBACK_SIZE;
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  const scale = maxSide / Math.max(width, height);
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  root.setAttribute("width", String(outW));
  root.setAttribute("height", String(outH));
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { markup: new XMLSerializer().serializeToString(root), width: outW, height: outH };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG_LOGO_RENDER_FAILED"));
    image.src = src;
  });
}

/**
 * Converts an SVG URL (or data URL) to a transparent PNG data URL.
 * Results are cached per source URL.
 */
export async function rasterizeSvgToPngDataUrl(source, maxSide = DEFAULT_MAX_SIDE) {
  if (!source) throw new Error("SVG_LOGO_SOURCE_MISSING");
  const key = `${source}::${maxSide}`;
  if (RASTER_CACHE.has(key)) return RASTER_CACHE.get(key);

  const task = (async () => {
    const svgText = await readSvgText(source);
    const { markup, width, height } = normaliseSvg(svgText, maxSide);
    const dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    const image = await loadImage(dataUri);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("SVG_LOGO_CANVAS_UNAVAILABLE");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  })();

  RASTER_CACHE.set(key, task);
  try {
    return await task;
  } catch (error) {
    RASTER_CACHE.delete(key);
    throw error;
  }
}

/**
 * Returns a raster-safe URL for a logo. PNG/JPG/WebP logos are returned
 * untouched; SVG logos are converted to a PNG data URL. If conversion fails the
 * original URL is returned so callers never break.
 */
export async function ensureRasterLogoUrl(logoOrUrl) {
  const url = typeof logoOrUrl === "string" ? logoOrUrl : logoOrUrl?.url;
  if (!url) return url || null;
  const hint = typeof logoOrUrl === "object" && logoOrUrl ? (logoOrUrl.mime_type || logoOrUrl.name || "") : "";
  if (!isSvgSource(url, hint)) return url;
  try {
    return await rasterizeSvgToPngDataUrl(url);
  } catch (error) {
    console.warn("[EYAD] SVG logo could not be rasterized; using the original file.", error);
    return url;
  }
}

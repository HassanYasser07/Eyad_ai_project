/**
 * Logo style references
 * ---------------------
 * Every .svg file you drop into  src/assets/logoStyles/  becomes a selectable card in
 * Logo Studio ("Logo style reference"). No code change is needed to add or remove one.
 *
 * Naming:   luxury-gold.svg  ->  id "luxury-gold", label "Luxury Gold"
 * Optional: add an entry to LOGO_STYLE_OVERRIDES below to give a file an Arabic label
 *           and/or your own style description. The description is what the model reads.
 *
 * Only ONE reference can be selected. It is rasterized to a PNG on the client and sent to
 * the engine as `style_reference_image` + `style_reference_prompt`, exactly like the
 * Visual Style in AI Images Studio.
 */

const modules = import.meta.glob("/src/assets/logoStyles/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

// Optional per-file overrides, keyed by file name without ".svg".
//   ar / en : display labels
//   prompt  : what the model should take from this logo (shape language, weight, mood...)
export const LOGO_STYLE_OVERRIDES = {
  "01-geometric-monogram": {
    en: "Geometric Gold & Navy",
    ar: "مونوجرام هندسي بالذهبي والكحلي",
    prompt: "geometric monogram built from precise structured shapes, balanced and symmetrical, refined corporate feel. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "02-bold-geometric-mark": {
    en: "Bold Geometric",
    ar: "رمز هندسي جريء مع كتابة عصرية",
    prompt: "bold geometric symbol with heavy confident forms paired with a modern clean wordmark. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "03-luxury-gold-beauty": {
    en: "Luxury Gold Beauty",
    ar: "فخامة ذهبية مع رمز أنثوي وتاج",
    prompt: "luxury feminine emblem with a crown element, elegant thin-to-thick contrast, ornate but refined. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "04-premium-gold-architecture": {
    en: "Premium Gold Architecture",
    ar: "هوية معمارية ذهبية بطابع فاخر",
    prompt: "premium architectural identity, structured building-inspired forms, luxurious restrained detailing. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "05-crowned-coffee-emblem": {
    en: "Crowned Coffee Emblem",
    ar: "شعار قهوة كلاسيكي مع تاج",
    prompt: "classic coffee emblem with a crown, traditional symmetrical badge composition. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "06-floral-elegance": {
    en: "Floral Elegance",
    ar: "أناقة أنثوية مع زهور وتفاصيل ناعمة",
    prompt: "feminine floral elegance, soft flowing organic details, delicate fine linework. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "07-elegant-cup-portrait": {
    en: "Elegant Cup Portrait",
    ar: "كوب قهوة مع بروفايل أنثوي",
    prompt: "elegant illustrative mark combining a coffee cup with a female profile, smooth flowing contours. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "08-gold-growth-accounting": {
    en: "Gold Growth Accounting",
    ar: "نمو مالي بأعمدة ذهبية",
    prompt: "financial growth symbol made of rising bars, clean upward momentum, professional and trustworthy. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "09-architectural-horizon": {
    en: "Architectural Horizon",
    ar: "جسر معماري بخطوط انسيابية",
    prompt: "architectural bridge symbol with smooth streamlined lines, horizon-like flowing composition. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "10-neon-esports-mascot": {
    en: "Neon Esports Mascot",
    ar: "شخصية ألعاب بألوان نيون",
    prompt: "esports gaming mascot character, aggressive energetic illustration, glowing high-energy attitude. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "11-green-esports-mascot": {
    en: "Green Esports Mascot",
    ar: "شخصية ألعاب بطابع أخضر قوي",
    prompt: "esports gaming mascot character, strong bold outlines, powerful competitive attitude. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "12-global-finance": {
    en: "Global Finance",
    ar: "كرة أرضية مع أعمدة مالية",
    prompt: "globe combined with financial bars, global corporate finance symbol, structured and credible. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "13-organic-roastery-badge": {
    en: "Organic Roastery Badge",
    ar: "شارة محمصة بطابع عضوي",
    prompt: "organic roastery badge, circular craft emblem, natural hand-crafted feel. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "14-equestrian-construction": {
    en: "Equestrian Construction",
    ar: "حصان مع عناصر معمارية",
    prompt: "horse silhouette merged with architectural elements, strong dynamic stance, symbol-led mark. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "15-editorial-beauty-script": {
    en: "Editorial Beauty Script",
    ar: "كتابة انسيابية مع لمسة تجميلية",
    prompt: "editorial script wordmark, flowing calligraphic lettering with a subtle beauty accent. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "16-bold-red-architecture": {
    en: "Bold Red Architecture",
    ar: "هندسة معمارية بخطوط حمراء قوية",
    prompt: "bold architectural mark with strong thick angular lines, high-impact construction identity. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "17-modern-accounting-mark": {
    en: "Modern Accounting Mark",
    ar: "رمز محاسبي حديث مع علامة تحقق",
    prompt: "modern accounting symbol incorporating a checkmark, clean minimal geometry, precise and reliable. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "18-arabic-coffee-heritage": {
    en: "Arabic Coffee Heritage",
    ar: "هوية قهوة تراثية بإبريق وفنجان",
    prompt: "Arabic coffee heritage identity with a traditional pot and cup, cultural ornamental character. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "19-travel-world-emblem": {
    en: "Travel World Emblem",
    ar: "شعار سفر مع كرة أرضية وطائرة",
    prompt: "travel emblem with a globe and an airplane, dynamic motion, friendly and adventurous. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
  "20-green-organic-wordmark": {
    en: "Green Organic Wordmark",
    ar: "هوية خضراء طبيعية بطابع عضوي",
    prompt: "organic natural wordmark-led identity, soft rounded forms, fresh eco-friendly feel. Take only the design language (shape language, weight, detail level, layout), not the symbol, text or colors.",
  },
};

const DEFAULT_PROMPT =
  "Take the overall design language of the reference logo: its shape language (geometric vs organic), " +
  "line and stroke weight, level of detail, symmetry, corner treatment, symbol-to-text balance, " +
  "lockup layout and overall mood.";

const titleCase = (value) =>
  value
    .replace(/^\d+[-_.\s]*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const LOGO_STYLE_REFERENCES = Object.entries(modules)
  .map(([path, url]) => {
    const file = path.split("/").pop().replace(/\.svg$/i, "");
    const override = LOGO_STYLE_OVERRIDES[file] || {};
    const en = override.en || titleCase(file);
    return {
      id: file,
      en,
      ar: override.ar || en,
      url,
      prompt: override.prompt || DEFAULT_PROMPT,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

export const getLogoStyleReference = (id) =>
  LOGO_STYLE_REFERENCES.find((item) => item.id === id) || null;

/* ------------------------------------------------------------------ */
/* SVG -> PNG data URL                                                 */
/* ------------------------------------------------------------------ */
// The image model cannot read SVG, so the chosen logo is drawn onto a canvas first.
// White opaque background (a transparent reference is read as black by some models),
// logo centred with padding so nothing is cropped.

const RASTER_SIZE = 1024;
const RASTER_PADDING = 0.1;
const rasterCache = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("LOGO_STYLE_REFERENCE_LOAD_FAILED"));
    img.src = src;
  });
}

function readSvgSize(svgText) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("LOGO_STYLE_REFERENCE_INVALID_SVG");
  }
  const num = (v) => {
    const n = parseFloat(String(v || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  let w = num(svg.getAttribute("width"));
  let h = num(svg.getAttribute("height"));
  const vb = String(svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if ((!w || !h) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    w = vb[2];
    h = vb[3];
  }
  if (!w || !h) {
    w = 512;
    h = 512;
  }
  // Force explicit pixel size so every browser rasterizes at the same ratio.
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { w, h, text: new XMLSerializer().serializeToString(svg) };
}

export async function rasterizeLogoStyleReference(reference) {
  if (!reference?.url) throw new Error("LOGO_STYLE_REFERENCE_MISSING");
  if (rasterCache.has(reference.id)) return rasterCache.get(reference.id);

  const response = await fetch(reference.url);
  if (!response.ok) throw new Error("LOGO_STYLE_REFERENCE_LOAD_FAILED");
  const { w, h, text } = readSvgSize(await response.text());

  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(text));
  const canvas = document.createElement("canvas");
  canvas.width = RASTER_SIZE;
  canvas.height = RASTER_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RASTER_SIZE, RASTER_SIZE);
  const box = RASTER_SIZE * (1 - RASTER_PADDING * 2);
  const scale = Math.min(box / w, box / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(img, (RASTER_SIZE - dw) / 2, (RASTER_SIZE - dh) / 2, dw, dh);

  const dataUrl = canvas.toDataURL("image/png");
  rasterCache.set(reference.id, dataUrl);
  return dataUrl;
}

/**
 * EYAD AI — Brand Profile PDF generator.
 *
 * Builds a single professional, landscape (16:9) brand-guidelines PDF:
 *   cover · brand story · logo · colour palette · typography ·
 *   applications · usage rules · closing
 *
 * Pages are painted directly on <canvas> (so the user's selected web fonts —
 * including Arabic shaping and RTL — render correctly), then assembled with
 * jsPDF. Imagery is either AI-generated (tailored to the user's business) or a
 * procedural, palette-driven artwork, so the PDF is always complete and on-brand.
 */
import { jsPDF } from "jspdf";
import {
  buildCopy, colorName, contrastRatio, describeTone, detectSector, firstFamily,
  hexToRgb, luminance, mixHex, normalizeHex, readableOn, rgba, rgbToCmyk,
} from "./brandProfileData";

const W = 1600;
const H = 900;
const SCALE = 1.5;
const M = 96; // page margin
const ARABIC_RE = /[؀-ۿ]/;

/* ----------------------------------------------------------------- helpers */

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  ctx.restore();
}

function coverImage(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function containRect(iw, ih, x, y, w, h) {
  const ratio = Math.min(w / iw, h / ih);
  const dw = iw * ratio;
  const dh = ih * ratio;
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* -------------------------------------------------------------- text tools */

function makeText(ctx, ar, famEn, famAr) {
  const family = (str, o) => o.family || (ARABIC_RE.test(str) ? famAr : famEn);

  const draw = (str, x, y, o = {}) => {
    const { size = 22, weight = 500, color = "#111", align, alpha = 1, tracking = 0 } = o;
    const rtl = ARABIC_RE.test(str);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family(str, o)}`;
    ctx.textAlign = align || (ar ? "right" : "left");
    ctx.textBaseline = "alphabetic";
    ctx.direction = rtl ? "rtl" : "ltr";
    if (tracking && !rtl && "letterSpacing" in ctx) ctx.letterSpacing = tracking + "px";
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  const measure = (str, o = {}) => {
    ctx.save();
    ctx.font = `${o.weight || 500} ${o.size || 22}px ${family(str, o)}`;
    if (o.tracking && "letterSpacing" in ctx && !ARABIC_RE.test(str)) ctx.letterSpacing = o.tracking + "px";
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  };

  const wrap = (str, w, o = {}) => {
    const words = String(str || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const next = line ? line + " " + word : word;
      if (line && measure(next, o) > w) { lines.push(line); line = word; } else { line = next; }
    });
    if (line) lines.push(line);
    return lines;
  };

  /** Draws a wrapped paragraph in the column starting at x (left edge). Returns the next free y. */
  const para = (str, x, y, w, o = {}) => {
    const lh = o.lh || (o.size || 22) * 1.55;
    const align = o.align || (ar ? "right" : "left");
    const ax = align === "right" ? x + w : align === "center" ? x + w / 2 : x;
    const lines = wrap(str, w, o);
    const max = o.maxLines || lines.length;
    lines.slice(0, max).forEach((l, i) => draw(l, ax, y + i * lh, { ...o, align }));
    return y + Math.min(lines.length, max) * lh;
  };

  /** Shrinks font size until the string fits width. */
  const fit = (str, w, o = {}) => {
    let size = o.size || 60;
    while (size > 18 && measure(str, { ...o, size }) > w) size -= 2;
    return size;
  };

  const label = (str, x, y, o = {}) => draw(ARABIC_RE.test(str) ? str : String(str).toUpperCase(), x, y, { size: 13, weight: 700, tracking: 2.2, ...o });

  const pill = (str, x, y, o = {}) => {
    const size = o.size || 20;
    const padX = 26;
    const w = measure(str, { size, weight: 600 }) + padX * 2;
    const h = size + 22;
    const px = o.center ? x - w / 2 : ar ? x - w : x;
    fillRR(ctx, px, y, w, h, h / 2, o.fill || null, o.stroke || "#111", 1.6);
    draw(str, px + w / 2, y + h / 2 + size * 0.34, { size, weight: 600, color: o.color || "#111", align: "center" });
    return { w, h };
  };

  return { draw, measure, wrap, para, fit, label, pill };
}

/* ------------------------------------------------------------ logo analysis */

function analyseLogo(img) {
  const size = 72;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d", { willReadFrequently: true });
  const box = containRect(img.width, img.height, 0, 0, size, size);
  x.drawImage(img, box.x, box.y, box.w, box.h);
  let n = 0;
  let lum = 0;
  let spread = 0;
  try {
    const data = x.getImageData(0, 0, size, size).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 48) continue;
      n += 1;
      lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      spread += (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])) / 255;
    }
  } catch {
    return { lum: 0.2, mono: false, aspect: img.width / img.height };
  }
  return { lum: n ? lum / n : 0.2, mono: n ? spread / n < 0.16 : false, aspect: img.width / img.height };
}

function tintedLogo(img, color) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/* ---------------------------------------------------------- backgrounds art */

function paintMotif(ctx, motif, x, y, w, h, color, alpha, seed) {
  const rand = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.fillStyle = rgba(color, alpha);
  ctx.lineWidth = 1.6;
  if (motif === "rings") {
    const cx = x + w * (0.78 + rand() * 0.12);
    const cy = y + h * (0.2 + rand() * 0.2);
    for (let i = 1; i <= 7; i += 1) { ctx.beginPath(); ctx.arc(cx, cy, i * 78, 0, Math.PI * 2); ctx.stroke(); }
  } else if (motif === "grid") {
    const step = 64;
    for (let gx = x; gx < x + w; gx += step) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
    for (let gy = y; gy < y + h; gy += step) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
  } else if (motif === "lines") {
    for (let i = -h; i < w; i += 46) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
  } else if (motif === "dots") {
    for (let gx = x + 24; gx < x + w; gx += 44) for (let gy = y + 24; gy < y + h; gy += 44) { ctx.beginPath(); ctx.arc(gx, gy, 2.4, 0, Math.PI * 2); ctx.fill(); }
  } else if (motif === "waves") {
    for (let i = 0; i < 16; i += 1) {
      const base = y + (h / 16) * i + 20;
      ctx.beginPath();
      for (let gx = x; gx <= x + w; gx += 12) {
        const gy = base + Math.sin((gx / w) * Math.PI * 3 + i * 0.5) * 22;
        if (gx === x) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintGrain(ctx, w, h, seed, amount = 5000) {
  const rand = rng(seed);
  ctx.save();
  for (let i = 0; i < amount; i += 1) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${0.02 + rand() * 0.035})`;
    ctx.fillRect(rand() * w, rand() * h, 1.4, 1.4);
  }
  ctx.restore();
}

/** Rich, palette-driven artwork used when AI imagery is unavailable. */
function paintProceduralBackdrop(ctx, p, sector, variant) {
  const seed = hashSeed(p.name + sector.id + variant);
  const rand = rng(seed);
  const base = mixHex(p.primary, "#000000", variant === 2 ? 0.55 : 0.4);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, base);
  g.addColorStop(0.55, mixHex(p.primary, p.secondary, 0.35));
  g.addColorStop(1, mixHex(p.secondary, "#000000", 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = (cx, cy, r, color, a) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, rgba(color, a));
    rg.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * (0.15 + rand() * 0.25), H * (0.2 + rand() * 0.3), 760, p.accent, 0.42);
  glow(W * (0.7 + rand() * 0.2), H * (0.55 + rand() * 0.3), 820, p.secondary, 0.5);
  glow(W * 0.5, H * 1.05, 700, p.surface, 0.16);

  // large soft organic shapes for depth
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.globalAlpha = 0.1 + rand() * 0.08;
    ctx.fillStyle = i % 2 ? p.accent : p.surface;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, 180 + rand() * 260, 120 + rand() * 200, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  paintMotif(ctx, sector.motif, 0, 0, W, H, p.surface, 0.11, seed);
  paintGrain(ctx, W, H, seed + 7);
}

function paintBackdrop(ctx, p, sector, image, variant, darken = 0.38) {
  if (image) {
    coverImage(ctx, image, 0, 0, W, H);
    const tint = ctx.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, `rgba(0,0,0,${darken * 0.7})`);
    tint.addColorStop(1, `rgba(0,0,0,${darken + 0.2})`);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgba(p.primary, 0.14);
    ctx.fillRect(0, 0, W, H);
  } else {
    paintProceduralBackdrop(ctx, p, sector, variant);
  }
}

/* ------------------------------------------------------------- logo drawing */

function makeLogoPainter(ctx, img, info) {
  const fitBox = (x, y, w, h) => containRect(img.width, img.height, x, y, w, h);

  const draw = (x, y, w, h, opts = {}) => {
    const b = fitBox(x, y, w, h);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.shadow) { ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; }
    ctx.drawImage(opts.source || img, b.x, b.y, b.w, b.h);
    ctx.restore();
    return b;
  };

  /** Paints the logo with guaranteed legibility on a given background colour. */
  const onBg = (bg, x, y, w, h, o = {}) => {
    const bgLum = luminance(bg);
    const logoLum = info.lum;
    const apparent = Math.abs(bgLum - logoLum);
    if (apparent > 0.32) return draw(x, y, w, h, o);
    if (info.mono) {
      const color = bgLum > 0.45 ? "#161616" : "#FFFFFF";
      return draw(x, y, w, h, { ...o, source: tintedLogo(img, color) });
    }
    // Multicolour logo with weak contrast: seat it on a neutral plate instead of recolouring it.
    const b = fitBox(x, y, w, h);
    const padX = b.w * 0.14;
    const padY = b.h * 0.2;
    fillRR(ctx, b.x - padX, b.y - padY, b.w + padX * 2, b.h + padY * 2, 22, bgLum > 0.45 ? "#161616" : "#FFFFFF");
    return draw(x, y, w, h, o);
  };

  return { draw, onBg, fitBox };
}

/* --------------------------------------------------------------- page chrome */

function footer(ctx, T, ar, name, page, total, color, numColor = color) {
  const y = H - 38;
  T.draw(name, ar ? W - M : M, y, { size: 13, weight: 600, color, alpha: 0.75, tracking: 1 });
  T.draw(String(page).padStart(2, "0") + " / " + String(total).padStart(2, "0"), ar ? M : W - M, y, {
    size: 13, weight: 600, color: numColor, alpha: 0.75, tracking: 1, align: ar ? "left" : "right", family: undefined,
  });
}

/* ------------------------------------------------------------------- pages */

function pageCover(ctx, T, ar, P, logo, image, name, copy, activity, year) {
  paintBackdrop(ctx, P, P.sector, image, 1, 0.34);

  T.label(copy.guidelines, ar ? W - M : M, 84, { color: "#FFFFFF", alpha: 0.85, size: 14 });
  T.label(String(year), ar ? M : W - M, 84, { color: "#FFFFFF", alpha: 0.85, size: 14, align: ar ? "left" : "right" });

  const logoBox = { x: W / 2 - 330, y: 250, w: 660, h: 300 };
  if (logo) {
    const b = logo.fitBox(logoBox.x, logoBox.y, logoBox.w, logoBox.h);
    // Dark logos get a soft plate so they never disappear on imagery.
    if (logo.info.lum > 0.5 || !logo.info.mono) {
      logo.draw(logoBox.x, logoBox.y, logoBox.w, logoBox.h, { shadow: true });
    } else {
      fillRR(ctx, b.x - 70, b.y - 48, b.w + 140, b.h + 96, 40, rgba(P.surface, 0.94));
      logo.draw(logoBox.x, logoBox.y, logoBox.w, logoBox.h);
    }
  } else {
    T.draw(name, W / 2, 420, { size: T.fit(name, 900, { size: 120, weight: 800 }), weight: 800, color: "#FFFFFF", align: "center" });
  }

  const sub = (activity ? activity : copy.essence);
  T.para(sub, W / 2 - 330, 690, 660, { size: 17, weight: 600, color: "#FFFFFF", align: "center", alpha: 0.92, lh: 27, maxLines: 2 });
  T.pill(String(year), W / 2, 782, { size: 15, color: "#FFFFFF", stroke: "rgba(255,255,255,.85)", center: true });
}

function pagePillar(ctx, T, ar, P, copy, sector, name, activity, tone, total, pageNo) {
  const surface = P.surface;
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, W, H);
  paintMotif(ctx, sector.motif, 0, 0, W, H, P.primary, 0.05, hashSeed(name));

  const split = 860;
  const dark = { x: ar ? 0 : split, w: W - split };
  ctx.fillStyle = P.primary;
  ctx.fillRect(dark.x, 0, dark.w, H);
  paintMotif(ctx, sector.motif, dark.x, 0, dark.w, H, readableOn(P.primary), 0.07, hashSeed(name) + 3);

  const leftX = ar ? W - M - 640 : M;
  T.pill(copy.story, ar ? W - M : M, 96, { color: P.ink, stroke: P.ink });
  const size = T.fit(name, 700, { size: 76, weight: 800 });
  T.draw(name, ar ? W - M : M, 280, { size, weight: 800, color: P.ink, align: ar ? "right" : "left" });
  T.para(copy.storyBody[0], leftX, 350, 640, { size: 21, weight: 500, color: P.ink, alpha: 0.82, lh: 33 });
  T.para(copy.storyBody[1], leftX, 480, 640, { size: 18, weight: 500, color: P.ink, alpha: 0.65, lh: 29 });

  const rows = [
    [copy.industry, ar ? sector.sector.ar : sector.sector.en],
    ...(activity ? [[copy.activityLabel, activity]] : []),
    [copy.toneLabel, tone],
  ];
  let ry = 650;
  rows.forEach(([k, v]) => {
    ctx.fillStyle = rgba(P.ink, 0.18);
    ctx.fillRect(leftX, ry - 26, 640, 1.2);
    T.label(k, ar ? leftX + 640 : leftX, ry, { color: P.ink, alpha: 0.55 });
    T.draw(v, ar ? leftX : leftX + 640, ry, { size: 19, weight: 700, color: P.ink, align: ar ? "left" : "right" });
    ry += 56;
  });

  const onDark = readableOn(P.primary);
  const colX = dark.x + 70;
  const colW = dark.w - 140;
  T.label(copy.pillarsTitle, ar ? colX + colW : colX, 110, { color: onDark, alpha: 0.75 });
  sector.pillars.forEach((pl, i) => {
    const y = 190 + i * 190;
    ctx.fillStyle = rgba(onDark, 0.22);
    ctx.fillRect(colX, y - 36, colW, 1.2);
    T.draw(String(i + 1).padStart(2, "0"), ar ? colX + colW : colX, y + 6, { size: 18, weight: 700, color: P.accent });
    T.draw(ar ? pl.ar : pl.en, ar ? colX + colW - 56 : colX + 56, y + 8, { size: 34, weight: 800, color: onDark });
    T.para(ar ? pl.dAr : pl.dEn, colX + 56 * (ar ? 0 : 1), y + 52, colW - 56, { size: 18, weight: 500, color: onDark, alpha: 0.8, lh: 28, maxLines: 3 });
  });
  footer(ctx, T, ar, name, pageNo, total, P.ink, onDark);
}

function pageLogo(ctx, T, ar, P, logo, copy, name, total, pageNo) {
  const half = W / 2;
  const lightX = ar ? half : 0;
  const darkX = ar ? 0 : half;
  ctx.fillStyle = P.surface;
  ctx.fillRect(lightX, 0, half, H);
  ctx.fillStyle = P.ink;
  ctx.fillRect(darkX, 0, half, H);

  // Construction drawing
  const cx = lightX + half / 2;
  const cy = 420;
  const box = 400;
  const bx = cx - box / 2;
  const by = cy - box / 2;
  ctx.save();
  ctx.strokeStyle = rgba(P.ink, 0.45);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(bx, by, box, box);
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + box, by + box);
  ctx.moveTo(bx + box, by); ctx.lineTo(bx, by + box);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, box / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = rgba(P.accent, 0.95);
  ctx.strokeRect(bx + box * 0.14, by + box * 0.14, box * 0.72, box * 0.72);
  ctx.restore();

  if (logo) logo.onBg(P.surface, bx + box * 0.2, by + box * 0.2, box * 0.6, box * 0.6);

  T.pill(copy.logo, ar ? lightX + half - M : lightX + M, 96, { color: P.ink, stroke: P.ink });
  T.draw(copy.clearSpace, ar ? lightX + half - M : lightX + M, 700, { size: 22, weight: 800, color: P.ink });
  T.para(copy.clearSpaceText, ar ? lightX : lightX + M, 736, half - M, { size: 15, weight: 500, color: P.ink, alpha: 0.65, lh: 24, maxLines: 3, align: ar ? "right" : "left" }) ;

  // Versions on the dark side
  const onDark = readableOn(P.ink);
  T.label(copy.versions, ar ? darkX + half - M : darkX + M, 110, { color: onDark, alpha: 0.7 });
  T.draw(copy.logoSub, ar ? darkX + half - M : darkX + M, 160, { size: 26, weight: 700, color: onDark });

  const tile = 190;
  const gap = 40;
  const total3 = tile * 3 + gap * 2;
  const startX = darkX + (half - total3) / 2;
  const ty = 330;
  const tiles = [
    { bg: P.surface, label: copy.onLight, border: null },
    { bg: P.ink, label: copy.onDark, border: rgba("#FFFFFF", 0.7) },
    { bg: P.accent, label: copy.onAccent, border: null },
  ];
  tiles.forEach((t, i) => {
    const x = startX + (ar ? tiles.length - 1 - i : i) * (tile + gap);
    fillRR(ctx, x, ty, tile, tile, 46, t.bg, t.border, 2);
    if (logo) logo.onBg(t.bg, x + 34, ty + 34, tile - 68, tile - 68);
    T.draw(t.label, x + tile / 2, ty + tile + 38, { size: 15, weight: 600, color: onDark, alpha: 0.8, align: "center" });
  });

  // Minimum size marker
  const my = 690;
  const mx = ar ? darkX + half - M : darkX + M;
  T.label(ar ? "الحد الأدنى للحجم" : "Minimum size", mx, my, { color: onDark, alpha: 0.6 });
  if (logo) {
    const lx = ar ? mx - 96 : mx;
    logo.onBg(P.ink, lx, my + 20, 96, 40);
    T.draw(ar ? "٢٤ بكسل / ١٢ مم" : "24 px  ·  12 mm", ar ? lx - 24 : lx + 124, my + 48, { size: 16, weight: 600, color: onDark, alpha: 0.8 });
  }
  footer(ctx, T, ar, name, pageNo, total, P.ink, onDark);
}

function pageColors(ctx, T, ar, P, copy, sector, image, name, total, pageNo) {
  paintBackdrop(ctx, P, sector, image, 2, 0.28);

  T.pill(copy.colors, ar ? W - M : M, 86, { color: "#FFFFFF", stroke: "rgba(255,255,255,.9)" });
  T.draw(copy.colorsSub, ar ? W - M : M, 176, { size: 20, weight: 500, color: "#FFFFFF", alpha: 0.85 });

  const colors = [
    { hex: P.primary, role: copy.roles[0] },
    { hex: P.secondary, role: copy.roles[1] },
    { hex: P.accent, role: copy.roles[2] },
    { hex: P.surface, role: copy.roles[3] },
    { hex: P.inkHex, role: copy.roles[4] + " · " + copy.roleDerived },
  ];
  const cw = 262;
  const gap = 24;
  const totalW = colors.length * cw + (colors.length - 1) * gap;
  const sx = (W - totalW) / 2;
  const sy = 262;
  const ch = 372;
  colors.forEach((c, i) => {
    const x = sx + (ar ? colors.length - 1 - i : i) * (cw + gap);
    fillRR(ctx, x, sy, cw, ch, 6, "#FFFFFF");
    ctx.fillStyle = c.hex;
    ctx.fillRect(x + 6, sy + 6, cw - 12, 216);
    if (contrastRatio(c.hex, "#FFFFFF") < 1.25) { ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.strokeRect(x + 6, sy + 6, cw - 12, 216); }

    const { r, g, b } = hexToRgb(c.hex);
    const k = rgbToCmyk(c.hex);
    const nameStr = colorName(c.hex, ar);
    const nx = ar ? x + cw - 22 : x + 22;
    T.draw(ar ? nameStr : nameStr.toUpperCase(), nx, sy + 256, { size: 19, weight: 800, color: "#161616" });
    T.label(c.role, nx, sy + 280, { size: 11, color: "#161616", alpha: 0.5 });
    const rows = [["HEX", c.hex.slice(1)], ["RGB", `${r}, ${g}, ${b}`], ["CMYK", `${k.c}, ${k.m}, ${k.y}, ${k.k}`]];
    rows.forEach(([lab, val], j) => {
      const yy = sy + 308 + j * 20;
      T.draw(lab, ar ? x + cw - 22 : x + 22, yy, { size: 12.5, weight: 700, color: "#161616", alpha: 0.55, family: undefined, align: ar ? "right" : "left" });
      T.draw(val, ar ? x + cw - 78 : x + 78, yy, { size: 13.5, weight: 600, color: "#161616", align: ar ? "right" : "left" });
    });
  });

  // usage ratio strip
  const ratios = [0.4, 0.2, 0.1, 0.25, 0.05];
  const stripX = sx;
  const stripW = totalW;
  const stripY = 690;
  fillRR(ctx, stripX, stripY, stripW, 92, 18, "rgba(0,0,0,.42)");
  T.label(copy.ratio, ar ? stripX + stripW - 28 : stripX + 28, stripY + 34, { color: "#FFFFFF", alpha: 0.85, size: 12 });
  let px = ar ? stripX + stripW - 28 : stripX + 28;
  const barW = stripW - 56;
  colors.forEach((c, i) => {
    const w = barW * ratios[i];
    const x = ar ? px - w : px;
    ctx.fillStyle = c.hex;
    ctx.fillRect(x, stripY + 50, w - 3, 22);
    px = ar ? px - w : px + w;
  });
  T.draw(copy.colorNote, ar ? W - M : M, 822, { size: 12.5, weight: 500, color: "#FFFFFF", alpha: 0.7 });
  footer(ctx, T, ar, name, pageNo, total, "#FFFFFF");
}

function pageTypography(ctx, T, ar, P, copy, enFont, arFont, famEn, famAr, name, total, pageNo) {
  ctx.fillStyle = P.surface;
  ctx.fillRect(0, 0, W, H);

  const listW = 440;
  const listX = ar ? W - M - listW : M + 20;
  const rightW = 760;
  const rightX = ar ? M : W - M - rightW;
  const weights = [400, 500, 600, 700, 800];

  weights.forEach((w, i) => {
    const y = 120 + i * 122;
    T.draw(copy.weights[i], ar ? listX + listW : listX, y + 26, { size: 18, weight: w, color: P.ink, family: famEn });
    T.draw(String(w), ar ? listX + listW : listX, y + 54, { size: 15, weight: 500, color: P.ink, alpha: 0.6, family: famEn });
    T.draw("Aa", ar ? listX : listX + listW, y + 60, { size: 62, weight: w, color: P.ink, align: ar ? "left" : "right", family: famEn });
    ctx.fillStyle = rgba(P.ink, 0.75);
    ctx.fillRect(listX, y + 80, listW, 1.5);
  });

  T.pill(copy.typography, ar ? rightX + rightW : rightX, 110, { color: P.ink, stroke: P.ink });
  const enName = enFont?.name || firstFamily(enFont, "—");
  const nameSize = T.fit(enName, rightW, { size: 88, weight: 800, family: famEn });
  T.draw(enName, ar ? rightX + rightW : rightX, 270, { size: nameSize, weight: 800, color: P.ink, family: famEn });
  T.label(copy.typeLatin, ar ? rightX + rightW : rightX, 308, { color: P.ink, alpha: 0.5, size: 12 });
  T.para(copy.typeDesc, rightX, 360, rightW, { size: 20, weight: 500, color: P.ink, alpha: 0.85, lh: 32, maxLines: 4 });

  ctx.fillStyle = rgba(P.ink, 0.2);
  ctx.fillRect(rightX, 520, rightW, 1.2);

  const arName = arFont?.name || firstFamily(arFont, "—");
  T.label(copy.typeArabic, ar ? rightX + rightW : rightX, 560, { color: P.ink, alpha: 0.5, size: 12 });
  const arSize = T.fit(arName, rightW, { size: 56, weight: 700, family: famAr });
  T.draw(arName, ar ? rightX + rightW : rightX, 624, { size: arSize, weight: 700, color: P.ink, family: famAr });
  T.draw("هوية بصرية تُقرأ بوضوح وثقة", ar ? rightX + rightW : rightX, 690, { size: 34, weight: 500, color: P.ink, alpha: 0.85, family: famAr });

  // mini hierarchy
  T.label(copy.typeHierarchy, ar ? rightX + rightW : rightX, 760, { color: P.accentDark, size: 12 });
  const hx = ar ? rightX + rightW : rightX;
  T.draw(copy.heading, hx, 808, { size: 34, weight: 800, color: P.ink, family: ar ? famAr : famEn });
  const hw = T.measure(copy.heading, { size: 34, weight: 800, family: ar ? famAr : famEn });
  T.draw(copy.subheading, ar ? hx - hw - 34 : hx + hw + 34, 808, { size: 22, weight: 600, color: P.ink, alpha: 0.75, family: ar ? famAr : famEn });
  footer(ctx, T, ar, name, pageNo, total, P.ink);
}

function drawFallbackApps(ctx, T, ar, P, logo, copy, name, frames) {
  frames.forEach((f, i) => {
    ctx.save();
    rr(ctx, f.x, f.y, f.w, f.h, 36);
    ctx.clip();
    if (i === 0) {
      // business card pair
      ctx.fillStyle = P.surface; ctx.fillRect(f.x, f.y, f.w, f.h);
      const cw = 300; const chh = 172;
      const cx = f.x + (f.w - cw) / 2;
      fillRR(ctx, cx, f.y + 90, cw, chh, 14, P.primary);
      if (logo) logo.onBg(P.primary, cx + 70, f.y + 90 + 40, cw - 140, chh - 80);
      fillRR(ctx, cx, f.y + 300, cw, chh, 14, "#FFFFFF", rgba(P.ink, 0.15));
      T.draw(name, cx + (ar ? cw - 22 : 22), f.y + 300 + 56, { size: 21, weight: 800, color: P.ink });
      ctx.fillStyle = P.accent; ctx.fillRect(cx + (ar ? cw - 62 : 22), f.y + 300 + 72, 40, 3);
      [0, 1, 2].forEach((k) => { ctx.fillStyle = rgba(P.ink, 0.22); ctx.fillRect(cx + (ar ? cw - 22 - 150 + k * 12 : 22), f.y + 300 + 104 + k * 16, 150 - k * 12, 5); });
    } else if (i === 1) {
      // social post
      ctx.fillStyle = P.primary; ctx.fillRect(f.x, f.y, f.w, f.h);
      paintMotif(ctx, "rings", f.x, f.y, f.w, f.h, readableOn(P.primary), 0.14, 5);
      const pw = 300;
      fillRR(ctx, f.x + (f.w - pw) / 2, f.y + 92, pw, pw, 26, P.surface);
      if (logo) logo.onBg(P.surface, f.x + (f.w - pw) / 2 + 60, f.y + 92 + 70, pw - 120, pw - 140);
      T.draw(name, f.x + f.w / 2, f.y + 92 + pw + 56, { size: T.fit(name, f.w - 80, { size: 30, weight: 800 }), weight: 800, color: readableOn(P.primary), align: "center" });
      fillRR(ctx, f.x + f.w / 2 - 54, f.y + 92 + pw + 84, 108, 8, 4, P.accent);
    } else {
      // letterhead
      ctx.fillStyle = P.accentSoft; ctx.fillRect(f.x, f.y, f.w, f.h);
      const lw = 290; const lh2 = 410;
      const lx = f.x + (f.w - lw) / 2;
      fillRR(ctx, lx, f.y + 70, lw, lh2, 8, "#FFFFFF");
      if (logo) logo.onBg("#FFFFFF", ar ? lx + lw - 24 - 96 : lx + 24, f.y + 70 + 24, 96, 40);
      ctx.fillStyle = P.accent; ctx.fillRect(lx + 24, f.y + 70 + 84, lw - 48, 3);
      for (let k = 0; k < 9; k += 1) { ctx.fillStyle = rgba(P.ink, 0.16); ctx.fillRect(lx + 24, f.y + 70 + 120 + k * 22, (lw - 48) * (k % 3 === 2 ? 0.6 : 1), 5); }
      ctx.fillStyle = P.primary; ctx.fillRect(lx, f.y + 70 + lh2 - 18, lw, 18);
    }
    ctx.restore();
    T.draw(copy.appFallback[i], f.x + f.w / 2, f.y + f.h + 38, { size: 17, weight: 700, color: P.ink, align: "center", alpha: 0.85 });
  });
}

function pageApplications(ctx, T, ar, P, logo, copy, images, name, total, pageNo, partLabel) {
  ctx.fillStyle = P.surface;
  ctx.fillRect(0, 0, W, H);
  T.pill(copy.applications, ar ? W - M : M, 76, { color: P.ink, stroke: P.ink });
  T.draw(partLabel || copy.applicationsSub, ar ? M : W - M, 112, { size: 20, weight: 600, color: P.ink, alpha: 0.6, align: ar ? "left" : "right" });

  const n = Math.max(1, Math.min(3, images ? images.length : 3));
  const fw = 440;
  const fh = 560;
  const gap = 56;
  const totalW = 3 * fw + 2 * gap;
  const sx = (W - totalW) / 2;
  const sy = 200;
  const frames = [0, 1, 2].map((i) => ({ x: sx + (ar ? 2 - i : i) * (fw + gap), y: sy, w: fw, h: fh }));

  if (!images || !images.length) {
    drawFallbackApps(ctx, T, ar, P, logo, copy, name, frames);
  } else {
    const slots = images.length === 1 ? [frames[1]] : images.length === 2 ? [frames[0], frames[2]].map((f, i) => (ar ? [frames[0], frames[2]][1 - i] : f)) : frames;
    images.slice(0, n).forEach((item, i) => {
      const f = slots[i];
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 36; ctx.shadowOffsetY = 18;
      fillRR(ctx, f.x, f.y, f.w, f.h, 36, "#FFFFFF");
      ctx.restore();
      ctx.save();
      rr(ctx, f.x, f.y, f.w, f.h, 36);
      ctx.clip();
      coverImage(ctx, item.img, f.x, f.y, f.w, f.h);
      ctx.restore();
      if (item.label) T.draw(item.label, f.x + f.w / 2, f.y + f.h + 38, { size: 17, weight: 700, color: P.ink, align: "center", alpha: 0.85 });
    });
  }
  footer(ctx, T, ar, name, pageNo, total, P.ink);
}

function pageRules(ctx, T, ar, P, logo, copy, name, total, pageNo) {
  ctx.fillStyle = P.surface;
  ctx.fillRect(0, 0, W, H);
  T.pill(copy.rules, ar ? W - M : M, 76, { color: P.ink, stroke: P.ink });
  T.draw(copy.rulesSub, ar ? M : W - M, 112, { size: 20, weight: 600, color: P.ink, alpha: 0.6, align: ar ? "left" : "right" });

  const cw = 332;
  const gap = 24;
  const totalW = 4 * cw + 3 * gap;
  const sx = (W - totalW) / 2;
  const y = 190;
  const h = 300;
  for (let i = 0; i < 4; i += 1) {
    const x = sx + (ar ? 3 - i : i) * (cw + gap);
    const bg = i === 3 ? mixHex(P.surface, P.ink, 0.06) : "#FFFFFF";
    fillRR(ctx, x, y, cw, h, 24, bg, rgba(P.ink, 0.1));
    ctx.save();
    rr(ctx, x, y, cw, h, 24);
    ctx.clip();
    if (logo) {
      const bx = x + 46; const by = y + 62; const bw = cw - 92; const bh = h - 150;
      const b = logo.fitBox(bx, by, bw, bh);
      if (i === 0) {
        ctx.drawImage(logo.img || logo.source, b.x - b.w * 0.18, b.y + b.h * 0.15, b.w * 1.36, b.h * 0.7);
      } else if (i === 1) {
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate(-0.28);
        ctx.drawImage(logo.img, -b.w / 2, -b.h / 2, b.w, b.h);
      } else if (i === 2) {
        ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 20; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12;
        ctx.drawImage(logo.img, b.x, b.y, b.w, b.h);
      } else {
        ctx.fillStyle = logo.info.lum > 0.5 ? "#F4F4F4" : "#2B2B2B";
        ctx.fillRect(x, y, cw, h);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(logo.img, b.x, b.y, b.w, b.h);
      }
    }
    ctx.restore();
    // red cross badge
    ctx.save();
    ctx.fillStyle = "#C4281C";
    ctx.beginPath(); ctx.arc(x + (ar ? 34 : cw - 34), y + 34, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    const bxx = x + (ar ? 34 : cw - 34);
    ctx.beginPath(); ctx.moveTo(bxx - 6, y + 28); ctx.lineTo(bxx + 6, y + 40); ctx.moveTo(bxx + 6, y + 28); ctx.lineTo(bxx - 6, y + 40); ctx.stroke();
    ctx.restore();
    T.draw(copy.dont[i], x + cw / 2, y + h + 34, { size: 16, weight: 700, color: P.ink, align: "center" });
  }

  // DO cards
  const dy = 600;
  const dw = 480;
  const dgap = 32;
  const dtotal = 3 * dw + 2 * dgap;
  const dx0 = (W - dtotal) / 2;
  for (let i = 0; i < 3; i += 1) {
    const x = dx0 + (ar ? 2 - i : i) * (dw + dgap);
    fillRR(ctx, x, dy, dw, 170, 22, P.primary);
    const onP = readableOn(P.primary);
    ctx.save();
    ctx.fillStyle = "#1F9D55";
    const bxx = x + (ar ? dw - 46 : 46);
    ctx.beginPath(); ctx.arc(bxx, dy + 46, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(bxx - 7, dy + 46); ctx.lineTo(bxx - 2, dy + 52); ctx.lineTo(bxx + 8, dy + 40); ctx.stroke();
    ctx.restore();
    T.draw(copy.doTitle[i], ar ? x + dw - 80 : x + 80, dy + 53, { size: 21, weight: 800, color: onP });
    T.para(copy.doText[i], x + 30, dy + 94, dw - 60, { size: 15.5, weight: 500, color: onP, alpha: 0.82, lh: 24, maxLines: 3 });
  }
  footer(ctx, T, ar, name, pageNo, total, P.ink);
}

function pageClosing(ctx, T, ar, P, logo, copy, image, name, sector, contact, total, pageNo) {
  paintBackdrop(ctx, P, sector, image, 3, 0.5);
  const b = { x: W / 2 - 240, y: 170, w: 480, h: 210 };
  if (logo) {
    const fb = logo.fitBox(b.x, b.y, b.w, b.h);
    if (logo.info.lum > 0.5 || !logo.info.mono) logo.draw(b.x, b.y, b.w, b.h, { shadow: true });
    else {
      fillRR(ctx, fb.x - 56, fb.y - 40, fb.w + 112, fb.h + 80, 34, rgba(P.surface, 0.94));
      logo.draw(b.x, b.y, b.w, b.h);
    }
  }
  const sz = T.fit(copy.closing, 1100, { size: 54, weight: 800 });
  T.draw(copy.closing, W / 2, 520, { size: sz, weight: 800, color: "#FFFFFF", align: "center" });
  T.para(copy.closingSub, W / 2 - 400, 566, 800, { size: 20, weight: 500, color: "#FFFFFF", alpha: 0.85, align: "center", lh: 30, maxLines: 2 });

  const items = contact.filter(Boolean).slice(0, 4);
  if (items.length) {
    T.label(copy.contact, W / 2, 668, { color: P.accent, align: "center", size: 12 });
    const text = items.join("   •   ");
    T.draw(text, W / 2, 704, { size: T.fit(text, 1200, { size: 20, weight: 600, family: undefined }), weight: 600, color: "#FFFFFF", align: "center", alpha: 0.95, family: undefined });
  }
  T.label(copy.generated, W / 2, 836, { color: "#FFFFFF", alpha: 0.55, align: "center", size: 11 });
  footer(ctx, T, ar, name, pageNo, total, "#FFFFFF");
}

/* -------------------------------------------------------------------- main */

async function ensureFonts(famEn, famAr) {
  if (!document.fonts?.load) return;
  const loads = [];
  [400, 500, 600, 700, 800].forEach((w) => {
    loads.push(document.fonts.load(`${w} 40px ${famEn}`, "Aa Brand"));
    loads.push(document.fonts.load(`${w} 40px ${famAr}`, "هوية بصرية"));
  });
  try { await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 6000))]); } catch { /* use fallbacks */ }
}

/**
 * @returns {Promise<Blob>} the brand guidelines PDF
 */
export async function buildBrandGuidelinesPdf({
  brand, palette, arabicFont, englishFont, logoDataUrl,
  mockupImages = [], heroImage = null, lifestyleImage = null,
  activity = "", businessInfo = {}, ar = false, onProgress,
}) {
  const primary = normalizeHex(palette?.primary, "#1F2937");
  const secondary = normalizeHex(palette?.secondary, "#64748B");
  const accent = normalizeHex(palette?.accent, "#C59D5F");
  const surface = normalizeHex(palette?.surface, "#F7F8FB");
  const inkHex = mixHex(primary, "#000000", 0.62);
  const P = {
    name: String(brand?.brand_name || "brand"),
    primary, secondary, accent, surface,
    inkHex,
    ink: inkHex,
    accentDark: luminance(accent) > 0.5 ? mixHex(accent, "#000000", 0.45) : accent,
    accentSoft: mixHex(accent, "#FFFFFF", 0.7),
  };

  const name = String(brand?.brand_name || "").trim() || (ar ? "اسم العلامة" : "Brand Name");
  const sector = detectSector(activity, name);
  P.sector = sector;
  const tone = describeTone(primary, secondary, ar);
  const copy = buildCopy({ ar, name, activity, sector, tone, enFont: englishFont, arFont: arabicFont });

  const famEn = `${englishFont?.family || "'Plus Jakarta Sans', sans-serif"}, 'Plus Jakarta Sans', Arial, sans-serif`;
  const famAr = `${arabicFont?.family || "'Cairo', sans-serif"}, 'Cairo', Arial, sans-serif`;
  await ensureFonts(famEn, famAr);

  let logo = null;
  if (logoDataUrl) {
    try {
      const img = await loadImage(logoDataUrl);
      const info = analyseLogo(img);
      const painter = makeLogoPainter(document.createElement("canvas").getContext("2d"), img, info);
      logo = { img, info, painter };
    } catch { logo = null; }
  }

  const heroImg = heroImage ? await loadImage(heroImage).catch(() => null) : null;
  const lifeImg = lifestyleImage ? await loadImage(lifestyleImage).catch(() => null) : null;
  const apps = [];
  for (const item of mockupImages) {
    try { apps.push({ img: await loadImage(item.dataUrl), label: item.label || "" }); } catch { /* skip */ }
  }
  const appGroups = [];
  for (let i = 0; i < apps.length; i += 3) appGroups.push(apps.slice(i, i + 3));
  if (!appGroups.length) appGroups.push(null);

  const contact = [businessInfo?.website, businessInfo?.email, businessInfo?.phone, businessInfo?.instagram].map((v) => String(v || "").trim());
  const total = 7 + appGroups.length;
  const year = new Date().getFullYear();

  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H], compress: true, hotfixes: ["px_scaling"] });
  pdf.setProperties({ title: `${name} — ${copy.guidelines}`, subject: copy.guidelines, author: "EYAD AI", creator: "EYAD AI" });

  let pageNo = 0;
  const commit = async (paint) => {
    const { canvas, ctx } = makeCanvas();
    const T = makeText(ctx, ar, famEn, famAr);
    // per-page logo painter bound to this canvas context
    const l = logo ? { ...makeLogoPainter(ctx, logo.img, logo.info), img: logo.img, info: logo.info } : null;
    paint(ctx, T, l);
    pageNo += 1;
    if (pageNo > 1) pdf.addPage([W, H], "landscape");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, W, H, undefined, "FAST");
    onProgress?.(pageNo, total);
    await new Promise((r) => setTimeout(r, 0));
  };

  await commit((ctx, T, l) => pageCover(ctx, T, ar, P, l, heroImg, name, copy, activity, year));
  await commit((ctx, T) => pagePillar(ctx, T, ar, P, copy, sector, name, activity, tone, total, 2));
  await commit((ctx, T, l) => pageLogo(ctx, T, ar, P, l, copy, name, total, 3));
  await commit((ctx, T) => pageColors(ctx, T, ar, P, copy, sector, lifeImg || heroImg, name, total, 4));
  await commit((ctx, T) => pageTypography(ctx, T, ar, P, copy, englishFont, arabicFont, famEn, famAr, name, total, 5));
  for (let i = 0; i < appGroups.length; i += 1) {
    const part = appGroups.length > 1 ? `${copy.applicationsSub} · ${i + 1}/${appGroups.length}` : null;
    await commit((ctx, T, l) => pageApplications(ctx, T, ar, P, l, copy, appGroups[i], name, total, 6 + i, part));
  }
  await commit((ctx, T, l) => pageRules(ctx, T, ar, P, l, copy, name, total, 6 + appGroups.length));
  await commit((ctx, T, l) => pageClosing(ctx, T, ar, P, l, copy, heroImg || lifeImg, name, sector, contact, total, total));

  return pdf.output("blob");
}

export { detectSector };

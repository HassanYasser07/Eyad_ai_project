import React, { useEffect, useMemo, useState } from "react";
import {
  Coffee, PenLine, FileText, ShoppingBag, Package, Store, Smartphone, Monitor,
  Car, Shirt, BookOpen, HardHat, ShieldCheck, BriefcaseBusiness,
  NotebookPen, ReceiptText, Stamp, Save, Layers3, X,
  ArrowLeft, ArrowRight, Mail, Phone, MapPin, Globe2, Instagram, Printer, Download, Loader2
} from "lucide-react";
import { projectService } from "@/services/projectService";
import { runEyadEngine } from "@/services/eyadEngineService";
import { jobService } from "@/services/jobService";
import { assetService } from "@/services/assetService";
import { useAuth } from "@/lib/AuthContext";
import { MOCKUP_IMAGES } from "./mockupImages";
import { MOCKUP_HERO_IMAGE } from "./mockupHeroImage";
import ExportFormats from "@/components/studios/ExportFormats";

const MOCKUP_TYPES = [
  { id: "business-card", ar: "كارت شخصي", en: "Business Card", icon: BriefcaseBusiness },
  { id: "cup", ar: "كوب", en: "Cup", icon: Coffee },
  { id: "vehicle", ar: "سيارة", en: "Vehicle", icon: Car },
  { id: "pen", ar: "قلم", en: "Pen", icon: PenLine },
  { id: "letterhead", ar: "ليتر هيد", en: "Letterhead", icon: FileText },
  { id: "agenda", ar: "أجندة", en: "Agenda", icon: NotebookPen },
  { id: "tshirt", ar: "تيشيرت", en: "T-Shirt", icon: Shirt },
  { id: "cap", ar: "كاب", en: "Cap", icon: ShieldCheck },
  { id: "safety-vest", ar: "سترة سلامة", en: "Safety Vest", icon: ShieldCheck },
  { id: "safety-helmet", ar: "خوذة سيفتي", en: "Safety Helmet", icon: HardHat },
  { id: "paper-bag", ar: "كيس ورقي", en: "Paper Bag", icon: ShoppingBag },
  { id: "packaging", ar: "تغليف", en: "Packaging", icon: Package },
  { id: "social", ar: "سوشيال ميديا", en: "Social Media", icon: Smartphone },
  { id: "website", ar: "موقع إلكتروني", en: "Website", icon: Monitor },
  { id: "signboard", ar: "لافتة", en: "Signboard", icon: Store },
  { id: "worker-uniform", ar: "يونيفورم للعمال", en: "Worker Uniform", icon: HardHat },
  { id: "brochure", ar: "بروشور", en: "Brochure", icon: BookOpen },
  { id: "restaurant-menu", ar: "منيو مطعم", en: "Restaurant Menu", icon: FileText },
  { id: "official-documents", ar: "أوراق رسمية", en: "Official Documents", icon: ReceiptText },
  { id: "company-stamp", ar: "ختم الشركة", en: "Company Stamp", icon: Stamp },
];

const DATA_MOCKUP_IDS = new Set(["business-card", "official-documents", "paper-bag", "vehicle", "letterhead", "agenda", "brochure", "restaurant-menu", "company-stamp"]);

const EMPTY_INFO = {
  companyName: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  instagram: "",
};

const DATA_MOCKUP_LAYOUTS = {
  "business-card": { x: 0.13, y: 0.57, w: 0.74, h: 0.29 },
  "official-documents": { x: 0.14, y: 0.52, w: 0.72, h: 0.32 },
  "paper-bag": { x: 0.20, y: 0.48, w: 0.60, h: 0.32 },
  "vehicle": { x: 0.20, y: 0.46, w: 0.60, h: 0.28 },
  "letterhead": { x: 0.13, y: 0.12, w: 0.74, h: 0.31 },
  "agenda": { x: 0.18, y: 0.48, w: 0.64, h: 0.30 },
  "brochure": { x: 0.13, y: 0.50, w: 0.74, h: 0.31 },
  "restaurant-menu": { x: 0.12, y: 0.14, w: 0.76, h: 0.31 },
  "company-stamp": { x: 0.23, y: 0.55, w: 0.54, h: 0.25 },
};

function getBusinessDataFields(info = {}) {
  return [
    ["Company / Business", String(info.companyName || "")],
    ["Phone", String(info.phone || "")],
    ["Email", String(info.email || "")],
    ["Address", String(info.address || "")],
    ["Website", String(info.website || "")],
    ["Instagram", String(info.instagram || "")],
  ].filter(([, value]) => value.trim());
}

const PRINT_SIZE_PRESETS = {
  "business-card": [90, 50],
  "official-documents": [210, 297],
  "paper-bag": [250, 350],
  vehicle: [3000, 1200],
  letterhead: [210, 297],
  agenda: [148, 210],
  brochure: [210, 297],
  "restaurant-menu": [210, 297],
  "company-stamp": [40, 40],
  cup: [220, 90],
  pen: [120, 8],
  tshirt: [300, 350],
  cap: [100, 60],
  "safety-vest": [250, 300],
  "safety-helmet": [180, 100],
  packaging: [200, 150],
  social: [1080, 1080],
  website: [1440, 900],
  signboard: [1000, 500],
  "worker-uniform": [300, 350],
};

function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char]));
}

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("PRINT_LOGO_EMBED_FAILED"));
    reader.readAsDataURL(blob);
  });
}

async function resolvePrintLogo(brand = {}) {
  const candidates = [
    brand?.logo?.svg_url,
    brand?.logo?.svgUrl,
    brand?.logo?.url,
  ].filter(Boolean);
  for (const url of candidates) {
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) continue;
      const blob = await response.blob();
      const mimeType = String(blob.type || "").toLowerCase();
      if (mimeType.includes("image/") || mimeType.includes("octet-stream")) {
        return await toDataUrl(blob);
      }
    } catch {
      // Continue to the next approved logo source.
    }
  }
  return candidates[candidates.length - 1] || "";
}

function buildEditablePrintSvg({ mockupId, width, height, bleed, brand, palette, info, logoHref }) {
  const w = Math.max(1, Number(width) || 90);
  const h = Math.max(1, Number(height) || 50);
  const b = Math.max(0, Math.min(20, Number(bleed) || 0));
  const totalW = w + b * 2;
  const totalH = h + b * 2;
  const name = String(info?.companyName || brand?.brand_name || "Brand Name").trim();
  const primary = /^#[0-9a-f]{3,8}$/i.test(palette?.primary || "") ? palette.primary : "#123E9B";
  const secondary = /^#[0-9a-f]{3,8}$/i.test(palette?.secondary || "") ? palette.secondary : "#2B78F6";
  const surface = /^#[0-9a-f]{3,8}$/i.test(palette?.surface || "") ? palette.surface : "#FFFFFF";
  const type = MOCKUP_TYPES.find((item) => item.id === mockupId);
  const isCard = mockupId === "business-card";
  const fields = [
    info?.phone,
    info?.email,
    info?.address,
    info?.website,
    info?.instagram,
  ].filter((value) => String(value || "").trim());
  const safeName = xmlEscape(name);
  const logo = logoHref
    ? `<image href="${xmlEscape(logoHref)}" x="${b + w * 0.06}" y="${b + h * 0.14}" width="${w * 0.27}" height="${h * 0.32}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const titleX = b + w * (isCard ? 0.94 : 0.06);
  const titleAnchor = isCard ? "end" : "start";
  const fontSize = Math.max(2.4, Math.min(h * 0.14, w * 0.075));
  const detailStartY = b + h * (isCard ? 0.54 : 0.42);
  const detailStep = Math.max(3.2, Math.min(h * 0.105, 8));
  const details = fields.map((value, index) => {
    const rtl = /[\u0600-\u06FF]/.test(String(value));
    const x = rtl ? b + w * 0.94 : b + w * 0.06;
    const anchor = rtl ? "end" : "start";
    const label = "";
    return `<text x="${x}" y="${detailStartY + index * detailStep}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${Math.max(2, Math.min(h * 0.055, 4.5))}" fill="${primary}" direction="${rtl ? "rtl" : "ltr"}">${label}${xmlEscape(value)}</text>`;
  }).join("");
  const content = isCard
    ? `<rect x="${b}" y="${b}" width="${w}" height="${h}" rx="${Math.min(2, h * 0.035)}" fill="${surface}"/>
       <path d="M ${b} ${b + h * 0.82} L ${b + w * 0.22} ${b + h} L ${b} ${b + h} Z" fill="${secondary}" opacity=".9"/>
       <path d="M ${b + w * 0.82} ${b} L ${b + w} ${b} L ${b + w} ${b + h * 0.2} Z" fill="${primary}"/>
       ${logo}
       <text x="${titleX}" y="${b + h * 0.39}" text-anchor="${titleAnchor}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${primary}" direction="${/[\u0600-\u06FF]/.test(name) ? "rtl" : "ltr"}">${safeName}</text>
       ${details}`
    : `<rect x="${b}" y="${b}" width="${w}" height="${h}" fill="${surface}"/>
       <rect x="${b}" y="${b}" width="${w}" height="${Math.max(2, h * 0.12)}" fill="${primary}"/>
       ${logo}
       <text x="${titleX}" y="${b + h * 0.28}" text-anchor="${titleAnchor}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${primary}" direction="${/[\u0600-\u06FF]/.test(name) ? "rtl" : "ltr"}">${safeName}</text>
       ${details}`;
  const bleedGuide = b > 0
    ? `<rect x="${b}" y="${b}" width="${w}" height="${h}" fill="none" stroke="#ff00aa" stroke-width="0.15" stroke-dasharray="1 1"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}mm" height="${totalH}mm" viewBox="0 0 ${totalW} ${totalH}">
  <title>${safeName} — ${xmlEscape(type?.en || mockupId)} print artwork</title>
  <desc>Editable SVG artwork. Trim size: ${w} x ${h} mm. Bleed: ${b} mm each side. Text and layout shapes are vector elements; logo is embedded when browser access permits.</desc>
  <rect width="${totalW}" height="${totalH}" fill="${secondary}"/>
  ${content}
  ${bleedGuide}
</svg>`;
}

function loadImageForComposition(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("MOCKUP_COMPOSITING_IMAGE_LOAD_FAILED"));
    image.src = source;
  });
}

function fitCanvasFont(ctx, text, maxWidth, startSize, minSize = 12, weight = 500) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    if (ctx.measureText(String(text || "")).width <= maxWidth) return size;
    size -= 1;
  }
  return size;
}

async function composeBusinessCardArtwork(source, info = {}, brand = {}, palette = {}) {
  const image = await loadImageForComposition(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("BUSINESS_CARD_COMPOSITING_CONTEXT_FAILED");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // The AI generates only the environment. EYAD creates the entire
  // business-card surface here, so logo and customer text never pass through
  // image generation and cannot be distorted by the model.
  const cardX = canvas.width * 0.18;
  const cardY = canvas.height * 0.34;
  const cardW = canvas.width * 0.64;
  const cardH = canvas.height * 0.30;
  const radius = Math.round(Math.min(cardW, cardH) * 0.035);
  const primary = palette?.primary || "#5B21B6";
  const secondary = palette?.secondary || "#7C3AED";
  const surface = palette?.surface || "#FFFFFF";
  const logoUrl = brand?.logo?.url || "";

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.20)";
  ctx.shadowBlur = Math.round(canvas.width * 0.018);
  ctx.shadowOffsetY = Math.round(canvas.height * 0.012);
  ctx.fillStyle = surface;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.restore();

  const clip = new Path2D();
  clip.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.save();
  ctx.clip(clip);

  const gradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, secondary);
  ctx.fillStyle = gradient;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cardX + cardW * 0.88, cardY + cardH * 0.18, cardH * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cardX + cardW * 0.08, cardY + cardH * 0.88, cardH * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  let logoImage = null;
  if (logoUrl) {
    try { logoImage = await loadImageForComposition(logoUrl); } catch {}
  }

  const title = String(info.companyName || "").trim();
  const fields = [
    ["Phone", info.phone],
    ["Email", info.email],
    ["Address", info.address],
    ["Website", info.website],
    ["Instagram", info.instagram],
  ].filter(([, value]) => String(value || "").trim());

  if (logoImage) {
    const maxLogoW = cardW * 0.30;
    const maxLogoH = cardH * 0.30;
    const scale = Math.min(maxLogoW / logoImage.width, maxLogoH / logoImage.height);
    const logoW = logoImage.width * scale;
    const logoH = logoImage.height * scale;
    ctx.drawImage(
      logoImage,
      cardX + cardW * 0.08,
      cardY + cardH * 0.12,
      logoW,
      logoH
    );
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.direction = /[\u0600-\u06FF]/.test(title) ? "rtl" : "ltr";
  ctx.textAlign = ctx.direction === "rtl" ? "right" : "left";
  const titleX = ctx.direction === "rtl" ? cardX + cardW * 0.92 : cardX + cardW * 0.08;
  const titleSize = fitCanvasFont(ctx, title, cardW * 0.48, Math.round(cardH * 0.105), 16, 700);
  ctx.font = `700 ${titleSize}px Arial, sans-serif`;
  ctx.fillText(title, titleX, cardY + cardH * 0.58);

  let cursorY = cardY + cardH * 0.68;
  const bodySize = Math.max(13, Math.round(cardH * 0.055));
  for (const [label, raw] of fields) {
    const value = String(raw || "");
    const rtl = /[\u0600-\u06FF]/.test(value);
    ctx.font = `500 ${bodySize}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    const x = rtl ? cardX + cardW * 0.92 : cardX + cardW * 0.08;
    ctx.fillText(value, x, cursorY);
    cursorY += Math.round(bodySize * 1.38);
    if (cursorY > cardY + cardH * 0.96) break;
  }
  ctx.restore();

  // A very subtle paper grain keeps the deterministic artwork from looking like
  // a flat UI rectangle while preserving exact text and logo pixels.
  ctx.save();
  ctx.globalAlpha = 0.018;
  for (let i = 0; i < 900; i += 1) {
    const px = cardX + ((i * 37) % Math.max(1, Math.round(cardW)));
    const py = cardY + ((i * 61) % Math.max(1, Math.round(cardH)));
    ctx.fillStyle = i % 2 ? "#FFFFFF" : "#000000";
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();

  return canvas.toDataURL("image/png");
}

async function composeExactBusinessDataMockup(source, mockupId, info = {}, brand = {}, palette = {}) {
  if (!source || !DATA_MOCKUP_IDS.has(mockupId)) return source;
  if (mockupId === "business-card") return composeBusinessCardArtwork(source, info, brand, palette);
  const fields = getBusinessDataFields(info);
  if (!fields.length) return source;
  const layout = DATA_MOCKUP_LAYOUTS[mockupId] || DATA_MOCKUP_LAYOUTS["business-card"];
  const image = await loadImageForComposition(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("MOCKUP_COMPOSITING_CONTEXT_FAILED");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const x = canvas.width * layout.x;
  const y = canvas.height * layout.y;
  const w = canvas.width * layout.w;
  const h = canvas.height * layout.h;
  const padding = Math.max(18, Math.round(Math.min(w, h) * 0.055));
  const radius = Math.max(14, Math.round(padding * 0.8));

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "rgba(17,24,39,0.16)";
  ctx.lineWidth = Math.max(2, Math.round(canvas.width / 700));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();

  const title = String(info.companyName || "").trim();
  const detailFields = fields.filter(([label]) => label !== "Company / Business");
  const titleSize = Math.max(22, Math.round(canvas.width * 0.028));
  const bodySize = Math.max(16, Math.round(canvas.width * 0.018));
  const lineHeight = Math.round(bodySize * 1.42);
  let cursorY = y + padding + titleSize;
  const valueMaxWidth = w - padding * 2;

  if (title) {
    const titleArabic = /[\u0600-\u06FF]/.test(title);
    const fittedTitle = fitCanvasFont(ctx, title, valueMaxWidth, titleSize, 16, 700);
    ctx.font = `700 ${fittedTitle}px Arial, sans-serif`;
    ctx.fillStyle = "#111827";
    ctx.textAlign = titleArabic ? "right" : "left";
    ctx.direction = titleArabic ? "rtl" : "ltr";
    ctx.fillText(title, titleArabic ? x + w - padding : x + padding, cursorY);
    cursorY += Math.round(fittedTitle * 1.45);
  }

  for (const [label, rawValue] of detailFields) {
    const value = String(rawValue);
    if (!value) continue;
    const isArabic = /[\u0600-\u06FF]/.test(value);
    const labelText = `${label}:`;
    const labelWidth = ctx.measureText(labelText + " ").width;
    const fittedBody = fitCanvasFont(ctx, value, valueMaxWidth - Math.min(labelWidth, valueMaxWidth * 0.28), bodySize, 12, 500);
    ctx.font = `700 ${fittedBody}px Arial, sans-serif`;
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(labelText, x + padding, cursorY);
    const actualLabelWidth = ctx.measureText(labelText + " ").width;
    ctx.font = `500 ${fittedBody}px Arial, sans-serif`;
    ctx.fillStyle = "#111827";
    ctx.textAlign = isArabic ? "right" : "left";
    ctx.direction = isArabic ? "rtl" : "ltr";
    const valueX = isArabic ? x + w - padding : x + padding + actualLabelWidth;
    ctx.fillText(value, valueX, cursorY);
    cursorY += Math.max(lineHeight, fittedBody * 1.42);
  }
  ctx.restore();
  return canvas.toDataURL("image/png");
}

function MockupCanvas({ type, brand, palette, background, logoScale, logoPosition, info }) {
  const logo = brand?.logo?.url;
  const name = info?.companyName || brand?.brand_name || "Brand Name";
  const primary = palette?.primary || "#123E9B";
  const secondary = palette?.secondary || "#2B78F6";
  const surface = palette?.surface || "#F0F6FF";

  const logoStyle = {
    width: `${logoScale}%`,
    transform: `translate(${logoPosition.x}px, ${logoPosition.y}px)`,
  };

  return (
    <div
      className={`mockup-scene mockup-scene--${type}`}
      style={{ "--mock-primary": primary, "--mock-secondary": secondary, "--mock-surface": surface }}
    >
      <div className="mockup-scene-bg" style={{ background: background?.value }} />
      <div className="mockup-object">
        {logo ? (
          <img src={logo} alt="" className="mockup-logo" style={logoStyle} />
        ) : (
          <div className="mockup-logo-placeholder" style={{ color: primary }}>{name}</div>
        )}

        {type === "business-card" && (
          <div className="mockup-card-copy">
            <strong>{name}</strong>
            <span>{info?.phone || "+971 00 000 0000"}</span>
            <span>{info?.email || "email@brand.com"}</span>
          </div>
        )}
        {type === "cup" && <div className="mockup-product-copy">{name}</div>}
        {type === "pen" && <div className="mockup-pen-copy">{name}</div>}
        {type === "letterhead" && (
          <div className="mockup-letter-copy">
            <strong>{name}</strong>
            <span>{info?.address || "Business Address"}</span>
            <i/><i/><i/><i/>
          </div>
        )}
        {type === "shopping-bag" && <div className="mockup-product-copy">{name}</div>}
        {type === "packaging" && <div className="mockup-product-copy">{name}</div>}
        {type === "signboard" && <div className="mockup-sign-copy">{name}</div>}
        {type === "social" && (
          <div className="mockup-social-copy">
            <b>{name}</b>
            <span>{info?.instagram || "@brand"}</span>
          </div>
        )}
        {type === "website" && (
          <div className="mockup-screen-copy">
            <b>{name}</b>
            <span>{info?.website || "www.brand.com"}</span>
          </div>
        )}
        {type === "vehicle" && <div className="mockup-vehicle-copy">{name}</div>}
        {type === "tshirt" && <div className="mockup-product-copy">{name}</div>}
        {type === "building" && <div className="mockup-building-copy">{name}</div>}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", dir }) {
  return (
    <label className="mockup-form-field">
      <span><Icon className="w-3.5 h-3.5" />{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} />
    </label>
  );
}

export default function MockupEngine({ brand, palette, background, projectId, onSave, ar, hasApprovedLogo, onRequireApprovedLogo }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState("gallery");
  const [businessInfo, setBusinessInfo] = useState(EMPTY_INFO);
  const [saved, setSaved] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [finalMockupImage, setFinalMockupImage] = useState(null);
  const [compositing, setCompositing] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [printWidth, setPrintWidth] = useState(90);
  const [printHeight, setPrintHeight] = useState(50);
  const [printBleed, setPrintBleed] = useState(3);
  const [creatingPrintFile, setCreatingPrintFile] = useState(false);
  const [printFileError, setPrintFileError] = useState("");
  const { isAnonymous, requireAccount } = useAuth();

  const MOCKUP_MAX_WAIT_MS = 240000;
  const MOCKUP_POLL_MS = 2000;

  useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    setLoadingInfo(true);
    projectService.get(projectId)
      .then((project) => {
        if (!active) return;
        const savedInfo = project?.project_data?.mockup_business_info || {};
        setBusinessInfo({
          ...EMPTY_INFO,
          ...savedInfo,
          // The saved Brand Source of Truth always wins for the business name.
          companyName: brand?.brand_name || savedInfo.companyName || "",
        });
      })
      .catch(() => {})
      .finally(() => active && setLoadingInfo(false));
    return () => { active = false; };
  }, [projectId, brand?.brand_name]);

  const current = useMemo(
    () => MOCKUP_TYPES.find((item) => item.id === selected) || MOCKUP_TYPES[0],
    [selected]
  );

  const openGallery = () => {
    if (!hasApprovedLogo) {
      onRequireApprovedLogo?.();
      return;
    }
    setGalleryOpen(true);
    setStep("gallery");
    setSelected(null);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
    setStep("gallery");
    setSelected(null);
    setFinalMockupImage(null);
    setCompositing(false);
  };

  const chooseMockup = (id) => {
    if (!hasApprovedLogo) {
      onRequireApprovedLogo?.();
      return;
    }
    setSelected(id);
    const printSize = PRINT_SIZE_PRESETS[id] || [90, 50];
    setPrintWidth(printSize[0]);
    setPrintHeight(printSize[1]);
    setPrintFileError("");
    setGeneratedImage(null);
    setFinalMockupImage(null);
    setGenerationError("");
    setBusinessInfo((prev) => ({ ...prev, companyName: prev.companyName || brand?.brand_name || "" }));
    setStep(DATA_MOCKUP_IDS.has(id) ? "form" : "preview");
    if (!DATA_MOCKUP_IDS.has(id)) window.setTimeout(() => generateMockup(id), 0);
  };

  const continueToPreview = async () => {
    if (projectId && DATA_MOCKUP_IDS.has(selected)) {
      try {
        const project = await projectService.get(projectId);
        await projectService.update(projectId, {
          project_data: {
            ...(project?.project_data || {}),
            mockup_business_info: { ...businessInfo },
          },
        });
      } catch {}
    }
    generateMockup(selected);
  };

  const backToGallery = () => {
    setStep("gallery");
    setSelected(null);
    setGeneratedImage(null);
    setFinalMockupImage(null);
    setJobId(null);
    setGenerating(false);
    setCompositing(false);
    setGenerationError("");
  };

  async function generateMockup(mockupId = selected) {
    if (!mockupId || generating) return;
    if (isAnonymous) {
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    setSelected(mockupId);
    setGenerating(true);
    setGenerationError("");
    setGeneratedImage(null);
    setFinalMockupImage(null);
    setCompositing(false);
    setStep("generating");
    try {
      const type = MOCKUP_TYPES.find((item) => item.id === mockupId);
      const data = await runEyadEngine({
        message: ar ? `أنشئ موك أب واقعي احترافي لـ${type?.ar || "هذا المنتج"} باستخدام الشعار المعتمد.` : `Create a photorealistic professional ${type?.en || "brand mockup"} using the approved logo.`,
        projectId: projectId || null,
        studioId: "ai-images",
        language: ar ? "ar" : "en",
        action: "generate",
        referenceImage: brand?.logo?.url || null,
        designOptions: {
          mockup_type: mockupId,
          mockup_name: type?.en || mockupId,
          approved_logo_url: brand?.logo?.url || null,
          brand_name: brand?.brand_name || businessInfo.companyName || "",
          palette,
          background,
          business_info: DATA_MOCKUP_IDS.has(mockupId) ? businessInfo : null,
        },
      });
      if (data?.project?.id && !projectId) {
        window.history.replaceState({}, "", `${window.location.pathname}?project=${encodeURIComponent(data.project.id)}`);
      }
      if (data?.status === "generated") {
        const resultImage = data?.images?.[0] || data?.image || null;
        setGeneratedImage(resultImage);
        if (DATA_MOCKUP_IDS.has(mockupId) && mockupId !== "business-card") {
          const source = resultImage?.data_url || resultImage?.url || "";
          if (!source) throw new Error("MOCKUP_RESULT_IMAGE_MISSING");
          setCompositing(true);
          try {
            const exactImage = await composeExactBusinessDataMockup(source, mockupId, businessInfo, brand, palette);
            setFinalMockupImage(exactImage);
          } finally {
            setCompositing(false);
          }
        } else {
          // Business cards are now generated as complete finished artwork by
          // the image model, including the approved logo and user-entered data.
          setFinalMockupImage(null);
        }
        setStep("result");
        setGenerating(false);
        return;
      }
      if (data?.job_id) {
        setJobId(data.job_id);
        return;
      }
      throw new Error(data?.error || "GENERATION_NOT_STARTED");
    } catch (error) {
      setGenerating(false);
      setGenerationError(error?.message || "GENERATION_FAILED");
      setStep("result");
    }
  }

  useEffect(() => {
    if (!jobId || !generating) return undefined;
    let active = true;
    const startedAt = Date.now();

    const poll = async () => {
      if (!active) return;
      try {
        const data = await jobService.pollGeneration(jobId);
        if (!active) return;
        if (data?.status === "generated") {
          const resultImage = data?.images?.[0] || data?.image || null;
          setGeneratedImage(resultImage);
          if (DATA_MOCKUP_IDS.has(selected) && selected !== "business-card") {
            const source = resultImage?.data_url || resultImage?.url || "";
            if (!source) {
              setGenerationError(ar ? "الصورة الناتجة غير متاحة للتركيب النهائي." : "The generated image is unavailable for final compositing.");
            } else {
              setCompositing(true);
              try {
                const exactImage = await composeExactBusinessDataMockup(source, selected, businessInfo, brand, palette);
                setFinalMockupImage(exactImage);
              } catch {
                setGenerationError(ar ? "تعذر تركيب بيانات الشركة بدقة على الموك أب." : "The exact business data could not be composited onto the mockup.");
              } finally {
                setCompositing(false);
              }
            }
          } else {
            setFinalMockupImage(null);
            setFinalMockupImage(null);
          }
          setGenerating(false);
          setStep("result");
          setJobId(null);
          return;
        }
        if (data?.error || data?.status === "failed") {
          const raw = String(data?.detail || data?.error || "GENERATION_FAILED");
          const friendly = raw === "MOCKUP_GENERATION_TIMEOUT"
            ? (ar ? "التوليد تجاوز الوقت المسموح. تم إيقاف العملية بدون انتظار إضافي." : "Mockup generation exceeded the safe time limit and was stopped.")
            : raw === "OPENAI_RESPONSE_POLL_FAILED"
              ? (ar ? "تعذر متابعة نتيجة التوليد من مزود الصور." : "The image provider could not be reached while checking the result.")
              : raw;
          setGenerationError(friendly);
          setGenerating(false);
          setStep("result");
          setJobId(null);
          return;
        }
      } catch {
        // Transient polling/network errors do not fail the generation. The
        // durable backend job remains authoritative and the next poll retries.
      }

      if (Date.now() - startedAt >= MOCKUP_MAX_WAIT_MS && active) {
        setGenerationError(ar ? "التوليد استغرق وقتًا أطول من المتوقع وتم إيقاف الانتظار." : "Generation took longer than expected and the wait was stopped.");
        setGenerating(false);
        setStep("result");
        setJobId(null);
      }
    };

    poll();
    const timer = window.setInterval(poll, MOCKUP_POLL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, generating, ar]);

  const save = async () => {
    const sourceImage = finalMockupImage || generatedImage?.data_url || generatedImage?.url;
    if (!sourceImage || compositing) return;
    let imageUrl = sourceImage;
    let assetId = generatedImage?.asset_id || null;
    if (DATA_MOCKUP_IDS.has(selected) && sourceImage.startsWith("data:")) {
      try {
        const blob = await (await fetch(sourceImage)).blob();
        const uploaded = await assetService.uploadImageAsset({
          projectId,
          file: blob,
          name: `${selected}-exact-data-mockup.png`,
          metadata: {
            source: "mockup-exact-data-composite",
            mockup_type: selected,
            business_info: { ...businessInfo },
            source_generated_asset_id: generatedImage?.asset_id || null,
          },
        });
        imageUrl = uploaded.url;
        assetId = uploaded.id;
      } catch (error) {
        console.error("Mockup exact-data asset upload failed", error);
      }
    }
    const item = {
      id: `${selected}-${Date.now()}`,
      type: selected,
      imageUrl,
      assetId,
      businessInfo: DATA_MOCKUP_IDS.has(selected) ? businessInfo : {},
      createdAt: new Date().toISOString(),
      brandName: businessInfo.companyName || brand?.brand_name || "",
      generation: "openai-gpt-image-2",
    };
    await onSave?.(item);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const updateInfo = (key, value) => {
    // Company/business name is owned by Brand Source of Truth.
    if (key === "companyName") return;
    setBusinessInfo((prev) => ({ ...prev, [key]: value }));
  };

  const createPrintFile = async () => {
    if (!selected || creatingPrintFile) return;
    const width = Number(printWidth);
    const height = Number(printHeight);
    const bleed = Number(printBleed);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 10000 || height > 10000) {
      setPrintFileError(ar ? "أدخل مقاسًا صحيحًا أكبر من صفر وبحد أقصى 10000 مم." : "Enter valid dimensions greater than zero and no larger than 10000 mm.");
      return;
    }
    if (!Number.isFinite(bleed) || bleed < 0 || bleed > 20) {
      setPrintFileError(ar ? "قيمة النزيف يجب أن تكون بين 0 و20 مم." : "Bleed must be between 0 and 20 mm.");
      return;
    }
    setCreatingPrintFile(true);
    setPrintFileError("");
    try {
      const logoHref = await resolvePrintLogo(brand);
      const svg = buildEditablePrintSvg({
        mockupId: selected,
        width,
        height,
        bleed,
        brand,
        palette,
        info: { ...businessInfo, companyName: brand?.brand_name || businessInfo.companyName },
        logoHref,
      });
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `eyad-${selected}-print-${width}x${height}mm.svg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (error) {
      console.error("EYAD print SVG creation failed", error);
      setPrintFileError(ar ? "تعذر إنشاء ملف الطباعة. حاول مرة أخرى." : "Could not create the print file. Please try again.");
    } finally {
      setCreatingPrintFile(false);
    }
  };

  return (
    <>
      <section className="vi-section mockup-engine">
        <div className="vi-section-head">
          <div className="vi-section-title">
            <span className="vi-section-icon"><Layers3 className="w-4 h-4" /></span>
            <h2>{ar ? "موك أب" : "Mockup"}</h2>
          </div>
          <span className="vi-section-hint">{ar ? "اختر Mockup بصريًا واعرض الهوية ببيانات نشاطك" : "Choose a visual mockup and apply your real business data"}</span>
        </div>

        <button type="button" className="mockup-launch-card" onClick={openGallery}>
          <img
            className="mockup-launch-hero-image"
            src={MOCKUP_HERO_IMAGE}
            alt={ar ? "قسم الموك أب" : "Mockup"}
          />
          <div className="mockup-launch-overlay" />
          <div className="mockup-launch-copy">
            <div className="mockup-launch-top-badge"><Layers3 /> <span>{ar ? "موك أب" : "Mockup"}</span></div>
            <strong>{ar ? "موك أب" : "Mockup"}</strong>
            <span className="mockup-launch-description">
              {ar ? "اختر نوع الموك أب بصريًا واعرض هويتك باحتراف" : "Choose a visual mockup and present your identity professionally"}
            </span>
            <span className="mockup-launch-action"><ArrowLeft /></span>
            <div className="mockup-launch-bottom-badge">
              <Layers3 />
              <div><strong>{ar ? "20 موك أب جاهز" : "20 READY MOCKUPS"}</strong><span>{ar ? "لعرض بيانات شركتك بشكل احترافي" : "Present your company details professionally"}</span></div>
            </div>
          </div>
        </button>

        <p className="mockup-note">
          {ar
            ? "اختر نوع التطبيق أولًا، ثم أدخل بيانات الشركة قبل إنشاء العرض. الـ Mockup للعرض والتقديم فقط."
            : "Choose the application first, then enter company details before creating the presentation. Mockups are presentation-only."}
        </p>
      </section>

      {galleryOpen && (
        <div className="mockup-modal-backdrop" role="dialog" aria-modal="true">
          <div className={`mockup-modal ${step === "gallery" ? "is-gallery" : ""}`}>
            <div className="mockup-modal-head">
              <div>
                <strong>
                  {step === "gallery"
                    ? (ar ? "موك أب" : "Mockup")
                    : step === "form"
                      ? (ar ? `بيانات ${current.ar}` : `${current.en} Details`)
                      : (ar ? current.ar : current.en)}
                </strong>
                <span>
                  {step === "gallery"
                    ? (ar ? "اختر موك أب بصريًا" : "Choose a visual mockup")
                    : step === "form"
                      ? (ar ? "هذه البيانات ستظهر داخل الـ Mockup" : "These details will appear inside the mockup")
                      : (ar ? "معاينة حقيقية ببيانات نشاطك" : "Live preview with your business data")}
                </span>
              </div>
              <button type="button" className="mockup-modal-close" onClick={closeGallery} aria-label="Close"><X /></button>
            </div>

            {step === "gallery" && (
              <div className="mockup-gallery">
                {MOCKUP_TYPES.map((item) => (
                  <button key={item.id} type="button" className="mockup-gallery-card" onClick={() => chooseMockup(item.id)}>
                    <div className="mockup-gallery-thumb">
                      {MOCKUP_IMAGES[item.id] ? (
                        <img
                          src={MOCKUP_IMAGES[item.id]}
                          alt={ar ? item.ar : item.en}
                          className="mockup-gallery-image"
                          loading="lazy"
                        />
                      ) : (
                        <MockupCanvas
                          type={item.id}
                          brand={brand}
                          palette={palette}
                          background={background}
                          logoScale={44}
                          logoPosition={{ x: 0, y: 0 }}
                          info={businessInfo}
                        />
                      )}
                    </div>
                    <div className="mockup-gallery-label">
                      <span>{ar ? item.ar : item.en}</span>
                      <item.icon className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === "form" && DATA_MOCKUP_IDS.has(selected) && (
              <div className="mockup-form-view">
                <div className="mockup-form-intro">
                  <div className="mockup-form-preview mockup-business-details-logo">
                    <img
                      src={MOCKUP_IMAGES["business-card"]}
                      alt={ar ? "معاينة كارت شخصي" : "Business card preview"}
                      className="mockup-business-details-logo-img"
                    />
                    {brand?.logo?.url && (
                      <img
                        src={brand.logo.url}
                        alt={brand?.brand_name || "Approved logo"}
                        className="mockup-business-details-logo-overlay"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div>
                    <strong>{ar ? "بيانات النشاط" : "Business details"}</strong>
                    <span>{ar ? "أدخل البيانات مرة واحدة، وسيحتفظ بها المشروع لاستخدامها في التطبيقات التالية." : "Enter them once. The project keeps them for the next applications."}</span>
                  </div>
                </div>

                {loadingInfo && <div className="mockup-form-loading">{ar ? "جاري تحميل بيانات النشاط..." : "Loading saved business details..."}</div>}

                <div className="mockup-form-grid">
                  <Field icon={BriefcaseBusiness} label={ar ? "اسم الشركة / النشاط" : "Company / Business name"} value={brand?.brand_name || businessInfo.companyName} onChange={() => {}} dir={ar ? "rtl" : "ltr"} />
                  <Field icon={Phone} label={ar ? "رقم الهاتف" : "Phone"} value={businessInfo.phone} onChange={(v) => updateInfo("phone", v)} type="tel" dir="ltr" />
                  <Field icon={Mail} label={ar ? "البريد الإلكتروني" : "Email"} value={businessInfo.email} onChange={(v) => updateInfo("email", v)} type="email" dir="ltr" />
                  <Field icon={MapPin} label={ar ? "العنوان" : "Address"} value={businessInfo.address} onChange={(v) => updateInfo("address", v)} dir={ar ? "rtl" : "ltr"} />
                  <Field icon={Globe2} label={ar ? "الموقع الإلكتروني" : "Website"} value={businessInfo.website} onChange={(v) => updateInfo("website", v)} dir="ltr" />
                  <Field icon={Instagram} label={ar ? "حساب إنستغرام" : "Instagram"} value={businessInfo.instagram} onChange={(v) => updateInfo("instagram", v)} dir="ltr" />
                </div>

                <div className="mockup-form-actions">
                  <button type="button" className="mockup-secondary-btn" onClick={backToGallery}>
                    <ArrowRight className="w-4 h-4" /> {ar ? "رجوع للتطبيقات" : "Back to applications"}
                  </button>
                  <button type="button" className="vi-apply-btn" onClick={continueToPreview}>
                    {ar ? "معاينة الـ Mockup" : "Preview Mockup"} <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "generating" && (
              <div className="mockup-ai-state">
                <div className="mockup-ai-orb"><span /><span /><span /><span /><span /></div>
                <strong>{ar ? "إياد بيجهز الموك أب" : "EYAD is generating the mockup"}</strong>
                <span>{ar ? "يتم تركيب الشعار المعتمد على المنتج بشكل واقعي وإخراج صورة عالية الجودة." : "Applying the approved logo realistically and creating a high-quality image."}</span>
                <div className="mockup-ai-progress"><i /></div>
              </div>
            )}

            {step === "result" && (
              <div className="mockup-ai-result">
                {generationError ? (
                  <div className="mockup-ai-error">
                    <strong>{ar ? "تعذر إنشاء الموك أب" : "Mockup generation failed"}</strong>
                    <span>{generationError}</span>
                    <button type="button" className="vi-apply-btn" onClick={() => generateMockup(selected)}>{ar ? "إعادة التوليد" : "Generate again"}</button>
                  </div>
                ) : generatedImage ? (
                  <>
                    <div className="mockup-ai-image-wrap">
                      <img src={finalMockupImage || generatedImage.data_url || generatedImage.url} alt={ar ? current.ar : current.en} />
                    </div>

                    <div className="mockup-ai-result-copy">
                      <strong>{ar ? `موك أب ${current.ar} جاهز` : `${current.en} mockup is ready`}</strong>
                      <span>{ar ? "EYAD يستخدم الشعار المعتمد وبيانات نشاطك لإنشاء موك أب احترافي وواقعي." : "EYAD uses your approved logo and business data to create a professional, photorealistic mockup."}</span>
                    </div>

                    <section
                      className="mockup-print-file-panel"
                      style={{ margin: "16px 0", padding: 16, border: "1px solid #dbe4ef", borderRadius: 18, background: "rgba(255,255,255,.88)" }}
                      aria-label={ar ? "إنشاء ملف الطباعة" : "Create print file"}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <Printer size={22} color="#2875d0" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: "block", fontSize: 17, color: "#18324c" }}>{ar ? "إنشاء ملف الطباعة" : "Create print file"}</strong>
                          <span style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 3 }}>
                            {ar ? "ملف SVG بعناصر متجهة ونصوص قابلة للتحرير — وليس صورة الموك أب." : "Editable SVG artwork with vector shapes and text — not the mockup photo."}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
                        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#526579" }}>
                          {ar ? "العرض (مم)" : "Width (mm)"}
                          <input type="number" min="1" max="10000" step="1" value={printWidth} onChange={(event) => setPrintWidth(event.target.value)} style={{ width: "100%", minWidth: 0, padding: "10px 8px", border: "1px solid #d7e0ea", borderRadius: 10, background: "#fff", color: "#18324c" }} />
                        </label>
                        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#526579" }}>
                          {ar ? "الارتفاع (مم)" : "Height (mm)"}
                          <input type="number" min="1" max="10000" step="1" value={printHeight} onChange={(event) => setPrintHeight(event.target.value)} style={{ width: "100%", minWidth: 0, padding: "10px 8px", border: "1px solid #d7e0ea", borderRadius: 10, background: "#fff", color: "#18324c" }} />
                        </label>
                        <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#526579" }}>
                          {ar ? "النزيف (مم)" : "Bleed (mm)"}
                          <input type="number" min="0" max="20" step="0.5" value={printBleed} onChange={(event) => setPrintBleed(event.target.value)} style={{ width: "100%", minWidth: 0, padding: "10px 8px", border: "1px solid #d7e0ea", borderRadius: 10, background: "#fff", color: "#18324c" }} />
                        </label>
                      </div>
                      {printFileError && <p role="alert" style={{ color: "#b42318", fontSize: 13, margin: "0 0 10px" }}>{printFileError}</p>}
                      <button
                        type="button"
                        onClick={createPrintFile}
                        disabled={creatingPrintFile}
                        className="vi-apply-btn"
                        style={{ width: "100%", justifyContent: "center", minHeight: 54, opacity: creatingPrintFile ? 0.7 : 1 }}
                      >
                        {creatingPrintFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        {creatingPrintFile ? (ar ? "جاري إنشاء ملف الطباعة..." : "Creating print file...") : (ar ? "إنشاء ملف الطباعة" : "Create print file")}
                      </button>
                    </section>

                    <div className="mockup-form-actions">
                      <button type="button" className="mockup-secondary-btn" onClick={backToGallery}><ArrowRight className="w-4 h-4" /> {ar ? "اختيار موك أب آخر" : "Choose another"}</button>
                      <div className="mockup-actions">
                        <button type="button" className="vi-apply-btn mockup-save-btn" onClick={save}><Save className="w-4 h-4" /> {saved ? (ar ? "تم الحفظ" : "Saved") : (ar ? "اعتماد وحفظ" : "Approve & Save")}</button>
                        <div className="mockup-export-holder">
                          <ExportFormats
                            sourceUrl={finalMockupImage || generatedImage.data_url || generatedImage.url}
                            filenameBase={"eyad-" + selected + "-mockup"}
                            ar={ar}
                            includePng={true}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

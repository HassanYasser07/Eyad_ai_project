import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Archive, Check, Download, FileJson, FileText, Loader2, PackageCheck } from "lucide-react";
import { projectService } from "@/services/projectService";
import { runEyadEngine } from "@/services/eyadEngineService";

function safeName(value) {
  return String(value || "brand")
    .trim()
    .replace(/[^\\w\\u0600-\\u06FF-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "brand";
}

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function addRemoteFile(zip, url, path) {
  if (!url) return { added: false, reason: "missing-url" };
  try {
    const response = await fetch(url);
    if (!response.ok) return { added: false, reason: "http-" + response.status };
    const blob = await response.blob();
    zip.file(path, blob);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { added: true, dataUrl, type: blob.type || "" };
  } catch {
    return { added: false, reason: "fetch-failed" };
  }
}

function getMockupImageUrl(item) {
  return item?.previewUrl || item?.preview_url || item?.imageUrl || item?.image_url || item?.url || item?.asset_url || null;
}

function svgEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value, maxChars = 58) {
  const words = String(value || "").split(/\\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if (!word) return;
    const next = line ? line + " " + word : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

async function svgPageToPng(svg, width = 1190, height = 1684) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png", 1);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function buildFourPageBrandProfilePdf({ brand, palette, arabicFont, englishFont, background, logoDataUrl, mockupDataUrls = [], ar }) {
  const W = 1190;
  const H = 1684;
  const primary = palette?.primary || "#1f2937";
  const secondary = palette?.secondary || "#64748b";
  const accent = palette?.accent || "#c59d5f";
  const surface = palette?.surface || "#f7f8fb";
  const name = brand?.brand_name || (ar ? "اسم العلامة" : "Brand Name");
  const arabicName = arabicFont?.name || arabicFont?.family || "—";
  const englishName = englishFont?.name || englishFont?.family || "—";
  const paletteName = palette?.name?.ar || palette?.name?.en || (ar ? "لوحة الهوية" : "Brand Palette");
  const swatches = (palette?.swatches || [primary, secondary, accent, surface]).slice(0, 6);
  const fontFamilyAr = arabicFont?.family || "Cairo";
  const fontFamilyEn = englishFont?.family || "Plus Jakarta Sans";
  const dir = ar ? "rtl" : "ltr";
  const pageLabel = (n, title) => `
    <text x="88" y="104" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="${svgEscape(accent)}" letter-spacing="3">${svgEscape(String(n).padStart(2, "0"))} / EYAD AI</text>
    <text x="88" y="154" font-family="Arial,sans-serif" font-size="42" font-weight="800" fill="${svgEscape(primary)}">${svgEscape(title)}</text>
  `;
  const bodyLines = (text, x, y, size = 24, max = 60, lineHeight = 38, anchor = "start") =>
    wrapText(text, max).slice(0, 7).map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" text-anchor="${anchor}" font-family="${svgEscape(ar ? fontFamilyAr : fontFamilyEn)},Arial,sans-serif" font-size="${size}" fill="#556070">${svgEscape(line)}</text>`).join("");
  const cards = (items, startX, startY, cardW, cardH, gapX, gapY) => items.map((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    return `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="28" fill="#ffffff" stroke="#e4e8ef"/>
      <rect x="${x + 26}" y="${y + 26}" width="86" height="86" rx="20" fill="${svgEscape(item.color)}"/>
      <text x="${x + 136}" y="${y + 58}" font-family="Arial,sans-serif" font-size="21" font-weight="800" fill="#1b2430">${svgEscape(item.label)}</text>
      <text x="${x + 136}" y="${y + 90}" font-family="Arial,sans-serif" font-size="19" fill="#657184">${svgEscape(item.color)}</text>`;
  }).join("");

  const page1 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" direction="${dir}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${svgEscape(primary)}"/><stop offset="65%" stop-color="${svgEscape(secondary)}"/><stop offset="100%" stop-color="${svgEscape(accent)}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="#f5f6f8"/>
    <rect width="${W}" height="920" fill="url(#g)"/>
    <circle cx="1040" cy="170" r="310" fill="none" stroke="#ffffff" stroke-opacity=".14" stroke-width="2"/>
    <circle cx="1040" cy="170" r="220" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="2"/>
    <text x="88" y="120" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" letter-spacing="4">VISUAL IDENTITY PROFILE</text>
    <text x="88" y="265" font-family="${svgEscape(ar ? fontFamilyAr : fontFamilyEn)},Arial,sans-serif" font-size="72" font-weight="800" fill="#ffffff">${svgEscape(name)}</text>
    <text x="88" y="320" font-family="Arial,sans-serif" font-size="24" fill="#ffffff" fill-opacity=".82">EYAD AI • Brand Identity System</text>
    ${logoDataUrl ? `<image href="${logoDataUrl}" x="88" y="400" width="420" height="280" preserveAspectRatio="xMidYMid meet"/>` : `<text x="298" y="545" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="800" fill="#ffffff">LOGO</text>`}
    <rect x="88" y="760" width="1014" height="1" fill="#ffffff" fill-opacity=".25"/>
    <text x="88" y="820" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="2">01 / BRAND OVERVIEW</text>
    <text x="88" y="1000" font-family="${svgEscape(ar ? fontFamilyAr : fontFamilyEn)},Arial,sans-serif" font-size="38" font-weight="800" fill="${svgEscape(primary)}">${svgEscape(ar ? "فكرة الهوية" : "Identity Concept")}</text>
    ${bodyLines(ar ? "هذه الهوية مبنية حول شخصية بصرية متماسكة تجمع بين الشعار والألوان والخطوط والتطبيقات. الهدف هو الحفاظ على حضور واضح، احترافي وسهل التذكر في كل نقطة تواصل." : "This identity is built as a coherent visual system combining the logo, palette, typography and applications. The goal is a clear, professional and memorable presence across every touchpoint.", 88, 1055, 24, 78, 39)}
    <rect x="88" y="1330" width="1014" height="190" rx="34" fill="#ffffff" stroke="#e4e8ef"/>
    <text x="122" y="1385" font-family="Arial,sans-serif" font-size="20" font-weight="800" fill="${svgEscape(accent)}">${svgEscape(ar ? "قاعدة أساسية" : "Core Principle")}</text>
    ${bodyLines(ar ? "الشعار المعتمد هو مصدر الحقيقة البصرية. لا يتم إعادة رسمه أو تغيير نسبه أو ألوانه." : "The approved logo is the visual source of truth. Never redraw it or alter its proportions or approved colors.", 122, 1435, 22, 82, 34)}
  </svg>`;

  const colorItems = swatches.map((c, i) => ({ label: i === 0 ? "Primary" : i === 1 ? "Secondary" : i === 2 ? "Accent" : i === 3 ? "Surface" : "Swatch " + (i + 1), color: c }));
  const page2 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f5f6f8"/>
    <rect x="0" y="0" width="${W}" height="280" fill="${svgEscape(surface)}"/>
    ${pageLabel(2, ar ? "نظام الألوان" : "Color System")}
    ${bodyLines(ar ? "لوحة الألوان هي اللغة المرئية الأساسية للعلامة. استخدم القيم المعتمدة كما هي، وحافظ على التوازن بين اللون الرئيسي والداعم والمساحات المحايدة." : "The color palette is the core visual language of the brand. Use the approved values consistently and balance the primary, supporting and neutral tones.", 88, 225, 23, 82, 36)}
    <text x="88" y="455" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#667085">${svgEscape(paletteName)}</text>
    ${cards(colorItems.slice(0,4), 88, 500, 480, 170, 34, 28)}
    <rect x="88" y="930" width="1014" height="520" rx="38" fill="${svgEscape(primary)}"/>
    <text x="130" y="1005" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#ffffff" fill-opacity=".72">COLOR APPLICATION</text>
    <circle cx="820" cy="1160" r="190" fill="${svgEscape(secondary)}" fill-opacity=".85"/>
    <circle cx="930" cy="1260" r="125" fill="${svgEscape(accent)}" fill-opacity=".95"/>
    <rect x="160" y="1090" width="360" height="190" rx="26" fill="${svgEscape(surface)}"/>
    <text x="190" y="1150" font-family="Arial,sans-serif" font-size="26" font-weight="800" fill="${svgEscape(primary)}">Primary</text>
    <text x="190" y="1192" font-family="Arial,sans-serif" font-size="20" fill="#667085">${svgEscape(primary)}</text>
    ${bodyLines(ar ? "استخدم اللون الرئيسي في العناصر التي تقود الهوية، والثانوي للتوازن، والـ Accent للتأكيد البصري. اللون المحايد يوفر مساحة تنفس ويحافظ على وضوح المحتوى." : "Use the primary color for identity-led elements, secondary for balance, and accent for emphasis. Neutral surfaces provide breathing room and protect content legibility.", 130, 1350, 21, 62, 32)}
  </svg>`;

  const page3 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f7f8fa"/>
    <rect x="790" y="0" width="400" height="${H}" fill="${svgEscape(surface)}"/>
    ${pageLabel(3, ar ? "نظام الخطوط" : "Typography System")}
    ${bodyLines(ar ? "الخطوط تحدد نبرة العلامة وتضمن اتساق الرسائل. تم اختيار نظام ثنائي يدعم العربية والإنجليزية مع تسلسل هرمي واضح." : "Typography defines the brand voice and keeps communication consistent. The selected bilingual system supports Arabic and English with a clear hierarchy.", 88, 225, 23, 70, 36)}
    <rect x="88" y="430" width="650" height="350" rx="36" fill="#ffffff" stroke="#e4e8ef"/>
    <text x="128" y="485" font-family="Arial,sans-serif" font-size="19" font-weight="800" fill="${svgEscape(accent)}">ARABIC TYPEFACE</text>
    <text x="128" y="555" font-family="${svgEscape(fontFamilyAr)},Arial,sans-serif" font-size="46" font-weight="800" fill="${svgEscape(primary)}">${svgEscape(arabicName)}</text>
    <text x="128" y="625" font-family="${svgEscape(fontFamilyAr)},Arial,sans-serif" font-size="34" fill="#334155">هذا مثال تطبيقي للهوية العربية</text>
    <text x="128" y="690" font-family="Arial,sans-serif" font-size="20" fill="#667085">Family: ${svgEscape(arabicFont?.family || "—")}</text>
    <rect x="88" y="820" width="650" height="350" rx="36" fill="#ffffff" stroke="#e4e8ef"/>
    <text x="128" y="875" font-family="Arial,sans-serif" font-size="19" font-weight="800" fill="${svgEscape(accent)}">ENGLISH TYPEFACE</text>
    <text x="128" y="945" font-family="${svgEscape(fontFamilyEn)},Arial,sans-serif" font-size="46" font-weight="800" fill="${svgEscape(primary)}">${svgEscape(englishName)}</text>
    <text x="128" y="1015" font-family="${svgEscape(fontFamilyEn)},Arial,sans-serif" font-size="31" fill="#334155">Brand identity should feel clear.</text>
    <text x="128" y="1080" font-family="Arial,sans-serif" font-size="20" fill="#667085">Family: ${svgEscape(englishFont?.family || "—")}</text>
    <text x="840" y="510" font-family="Arial,sans-serif" font-size="18" font-weight="800" fill="${svgEscape(accent)}">HIERARCHY</text>
    <text x="840" y="590" font-family="${svgEscape(fontFamilyEn)},Arial,sans-serif" font-size="42" font-weight="800" fill="${svgEscape(primary)}">Heading</text>
    <text x="840" y="660" font-family="${svgEscape(fontFamilyEn)},Arial,sans-serif" font-size="28" font-weight="700" fill="#334155">Subheading</text>
    <text x="840" y="720" font-family="${svgEscape(fontFamilyEn)},Arial,sans-serif" font-size="21" fill="#667085">Body copy</text>
    ${bodyLines(ar ? "العنوان الرئيسي يقود الصفحة، يليه العنوان الفرعي ثم النص. حافظ على الفواصل والمسافات ولا تضف خطوطًا أخرى بلا سبب." : "The primary heading leads, followed by a subheading and body copy. Keep spacing disciplined and avoid adding extra typefaces without a clear reason.", 840, 820, 20, 27, 31)}
    <rect x="88" y="1280" width="1014" height="170" rx="30" fill="${svgEscape(primary)}"/>
    <text x="122" y="1340" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#ffffff" fill-opacity=".7">TYPE RULE</text>
    ${bodyLines(ar ? "استخدم الخطين المعتمدين فقط للحفاظ على شخصية الهوية." : "Use the selected type families consistently to protect the identity voice.", 122, 1390, 22, 75, 34)}
  </svg>`;

  const mockupImages = mockupDataUrls.slice(0, 2);
  const page4 = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f5f6f8"/>
    <rect x="0" y="0" width="${W}" height="420" fill="${svgEscape(primary)}"/>
    ${pageLabel(4, ar ? "التطبيقات وقواعد الاستخدام" : "Applications & Guidelines")}
    <text x="88" y="215" font-family="Arial,sans-serif" font-size="20" fill="#ffffff" fill-opacity=".76">BRAND APPLICATIONS</text>
    ${mockupImages[0] ? `<image href="${mockupImages[0]}" x="88" y="500" width="480" height="330" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="88" y="500" width="480" height="330" rx="30" fill="${svgEscape(surface)}"/>`}
    ${mockupImages[1] ? `<image href="${mockupImages[1]}" x="620" y="500" width="480" height="330" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="620" y="500" width="480" height="330" rx="30" fill="${svgEscape(surface)}"/>`}
    <text x="88" y="900" font-family="Arial,sans-serif" font-size="20" font-weight="800" fill="${svgEscape(accent)}">DO / DON'T</text>
    <rect x="88" y="950" width="480" height="330" rx="30" fill="#ffffff" stroke="#dbe4dd"/>
    <text x="124" y="1010" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#18794e">✓ DO</text>
    ${bodyLines(ar ? "استخدم الشعار المعتمد. حافظ على النسب. احمِ مساحة الشعار. استخدم الألوان والقيم المحددة." : "Use approved artwork. Preserve proportions. Protect clear space. Use the documented color values.", 124, 1065, 20, 35, 34)}
    <rect x="620" y="950" width="480" height="330" rx="30" fill="#ffffff" stroke="#eadcdc"/>
    <text x="656" y="1010" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#b42318">× DON'T</text>
    ${bodyLines(ar ? "لا تمدد الشعار. لا تغيّر ألوانه. لا تضف تأثيرات غير معتمدة. لا تضعه على خلفية تقلل من وضوحه." : "Do not stretch the logo. Do not recolor it. Do not add unapproved effects. Do not reduce legibility.", 656, 1065, 20, 35, 34)}
    <rect x="88" y="1340" width="1014" height="150" rx="28" fill="${svgEscape(secondary)}"/>
    ${bodyLines(ar ? "الهوية ليست شعارًا فقط؛ هي نظام متكامل يجب أن يظهر بنفس الشخصية في كل تطبيق." : "A brand identity is more than a logo; it is a consistent system that should feel unified across every application.", 125, 1410, 22, 78, 34)}
  </svg>`;

  const pages = [page1, page2, page3, page4];
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage("a4", "portrait");
    const png = await svgPageToPng(pages[i], W, H);
    doc.addImage(png, "PNG", 0, 0, 595.28, 841.89, undefined, "FAST");
  }
  return doc.output("blob");
}

async function buildAiFourPageBrandProfilePdf({ brand, palette, arabicFont, englishFont, logoDataUrl, mockupDataUrls = [], aiPageDataUrls = [], ar }) {
  if (aiPageDataUrls.length < 4) {
    return buildFourPageBrandProfilePdf({ brand, palette, arabicFont, englishFont, background: null, logoDataUrl, mockupDataUrls, ar });
  }

  const W = 1024;
  const H = 1536;
  const primary = palette?.primary || "#1f2937";
  const secondary = palette?.secondary || "#64748b";
  const accent = palette?.accent || "#c59d5f";
  const name = brand?.brand_name || (ar ? "اسم العلامة" : "Brand Name");
  const arabicName = arabicFont?.name || arabicFont?.family || "—";
  const englishName = englishFont?.name || englishFont?.family || "—";
  const paletteName = palette?.name?.ar || palette?.name?.en || (ar ? "لوحة الهوية" : "Brand Palette");
  const swatches = (palette?.swatches || [primary, secondary, accent]).slice(0, 6);

  const text = (value, x, y, size, weight = 500, fill = "#ffffff", anchor = "start", family = "Arial,sans-serif") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${svgEscape(family)}" font-size="${size}" font-weight="${weight}" fill="${svgEscape(fill)}">${svgEscape(value)}</text>`;
  const lines = (value, x, y, max = 58, size = 24, fill = "#ffffff") =>
    wrapText(value, max).slice(0, 5).map((line, i) => text(line, x, y + i * (size + 12), size, 500, fill)).join("");

  const pageSvgs = aiPageDataUrls.slice(0, 4).map((bgUrl, index) => {
    const page = index + 1;
    const darkPanel = `<rect x="62" y="62" width="900" height="1412" rx="42" fill="#0b1220" fill-opacity=".22"/>`;
    let overlay = "";
    if (page === 1) {
      overlay = `
        ${darkPanel}
        <rect x="96" y="96" width="832" height="1344" rx="34" fill="#ffffff" fill-opacity=".10" stroke="#ffffff" stroke-opacity=".22"/>
        ${logoDataUrl ? `<image href="${logoDataUrl}" x="130" y="150" width="330" height="240" preserveAspectRatio="xMidYMid meet"/>` : ""}
        ${text(name, 130, 500, 68, 800, "#ffffff", "start", ar ? "Arial,sans-serif" : "Arial,sans-serif")}
        ${text("EYAD AI", 130, 548, 20, 700, accent)}
        ${text(ar ? "بروفايل الهوية البصرية" : "VISUAL IDENTITY PROFILE", 130, 640, 24, 700, "#ffffff")}
        ${lines(ar ? "نظام بصري متكامل يجمع الشعار والألوان والخطوط والتطبيقات في شخصية واحدة متماسكة." : "A coherent visual system bringing logo, color, typography and applications into one consistent brand language.", 130, 710, 70, 25, "#ffffff")}
        <rect x="130" y="1220" width="764" height="4" rx="2" fill="${svgEscape(accent)}"/>
        ${text(ar ? "01 / نظرة عامة" : "01 / BRAND OVERVIEW", 130, 1290, 18, 700, "#ffffff")}
      `;
    } else if (page === 2) {
      const chips = swatches.map((color, i) => {
        const y = 430 + i * 132;
        return `<rect x="130" y="${y}" width="764" height="100" rx="24" fill="#ffffff" fill-opacity=".90"/>
          <rect x="150" y="${y + 18}" width="64" height="64" rx="16" fill="${svgEscape(color)}"/>
          ${text(i === 0 ? "Primary" : i === 1 ? "Secondary" : i === 2 ? "Accent" : i === 3 ? "Surface" : "Swatch " + (i + 1), 245, y + 48, 22, 800, primary)}
          ${text(color, 245, y + 78, 18, 500, secondary)}`;
      }).join("");
      overlay = `
        ${darkPanel}
        <rect x="96" y="96" width="832" height="1344" rx="34" fill="#ffffff" fill-opacity=".10" stroke="#ffffff" stroke-opacity=".22"/>
        ${text(ar ? "نظام الألوان" : "COLOR SYSTEM", 130, 190, 48, 800, "#ffffff")}
        ${text(paletteName, 130, 238, 20, 600, "#ffffff")}
        ${chips}
        <rect x="130" y="1250" width="764" height="150" rx="28" fill="${svgEscape(primary)}" fill-opacity=".92"/>
        ${text(ar ? "قاعدة الاستخدام" : "APPLICATION RULE", 165, 1300, 18, 800, accent)}
        ${lines(ar ? "استخدم اللون الرئيسي للهوية، والثانوي للتوازن، والـ Accent للتأكيد، مع الحفاظ على مساحات محايدة كافية." : "Use primary for identity-led elements, secondary for balance, accent for emphasis, and neutral surfaces for breathing room.", 165, 1342, 58, 20, "#ffffff")}
      `;
    } else if (page === 3) {
      overlay = `
        ${darkPanel}
        <rect x="96" y="96" width="832" height="1344" rx="34" fill="#ffffff" fill-opacity=".10" stroke="#ffffff" stroke-opacity=".22"/>
        ${text(ar ? "نظام الخطوط" : "TYPOGRAPHY SYSTEM", 130, 190, 48, 800, "#ffffff")}
        <rect x="130" y="280" width="764" height="390" rx="30" fill="#ffffff" fill-opacity=".92"/>
        ${text(ar ? "الخط العربي" : "ARABIC TYPEFACE", 165, 340, 18, 800, accent)}
        ${text(arabicName, 165, 420, 46, 800, primary)}
        ${text("Family: " + (arabicFont?.family || "—"), 165, 462, 20, 500, secondary)}
        ${text("هذا مثال تطبيقي للهوية العربية", 165, 545, 34, 600, primary, "start", arabicFont?.family || "Arial,sans-serif")}
        <rect x="130" y="710" width="764" height="390" rx="30" fill="#ffffff" fill-opacity=".92"/>
        ${text(ar ? "الخط الإنجليزي" : "ENGLISH TYPEFACE", 165, 770, 18, 800, accent)}
        ${text(englishName, 165, 850, 46, 800, primary)}
        ${text("Family: " + (englishFont?.family || "—"), 165, 892, 20, 500, secondary)}
        ${text("Brand identity should feel clear.", 165, 975, 31, 600, primary, "start", englishFont?.family || "Arial,sans-serif")}
        <rect x="130" y="1150" width="764" height="250" rx="30" fill="${svgEscape(primary)}" fill-opacity=".92"/>
        ${text(ar ? "قاعدة الخطوط" : "TYPE RULE", 165, 1200, 18, 800, accent)}
        ${lines(ar ? "استخدم الخطين المعتمدين فقط للحفاظ على شخصية الهوية وتسلسلها البصري." : "Use the selected type families consistently to protect the identity voice and visual hierarchy.", 165, 1242, 58, 20, "#ffffff")}
      `;
    } else {
      const mockups = mockupDataUrls.slice(0, 2);
      overlay = `
        ${darkPanel}
        <rect x="96" y="96" width="832" height="1344" rx="34" fill="#ffffff" fill-opacity=".10" stroke="#ffffff" stroke-opacity=".22"/>
        ${text(ar ? "التطبيقات وقواعد الاستخدام" : "APPLICATIONS & GUIDELINES", 130, 190, 42, 800, "#ffffff")}
        ${mockups[0] ? `<image href="${mockups[0]}" x="130" y="260" width="360" height="300" preserveAspectRatio="xMidYMid slice"/>` : ""}
        ${mockups[1] ? `<image href="${mockups[1]}" x="534" y="260" width="360" height="300" preserveAspectRatio="xMidYMid slice"/>` : ""}
        <rect x="130" y="640" width="360" height="480" rx="30" fill="#ffffff" fill-opacity=".92"/>
        ${text("✓ DO", 165, 705, 26, 800, "#18794e")}
        ${lines(ar ? "استخدم الشعار المعتمد. حافظ على النسب. احمِ مساحة الشعار. استخدم القيم المعتمدة." : "Use approved artwork. Preserve proportions. Protect clear space. Use the documented identity values.", 165, 760, 34, 19, primary)}
        <rect x="534" y="640" width="360" height="480" rx="30" fill="#ffffff" fill-opacity=".92"/>
        ${text("× DON'T", 569, 705, 26, 800, "#b42318")}
        ${lines(ar ? "لا تمدد الشعار. لا تغير ألوانه. لا تضف تأثيرات غير معتمدة. لا تقلل من وضوحه." : "Do not stretch the logo. Do not recolor it. Do not add unapproved effects. Do not reduce legibility.", 569, 760, 34, 19, primary)}
        <rect x="130" y="1190" width="764" height="210" rx="30" fill="${svgEscape(secondary)}" fill-opacity=".92"/>
        ${text(ar ? "مبدأ الهوية" : "BRAND PRINCIPLE", 165, 1245, 18, 800, accent)}
        ${lines(ar ? "الهوية نظام متكامل؛ يجب أن تظهر بنفس الشخصية في كل تطبيق." : "The identity is a system; every application should carry the same visual personality.", 165, 1290, 62, 21, "#ffffff")}
      `;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <image href="${bgUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
      ${overlay}
    </svg>`;
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  for (let i = 0; i < pageSvgs.length; i++) {
    if (i > 0) doc.addPage("a4", "portrait");
    const png = await svgPageToPng(pageSvgs[i], W, H);
    doc.addImage(png, "PNG", 0, 0, 595.28, 841.89, undefined, "FAST");
  }
  return doc.output("blob");
}

function buildBrandBookHtml({ brand, palette, arabicFont, englishFont, background, mockups, logoDataUrl, ar }) {
  const name = escapeHtml(brand?.brand_name || "Brand Name");
  const dir = ar ? "rtl" : "ltr";
  const lang = ar ? "ar" : "en";
  const primary = palette?.primary || "#1f2937";
  const secondary = palette?.secondary || "#64748b";
  const accent = palette?.accent || "#c59d5f";
  const surface = palette?.surface || "#f8fafc";
  const bgValue = background?.value || "#f5f5f5";
  const bgOpacity = Math.max(0, Math.min(100, Number(background?.opacity ?? 70))) / 100;
  const arabicName = escapeHtml(arabicFont?.name || "—");
  const englishName = escapeHtml(englishFont?.name || "—");
  const mockupCards = (mockups || []).slice(0, 8).map((item, index) => {
    const label = escapeHtml(item?.name || item?.type || ("Mockup " + (index + 1)));
    const imageUrl = getMockupImageUrl(item);
    return imageUrl
      ? '<article class="mockup-card"><img src="' + escapeHtml(imageUrl) + '" alt="' + label + '"><div class="mockup-caption"><strong>' + label + '</strong><span>Presentation application</span></div></article>'
      : '<article class="mockup-card mockup-data"><div class="mockup-placeholder"><span>' + escapeHtml(String(item?.type || "Mockup")).toUpperCase() + '</span></div><div class="mockup-caption"><strong>' + label + '</strong><span>Logo scale: ' + escapeHtml(item?.logoScale ?? "—") + '%</span></div></article>';
  }).join("");

  const copy = ar ? {
    coverKicker: "دليل الهوية البصرية",
    coverSub: "Brand Identity Guidelines",
    overview: "نظرة عامة",
    overviewText: "هذا المستند يشرح النظام البصري المعتمد للعلامة وكيفية استخدام عناصره بشكل متسق في التطبيقات الرقمية والمطبوعة.",
    logo: "الشعار",
    logoText: "الشعار هو العنصر الأساسي في الهوية. استخدم النسخة المعتمدة دون تشويه أو تغيير في النسب أو الألوان.",
    colors: "نظام الألوان",
    colorsText: "الألوان التالية هي لوحة الهوية المعتمدة. استخدم اللون الأساسي للهوية الرئيسية، والثانوي والداعم للتدرج والتفاصيل.",
    typography: "الخطوط",
    typographyText: "تم اختيار خط عربي وخط إنجليزي متوافقين مع شخصية العلامة. حافظ على التسلسل الهرمي والأوزان المقترحة.",
    background: "الخلفية",
    backgroundText: "الخلفية عنصر داعم للهوية ويُستخدم لتوحيد المظهر العام مع الحفاظ على وضوح الشعار والمحتوى.",
    applications: "التطبيقات والـ Mockups",
    applicationsText: "توضح النماذج التالية كيف تظهر الهوية في تطبيقات واقعية. الـ Mockups للعرض والتقديم وليست ملفات إنتاج.",
    rules: "قواعد الاستخدام",
    rulesText: "لا تمدد الشعار، لا تغيّر ألوانه، لا تضف تأثيرات غير معتمدة، ولا تضعه على خلفية تقلل من وضوحه.",
    package: "محتويات الحزمة",
    packageText: "تتضمن الحزمة ملفات المصدر المتاحة، نظام الألوان، بيانات الخطوط، إعداد الخلفية، النماذج المحفوظة، ودليل الهوية.",
    sourceNote: "تم توليد هذا الدليل تلقائياً من بيانات الهوية المعتمدة داخل EYAD AI."
  } : {
    coverKicker: "VISUAL IDENTITY GUIDELINES",
    coverSub: "Brand Identity Guidelines",
    overview: "Brand Overview",
    overviewText: "This document explains the approved visual system and how to apply it consistently across digital and printed communications.",
    logo: "Logo",
    logoText: "The logo is the primary identity asset. Use the approved artwork without distortion, recoloring, or changes to its proportions.",
    colors: "Color System",
    colorsText: "These colors form the approved identity palette. Use the primary color for the core identity and the secondary/accent colors for hierarchy and detail.",
    typography: "Typography",
    typographyText: "The selected Arabic and English typefaces create a consistent typographic voice. Keep the hierarchy and selected families consistent.",
    background: "Background",
    backgroundText: "The background is a supporting identity element. Use it to create a consistent visual environment while protecting logo and content legibility.",
    applications: "Applications & Mockups",
    applicationsText: "These examples demonstrate how the identity can appear in realistic applications. Mockups are presentation references, not production files.",
    rules: "Usage Rules",
    rulesText: "Do not stretch the logo, change its colors, add unapproved effects, or place it on a background that reduces legibility.",
    package: "Package Contents",
    packageText: "The package contains available source assets, color system, typography metadata, background settings, saved mockups, and this visual guide.",
    sourceNote: "Generated automatically from the approved identity data inside EYAD AI."
  };

  const colorCards = [
    ["Primary", primary],
    ["Secondary", secondary],
    ["Accent", accent],
    ["Surface", surface]
  ].map(([label, color]) =>
    '<div class="color-card"><div class="color-chip" style="background:' + escapeHtml(color) + '"></div><strong>' + label + '</strong><code>' + escapeHtml(color) + '</code></div>'
  ).join("");

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — Brand Identity Guidelines</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; background:#e7e9ee; color:#18212f; font-family:Arial,"Helvetica Neue",sans-serif; }
  body { padding:28px 0; }
  .page { width:210mm; min-height:297mm; margin:0 auto 24px; padding:20mm 18mm; background:#fff; position:relative; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .cover { color:#fff; background:linear-gradient(145deg,${escapeHtml(primary)} 0%, ${escapeHtml(secondary)} 62%, ${escapeHtml(accent)} 150%); display:flex; flex-direction:column; justify-content:space-between; }
  .cover:after { content:""; position:absolute; width:180mm; height:180mm; border:1px solid rgba(255,255,255,.18); border-radius:50%; inset:auto -85mm -70mm auto; }
  .kicker { font-size:11px; letter-spacing:.16em; font-weight:700; opacity:.78; }
  h1 { font-size:38px; line-height:1.08; margin:10px 0 12px; letter-spacing:-.03em; }
  h2 { font-size:25px; margin:0 0 10px; letter-spacing:-.02em; color:${escapeHtml(primary)}; }
  h3 { font-size:14px; margin:0 0 6px; }
  p { font-size:12.5px; line-height:1.75; margin:0 0 12px; color:#4b5563; }
  .cover p { color:rgba(255,255,255,.84); max-width:125mm; }
  .brand-mark { min-height:72mm; display:flex; align-items:center; justify-content:center; }
  .brand-mark img { max-width:92mm; max-height:52mm; object-fit:contain; background:rgba(255,255,255,.94); padding:14mm; border-radius:10mm; }
  .cover-meta { display:flex; justify-content:space-between; gap:20px; font-size:10px; opacity:.75; }
  .eyebrow { font-size:10px; color:${escapeHtml(accent)}; font-weight:800; letter-spacing:.12em; margin-bottom:8px; }
  .section-intro { max-width:160mm; margin-bottom:16mm; }
  .rule { height:3px; width:18mm; background:${escapeHtml(accent)}; margin:0 0 13mm; border-radius:99px; }
  .overview-grid { display:grid; grid-template-columns:1fr 1fr; gap:10mm; }
  .info-card { border:1px solid #e5e7eb; border-radius:6mm; padding:8mm; background:#fbfcfe; }
  .metric { font-size:28px; font-weight:800; color:${escapeHtml(primary)}; margin-bottom:3px; }
  .muted { color:#6b7280; font-size:10px; }
  .logo-stage { min-height:110mm; border-radius:8mm; background:${escapeHtml(surface)}; display:flex; align-items:center; justify-content:center; border:1px solid #e5e7eb; position:relative; overflow:hidden; }
  .logo-stage:before,.logo-stage:after { content:""; position:absolute; border:1px solid rgba(0,0,0,.06); border-radius:50%; }
  .logo-stage:before { width:150mm; height:150mm; }
  .logo-stage:after { width:95mm; height:95mm; }
  .logo-stage img { position:relative; z-index:2; max-width:90mm; max-height:55mm; object-fit:contain; }
  .logo-rules { display:grid; grid-template-columns:1fr 1fr; gap:7mm; margin-top:9mm; }
  .rule-card { border-top:3px solid ${escapeHtml(accent)}; padding-top:5mm; }
  .swatches { display:grid; grid-template-columns:repeat(2,1fr); gap:7mm; }
  .color-card { border:1px solid #e5e7eb; border-radius:5mm; padding:5mm; background:#fff; display:grid; grid-template-columns:16mm 1fr; gap:1mm 4mm; align-items:center; }
  .color-chip { width:16mm; height:24mm; border-radius:4mm; grid-row:1 / span 2; border:1px solid rgba(0,0,0,.08); }
  .color-card strong { font-size:11px; }
  code { font-size:10px; color:#6b7280; }
  .type-sample { border:1px solid #e5e7eb; border-radius:6mm; padding:9mm; margin-bottom:7mm; background:#fff; }
  .type-name { font-size:11px; font-weight:800; color:${escapeHtml(primary)}; }
  .sample-ar { font-family:"${escapeHtml(arabicFont?.family || "Cairo")}",Arial,sans-serif; font-size:27px; margin-top:7px; }
  .sample-en { font-family:"${escapeHtml(englishFont?.family || "Plus Jakarta Sans")}",Arial,sans-serif; font-size:27px; margin-top:7px; }
  .background-preview { height:92mm; border-radius:8mm; background:${escapeHtml(bgValue)}; opacity:${bgOpacity}; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; }
  .background-preview span { background:rgba(255,255,255,.78); padding:6mm 10mm; border-radius:5mm; font-weight:800; color:${escapeHtml(primary)}; }
  .mockups { display:grid; grid-template-columns:1fr 1fr; gap:7mm; }
  .mockup-card { border:1px solid #e5e7eb; border-radius:5mm; overflow:hidden; background:#fff; }
  .mockup-card img { width:100%; height:62mm; object-fit:cover; display:block; background:#f1f5f9; }
  .mockup-placeholder { height:62mm; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,${escapeHtml(surface)},#eef2f7); color:${escapeHtml(secondary)}; font-size:14px; font-weight:800; letter-spacing:.12em; }
  .mockup-caption { padding:4mm 5mm; display:flex; justify-content:space-between; gap:6px; align-items:baseline; }
  .mockup-caption strong { font-size:10px; }
  .mockup-caption span { font-size:8.5px; color:#94a3b8; }
  .checklist { display:grid; gap:5mm; }
  .check { display:grid; grid-template-columns:8mm 1fr; gap:4mm; align-items:start; padding:5mm; border:1px solid #e5e7eb; border-radius:5mm; }
  .check b { width:7mm; height:7mm; border-radius:50%; background:${escapeHtml(accent)}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:9px; }
  .footer { position:absolute; bottom:10mm; left:18mm; right:18mm; display:flex; justify-content:space-between; color:#9ca3af; font-size:8px; border-top:1px solid #eef0f3; padding-top:4mm; }
  @media print { body { background:#fff; padding:0; } .page { margin:0; box-shadow:none; } }
</style>
</head>
<body>
<section class="page cover">
  <div>
    <div class="kicker">${copy.coverKicker}</div>
    <h1>${name}</h1>
    <p>${copy.coverSub}</p>
  </div>
  <div class="brand-mark">${logoDataUrl ? '<img src="' + logoDataUrl + '" alt="' + name + ' logo">' : '<div style="font-size:26px;font-weight:800">LOGO</div>'}</div>
  <div class="cover-meta"><span>EYAD AI</span><span>Visual Identity System</span></div>
</section>

<section class="page">
  <div class="eyebrow">01 — OVERVIEW</div><h2>${copy.overview}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.overviewText}</p></div>
  <div class="overview-grid">
    <div class="info-card"><div class="metric">01</div><h3>Approved Identity</h3><div class="muted">Logo, palette, typography and background are documented from the selected brand state.</div></div>
    <div class="info-card"><div class="metric">${(mockups || []).length}</div><h3>Saved Mockups</h3><div class="muted">Presentation configurations currently saved with this project.</div></div>
    <div class="info-card"><div class="metric">${(palette?.swatches || []).length}</div><h3>Color Swatches</h3><div class="muted">Core colors available for consistent application.</div></div>
    <div class="info-card"><div class="metric">02</div><h3>Type Systems</h3><div class="muted">Arabic and English typography selections.</div></div>
  </div>
</section>

<section class="page">
  <div class="eyebrow">02 — LOGO</div><h2>${copy.logo}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.logoText}</p></div>
  <div class="logo-stage">${logoDataUrl ? '<img src="' + logoDataUrl + '" alt="' + name + ' logo">' : '<strong>Approved logo source unavailable</strong>'}</div>
  <div class="logo-rules">
    <div class="rule-card"><h3>Clear Space</h3><p>Maintain visible breathing room around the mark. Do not crowd it with text, borders or other graphic elements.</p></div>
    <div class="rule-card"><h3>Integrity</h3><p>Never stretch, rotate, recolor, redraw or apply unapproved shadows and effects to the approved logo.</p></div>
  </div>
</section>

<section class="page">
  <div class="eyebrow">03 — COLOR</div><h2>${copy.colors}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.colorsText}</p></div>
  <div class="swatches">${colorCards}</div>
  <div class="info-card" style="margin-top:9mm"><h3>Application guidance</h3><p>Primary should lead the identity. Secondary supports hierarchy and surfaces. Accent is reserved for emphasis, highlights and key moments. Surface provides a controlled neutral field.</p></div>
</section>

<section class="page">
  <div class="eyebrow">04 — TYPOGRAPHY</div><h2>${copy.typography}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.typographyText}</p></div>
  <div class="type-sample"><div class="type-name">Arabic — ${arabicName}</div><div class="sample-ar">هذا مثال تطبيقي على أسلوب الكتابة العربي للهوية.</div><p style="margin-top:8px">Family: ${escapeHtml(arabicFont?.family || "—")}</p></div>
  <div class="type-sample"><div class="type-name">English — ${englishName}</div><div class="sample-en">Brand identity systems should feel consistent, clear and intentional.</div><p style="margin-top:8px">Family: ${escapeHtml(englishFont?.family || "—")}</p></div>
  <div class="info-card"><h3>Hierarchy</h3><p>Use a clear distinction between display headings, section titles, body copy and supporting labels. Avoid mixing additional typefaces unless the identity system is intentionally expanded.</p></div>
</section>

<section class="page">
  <div class="eyebrow">05 — BACKGROUND</div><h2>${copy.background}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.backgroundText}</p></div>
  <div class="background-preview"><span>Brand Background</span></div>
  <div class="overview-grid" style="margin-top:10mm">
    <div class="info-card"><h3>Background Value</h3><code>${escapeHtml(bgValue)}</code></div>
    <div class="info-card"><h3>Opacity</h3><div class="metric" style="font-size:24px">${Math.round(bgOpacity * 100)}%</div></div>
  </div>
</section>

<section class="page">
  <div class="eyebrow">06 — APPLICATIONS</div><h2>${copy.applications}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.applicationsText}</p></div>
  <div class="mockups">${mockupCards || '<div class="info-card" style="grid-column:1/-1"><h3>No saved mockups</h3><p>Create and save mockups in EYAD to document real-world applications here.</p></div>'}</div>
</section>

<section class="page">
  <div class="eyebrow">07 — USAGE</div><h2>${copy.rules}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.rulesText}</p></div>
  <div class="checklist">
    <div class="check"><b>✓</b><div><h3>Use approved artwork</h3><p>Always start from the approved logo source included in the package.</p></div></div>
    <div class="check"><b>✓</b><div><h3>Protect legibility</h3><p>Choose backgrounds and placements that preserve sufficient contrast and clear space.</p></div></div>
    <div class="check"><b>✓</b><div><h3>Keep the palette consistent</h3><p>Use the documented HEX values instead of approximate colors sampled from screenshots.</p></div></div>
    <div class="check"><b>✓</b><div><h3>Keep mockups separate from production</h3><p>Mockups communicate the visual direction; final production artwork should use the appropriate studio export.</p></div></div>
  </div>
</section>

<section class="page">
  <div class="eyebrow">08 — PACKAGE</div><h2>${copy.package}</h2><div class="rule"></div>
  <div class="section-intro"><p>${copy.packageText}</p></div>
  <div class="overview-grid">
    <div class="info-card"><h3>01 — Logo</h3><p>Approved PNG and the real SVG source when available.</p></div>
    <div class="info-card"><h3>02 — Colors</h3><p>Palette names, HEX values and swatches.</p></div>
    <div class="info-card"><h3>03 — Typography</h3><p>Arabic and English family metadata.</p></div>
    <div class="info-card"><h3>04 — Background</h3><p>Selected background value and opacity.</p></div>
    <div class="info-card"><h3>05 — Mockups</h3><p>Saved presentation configurations and available previews.</p></div>
    <div class="info-card"><h3>06 — Brand Book</h3><p>This formatted multi-page identity guide.</p></div>
  </div>
  <div class="info-card" style="margin-top:10mm;background:${escapeHtml(primary)};color:#fff;border:0"><h3 style="color:#fff">Production note</h3><p style="color:rgba(255,255,255,.82)">${copy.sourceNote}</p></div>
</section>
</body>
</html>`;
}

export default function BrandPackageEngine({ brand, palette, background, arabicFont, englishFont, projectId, hasApprovedLogo, onRequireApprovedLogo, ar }) {
  const [mockups, setMockups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [resultNote, setResultNote] = useState("");

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setMockups([]);
      return undefined;
    }
    projectService.get(projectId).then((project) => {
      if (active) {
        const saved = project?.project_data?.mockups;
        setMockups(Array.isArray(saved) ? saved : []);
      }
    }).catch(() => {
      if (active) setMockups([]);
    });
    return () => { active = false; };
  }, [projectId]);

  const packageName = useMemo(() => safeName(brand?.brand_name || "EYAD-Brand"), [brand?.brand_name]);

  const createPackage = async () => {
    if (loading) return;
    if (!hasApprovedLogo) {
      onRequireApprovedLogo?.();
      return;
    }
    setLoading(true);
    setDownloaded(false);
    setResultNote("");
    let failureStage = "تهيئة الحزمة";
    try {
      const zip = new JSZip();
      const root = packageName + "-Brand-Package";
      const colors = {
        name: palette?.name || null,
        primary: palette?.primary || null,
        secondary: palette?.secondary || null,
        accent: palette?.accent || null,
        surface: palette?.surface || null,
        swatches: palette?.swatches || [],
      };
      const identity = {
        brand_name: brand?.brand_name || "",
        logo: brand?.logo ? {
          asset_id: brand.logo.asset_id || null,
          url: brand.logo.url || null,
          name: brand.logo.name || null,
          svg_url: brand.logo.svg_url || brand.logo.svgUrl || null,
        } : null,
        palette: colors,
        typography: {
          arabic: arabicFont ? { id: arabicFont.id, name: arabicFont.name, family: arabicFont.family } : null,
          english: englishFont ? { id: englishFont.id, name: englishFont.name, family: englishFont.family } : null,
        },
        background: background ? {
          id: background.id,
          name: background.name || null,
          value: background.value || null,
          opacity: background.opacity ?? 70,
        } : null,
      };

      zip.file(root + "/README.txt", [
        "EYAD AI — Brand Package",
        "",
        "This package contains the approved brand identity source and presentation references.",
        "",
        "Folders:",
        "00-Brand-Identity-Profile — four-page professional identity profile PDF and HTML guide",
        "01-Logo — approved logo source files when available",
        "02-Colors — palette JSON and readable color values",
        "03-Typography — Arabic and English font details",
        "04-Background — background settings and CSS",
        "05-Mockups — saved mockup data, preview images and README",
        "06-Source-Data — canonical machine-readable identity source files",
        "",
        "Mockups are presentation-only. They are not production/print files.",
        "PNG is not converted into a fake editable SVG.",
      ].join("\n"));

      failureStage = "تنزيل الشعار PNG";
      const logoResult = await addRemoteFile(zip, brand?.logo?.url, root + "/01-Logo/" + packageName + "-logo.png");
      const svgUrl = brand?.logo?.svg_url || brand?.logo?.svgUrl;
      const svgResult = await addRemoteFile(zip, svgUrl, root + "/01-Logo/" + packageName + "-logo.svg");

      zip.file(root + "/06-Source-Data/logo-source.json", jsonText({
        png: brand?.logo?.url || null,
        svg: svgUrl || null,
        pngIncluded: logoResult.added,
        svgIncluded: svgResult.added,
        note: svgUrl ? "SVG source included when fetchable." : "No real SVG source was available; PNG was not vectorized.",
      }));

      zip.file(root + "/06-Source-Data/colors.json", jsonText(colors));
      zip.file(root + "/06-Source-Data/colors.txt", [
        "Palette: " + (palette?.name?.en || palette?.name?.ar || "—"),
        "Primary: " + (palette?.primary || "—"),
        "Secondary: " + (palette?.secondary || "—"),
        "Accent: " + (palette?.accent || "—"),
        "Surface: " + (palette?.surface || "—"),
        "Swatches: " + (palette?.swatches || []).join(", "),
      ].join("\n"));

      // Put usable deliverables in their named folders, not only in source-data.
      zip.file(root + "/02-Colors/colors.json", jsonText(colors));
      zip.file(root + "/02-Colors/colors.txt", [
        "Palette: " + (palette?.name?.en || palette?.name?.ar || "—"),
        "Primary: " + (palette?.primary || "—"),
        "Secondary: " + (palette?.secondary || "—"),
        "Accent: " + (palette?.accent || "—"),
        "Surface: " + (palette?.surface || "—"),
        "Swatches: " + (palette?.swatches || []).join(", "),
      ].join("\n"));

      zip.file(root + "/03-Typography/typography.json", jsonText(identity.typography));
      zip.file(root + "/03-Typography/typography.txt", [
        "Arabic: " + (arabicFont?.name || arabicFont?.family || "—"),
        "Arabic family: " + (arabicFont?.family || "—"),
        "English: " + (englishFont?.name || englishFont?.family || "—"),
        "English family: " + (englishFont?.family || "—"),
      ].join("\n"));

      zip.file(root + "/04-Background/background.json", jsonText(identity.background));
      zip.file(root + "/04-Background/background.css", [
        ":root {",
        "  --eyad-background: " + (background?.value || "none") + ";",
        "  --eyad-background-opacity: " + ((Number(background?.opacity ?? 70) || 0) / 100) + ";",
        "}",
      ].join("\n"));

      zip.file(root + "/05-Mockups/mockups.json", jsonText(mockups));
      zip.file(root + "/05-Mockups/README.txt", "Saved mockups are presentation configurations. Re-open them in EYAD AI to edit or regenerate the presentation.\n");

      // Keep canonical machine-readable copies together for integrations.
      zip.file(root + "/06-Source-Data/colors.json", jsonText(colors));
      zip.file(root + "/06-Source-Data/typography.json", jsonText(identity.typography));
      zip.file(root + "/06-Source-Data/background.json", jsonText(identity.background));
      zip.file(root + "/06-Source-Data/background.css", [
        ":root {",
        "  --eyad-background: " + (background?.value || "none") + ";",
        "  --eyad-background-opacity: " + ((Number(background?.opacity ?? 70) || 0) / 100) + ";",
        "}",
      ].join("\n"));
      zip.file(root + "/06-Source-Data/mockups.json", jsonText(mockups));

      const mockupDataUrls = [];
      failureStage = "تنزيل صور Mockups";
      for (const item of mockups.slice(0, 2)) {
        const url = getMockupImageUrl(item);
        if (!url) continue;
        const result = await addRemoteFile(
          zip,
          url,
          root + "/05-Mockups/" + safeName(item?.name || item?.type || "mockup") + ".png"
        );
        if (result.dataUrl) mockupDataUrls.push(result.dataUrl);
      }

      setResultNote(ar ? "جارٍ توليد الصفحات بصريًا بالـAI… 0/4" : "Generating the four visual pages with AI… 0/4");

      const aiPageDataUrls = [];
      for (let page = 1; page <= 4; page += 1) {
        failureStage = "توليد صفحة الهوية " + page + " من 4";
        const generation = await runEyadEngine({
          message: "Generate the visual artwork layer for brand identity profile page " + page + " of 4. Do not render factual text; EYAD will composite exact approved data afterward.",
          projectId,
          studioId: "brand-kit",
          language: ar ? "ar" : "en",
          action: "generate",
          designOptions: {
            brand_profile_page: page,
            brand_profile_name: brand?.brand_name || "",
            brand_profile_palette: colors,
            brand_profile_typography: identity.typography,
          },
        });
        const pageUrl = generation?.image?.url || generation?.image?.data_url || generation?.asset?.asset_url || null;
        if (!pageUrl) {
          console.warn("[EYAD Brand Package] AI artwork unavailable; using built-in brand profile layout.", {
            page,
            reason: "BRAND_PROFILE_PAGE_" + page + "_IMAGE_MISSING",
          });
          setResultNote(ar ? "تعذر توليد صورة AI للصفحة " + page + " — سيتم استخدام التصميم البديل." : "AI artwork unavailable for page " + page + " — using the built-in layout.");
          break;
        }

        const pageFile = await addRemoteFile(
          zip,
          pageUrl,
          root + "/00-Brand-Identity-Profile/ai-page-" + page + ".png"
        );
        if (!pageFile.dataUrl) {
          console.warn("[EYAD Brand Package] AI artwork could not be fetched; using built-in brand profile layout.", {
            page,
            reason: "BRAND_PROFILE_PAGE_" + page + "_FETCH_FAILED",
          });
          setResultNote(ar ? "تعذر تحميل صورة AI للصفحة " + page + " — سيتم استخدام التصميم البديل." : "AI artwork could not be fetched for page " + page + " — using the built-in layout.");
          break;
        }
        aiPageDataUrls.push(pageFile.dataUrl);
        setResultNote(ar ? "جارٍ توليد الصفحات بصريًا بالـAI… " + page + "/4" : "Generating the four visual pages with AI… " + page + "/4");
      }

      failureStage = "إنشاء ملف PDF لبروفايل الهوية";
      const brandProfilePdf = await buildAiFourPageBrandProfilePdf({
        brand,
        palette,
        arabicFont,
        englishFont,
        logoDataUrl: logoResult.dataUrl || null,
        mockupDataUrls,
        aiPageDataUrls,
        ar,
      });
      zip.file(root + "/00-Brand-Identity-Profile/brand-identity-profile.pdf", brandProfilePdf);

      const brandBookHtml = buildBrandBookHtml({
        brand,
        palette,
        arabicFont,
        englishFont,
        background,
        mockups,
        logoDataUrl: logoResult.dataUrl || null,
        ar,
      });
      zip.file(root + "/00-Brand-Identity-Profile/brand-book.html", brandBookHtml);
      zip.file(root + "/06-Source-Data/brand-identity.json", jsonText(identity));

      failureStage = "تجميع ملفات ZIP";
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      failureStage = "بدء تنزيل ملف ZIP";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = root + ".zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const included = [
        logoResult.added ? "PNG" : null,
        svgResult.added ? "SVG" : null,
        "Colors",
        "Typography",
        "Background",
        "Mockups",
        "4-page PDF Brand Profile",
      ].filter(Boolean);
      setResultNote((ar ? "تم إنشاء الحزمة: " : "Package created: ") + included.join(" • "));
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 2400);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error || "UNKNOWN_ERROR");
      console.error("[EYAD Brand Package] failed", { stage: failureStage, detail, error });
      setResultNote((ar ? "فشل عند: " : "Failed at: ") + failureStage + " — " + detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="vi-section brand-package-engine">
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon"><Archive className="w-4 h-4" /></span>
          <h2>{ar ? "حزمة الهوية" : "Brand Package"}</h2>
        </div>
        <span className="vi-section-hint">{ar ? "كل الهوية في ملف واحد" : "Complete identity package"}</span>
      </div>

      <div className="brand-package-summary">
        <div className="brand-package-icon"><PackageCheck className="w-5 h-5" /></div>
        <div>
          <strong>{brand?.brand_name || (ar ? "اسم العلامة" : "Brand Name")}</strong>
          <span>{ar ? "الشعار • الألوان • الخطوط • التطبيقات • بروفايل الهوية PDF" : "Logo • Colors • Typography • Applications • 4-page PDF Profile"}</span>
        </div>
      </div>

      <div className="brand-package-files">
        <div><FileText className="w-4 h-4" /><span>{ar ? "الألوان والخطوط" : "Colors & Typography"}</span></div>
        <div><FileText className="w-4 h-4" /><span>{ar ? "الخلفية" : "Background"}</span></div>
        <div><FileJson className="w-4 h-4" /><span>{mockups.length} {ar ? "Mockups محفوظة" : "saved mockups"}</span></div>
        <div><FileText className="w-4 h-4" /><span>{ar ? "بروفايل هوية احترافي — 4 صفحات PDF" : "Professional 4-page PDF Brand Profile"}</span></div>
      </div>

      <button type="button" className="vi-apply-btn brand-package-download" onClick={createPackage} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        {loading ? (ar ? "جارٍ تجهيز الحزمة…" : "Building package…") : downloaded ? (ar ? "تم إنشاء الحزمة" : "Package created") : (ar ? "تحميل Brand Package" : "Download Brand Package")}
      </button>

      {resultNote && <p className="brand-package-note">{resultNote}</p>}
    </section>
  );
}

import { jsPDF } from "jspdf";
import PptxGenJS from "pptxgenjs";

function safeFilename(value, fallback = "eyad-export") {
  return String(value || fallback).trim().replace(/[^\w\u0600-\u06FF-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the object URL alive long enough for mobile browsers to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

async function fetchAsset(url) {
  if (!url) throw new Error("EXPORT_SOURCE_MISSING");
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("EXPORT_SOURCE_FETCH_FAILED");
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { blob, dataUrl, type: blob.type || "image/png" };
}

async function imageMeta(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
  return { width: image.naturalWidth || image.width || 1, height: image.naturalHeight || image.height || 1 };
}

async function toPngDataUrl(source) {
  if (source.type && source.type.includes("png")) return source.dataUrl;
  const meta = await imageMeta(source.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, meta.width);
  canvas.height = Math.max(1, meta.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("EXPORT_CANVAS_UNAVAILABLE");
  const image = new Image();
  image.src = source.dataUrl;
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

async function buildSingleImagePptx(sourceUrl, title) {
  const source = await fetchAsset(sourceUrl);
  const data = await toPngDataUrl(source);
  const meta = await imageMeta(data);
  const portrait = meta.height > meta.width;
  const slideW = portrait ? 7.5 : 13.333333;
  const slideH = portrait ? 13.333333 : 7.5;
  const scale = Math.min(slideW / meta.width, slideH / meta.height);
  const imageW = meta.width * scale;
  const imageH = meta.height * scale;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "EYAD_CUSTOM", width: slideW, height: slideH });
  pptx.layout = "EYAD_CUSTOM";
  pptx.author = "EYAD AI";
  pptx.subject = "Exported artwork";
  pptx.title = title || "EYAD Artwork";
  pptx.company = "EYAD AI";
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addImage({ data, x: (slideW - imageW) / 2, y: (slideH - imageH) / 2, w: imageW, h: imageH, altText: title || "EYAD artwork" });
  const output = await pptx.write({ outputType: "blob" });
  if (!(output instanceof Blob) || output.size < 1000) throw new Error("PPTX_GENERATION_FAILED");
  return output;
}

export async function exportImagePng(sourceUrl, filename = "eyad-export.png") {
  const { blob } = await fetchAsset(sourceUrl);
  downloadBlob(blob, filename);
}

export async function exportImagePdf(sourceUrl, filename = "eyad-export.pdf") {
  const source = await fetchAsset(sourceUrl);
  const pdfData = await toPngDataUrl(source);
  const { width, height } = await imageMeta(pdfData);
  const ratio = width / height;
  const pageH = Math.min(1600, Math.max(360, height));
  const pageW = pageH * ratio;
  const doc = new jsPDF({ orientation: ratio >= 1 ? "landscape" : "portrait", unit: "pt", format: [pageW, pageH], compress: true });
  doc.addImage(pdfData, "PNG", 0, 0, pageW, pageH);
  const blob = doc.output("blob");
  if (!(blob instanceof Blob) || blob.size < 500) throw new Error("PDF_GENERATION_FAILED");
  downloadBlob(blob, filename);
}

export async function exportImageSvg(sourceUrl, filename = "eyad-export.svg", trueSvgUrl = null) {
  if (trueSvgUrl) {
    const { blob } = await fetchAsset(trueSvgUrl);
    const svgText = await blob.text();
    const svgStart = svgText.trimStart().replace(/^<\?xml[^>]*>\s*/i, "");
    if (!svgStart.startsWith("<svg") || svgText.length <= 20) throw new Error("INVALID_SVG_CONTENT");
    downloadBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }), filename);
    return;
  }
  const { dataUrl } = await fetchAsset(sourceUrl);
  const { width, height } = await imageMeta(dataUrl);
  const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"0 0 " + width + " " + height + "\"><image href=\"" + dataUrl + "\" x=\"0\" y=\"0\" width=\"" + width + "\" height=\"" + height + "\" preserveAspectRatio=\"none\"/></svg>";
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export async function exportImagePptx(sourceUrl, filename = "eyad-export.pptx", title = "EYAD Artwork") {
  const blob = await buildSingleImagePptx(sourceUrl, title);
  downloadBlob(blob, filename);
}

export { safeFilename };

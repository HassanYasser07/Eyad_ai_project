/**
 * Reproduction harness: builds realistic PowerPoint-like decks (JSZip) and runs
 * the REAL engine pipeline (PptxPackage.open -> readPresentation -> readSlide)
 * plus the exact media-URL logic from useMediaUrls.js / SlideView.jsx.
 * Prints, per picture, whether the editor would render it, show
 * "Image cannot be displayed", or get stuck on "Loading…".
 */
import fs from "node:fs";
import path from "node:path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { PptxPackage, setXmlImpl, readPresentation, readSlide, flattenElements } from "./src/components/pptxEditor/engine/index.js";

setXmlImpl({ DOMParser, XMLSerializer });

// Same maps as the app code.
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };
const extOf = (p) => (p ? p.slice(p.lastIndexOf(".") + 1).toLowerCase() : "");

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const RELNS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CTNS = "http://schemas.openxmlformats.org/package/2006/content-types";

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

const relFile = (rels) => XML_DECL + `<Relationships xmlns="${RELNS}">${rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${r.mode ? ` TargetMode="${r.mode}"` : ""}/>`).join("")}</Relationships>`;

const contentTypes = () => XML_DECL + `<Types xmlns="${CTNS}">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Default Extension="emf" ContentType="image/x-emf"/>
<Default Extension="wmf" ContentType="image/x-wmf"/>
<Default Extension="tiff" ContentType="image/tiff"/>
<Default Extension="svg" ContentType="image/svg+xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
</Types>`;

const presentationXml = (slideIds = ["256"]) => XML_DECL + `<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}">
<p:sldIdLst>${slideIds.map((id, i) => `<p:sldId id="${id}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst>
<p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
<p:notesSz cx="6858000" cy="9144000"/>
<p:defaultTextStyle/>
</p:presentation>`;

const picXml = ({ id, name, rid, x = 1000000, y = 1000000, w = 3000000, h = 2000000 }) => `<p:pic>
<p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>`;

const linkedPicXml = ({ id, name }) => `<p:pic>
<p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:link="rId99"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="3000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>`;

const shapeWithBlipFillXml = ({ rid }) => `<p:sp>
<p:nvSpPr><p:cNvPr id="90" name="blipFillShape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="5000000" y="1000000"/><a:ext cx="3000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`;

const slideXml = (spTree) => XML_DECL + `<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}">
<p:cSld>
${spTree}
</p:cSld>
<p:clrMapOvr><a:overrideClrMapping/></p:clrMapOvr>
</p:sld>`;

const spTreeXml = (inner) => `<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${inner}
</p:spTree>`;

const layoutXml = (inner) => XML_DECL + `<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld>${spTreeXml(inner)}</p:cSld></p:sldLayout>`;

// Real binary payloads: PNG, JPEG, EMF (from the earlier generated set) + an inline SVG.
const imgDir = "C:\\Users\\hassa\\OneDrive\\Documentos\\deepseek-harness\\default-workspace\\ppt_images";
const PNG = fs.readFileSync(path.join(imgDir, "photo1.png"));
const JPEG = fs.readFileSync(path.join(imgDir, "photo2.jpg"));
const EMF = fs.readFileSync(path.join(imgDir, "photo3.emf"));
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="teal"/></svg>');
const TIFF = Buffer.concat([Buffer.from("II*\0"), PNG]); // fake tiff bytes; MIME gate is the point

const cases = [];

function deck(name, { media = {}, slideRels = [], slideInner = "", layoutMedia = {}, layoutRels = [], layoutInner = "", bgXml = "" }) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes());
  zip.file("_rels/.rels", relFile([{ id: "rId1", type: `${R}/officeDocument`, target: "ppt/presentation.xml" }]));
  zip.file("ppt/presentation.xml", presentationXml());
  zip.file("ppt/_rels/presentation.xml.rels", relFile([{ id: "rId1", type: `${R}/slide`, target: "slides/slide1.xml" }]));
  const cSld = `${bgXml}${spTreeXml(slideInner)}`;
  zip.file("ppt/slides/slide1.xml", slideXml(cSld));
  zip.file("ppt/slides/_rels/slide1.xml.rels", relFile(slideRels));
  if (layoutInner || layoutRels.length) {
    zip.file("ppt/slideLayouts/slideLayout1.xml", layoutXml(layoutInner));
    zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", relFile(layoutRels));
    // make the slide point at the layout so layout art is read
    zip.file("ppt/slides/_rels/slide1.xml.rels", relFile([...slideRels, { id: "rId900", type: `${R}/slideLayout`, target: "../slideLayouts/slideLayout1.xml" }]));
  }
  for (const [n, b] of Object.entries(media)) zip.file(n, b);
  for (const [n, b] of Object.entries(layoutMedia)) zip.file(n, b);
  cases.push({ name, zip });
}

// ---- case A: baseline png + jpeg (sanity; must render) ----
deck("A baseline png+jpeg", {
  media: { "ppt/media/image1.png": PNG, "ppt/media/image2.jpeg": JPEG },
  slideRels: [
    { id: "rId2", type: `${R}/image`, target: "../media/image1.png" },
    { id: "rId3", type: `${R}/image`, target: "../media/image2.jpeg" },
  ],
  slideInner: picXml({ id: "2", name: "png", rid: "rId2", y: 800000 }) + picXml({ id: "3", name: "jpeg", rid: "rId3", x: 5000000, y: 800000 }),
});

// ---- case B: media name with a space, Target percent-encoded (PowerPoint-style) ----
deck("B space in media name, %20 Target", {
  media: { "ppt/media/image 1.png": PNG },
  slideRels: [{ id: "rId2", type: `${R}/image`, target: "../media/image%201.png" }],
  slideInner: picXml({ id: "2", name: "space", rid: "rId2" }),
});

// ---- case C: backslash separators in Target (seen in foreign writers) ----
deck("C backslash Target", {
  media: { "ppt/media/image2.jpeg": JPEG },
  slideRels: [{ id: "rId2", type: `${R}/image`, target: "..\\media\\image2.jpeg" }],
  slideInner: picXml({ id: "2", name: "backslash", rid: "rId2" }),
});

// ---- case D: uppercase extension ----
deck("D uppercase .PNG", {
  media: { "ppt/media/IMAGE3.PNG": PNG },
  slideRels: [{ id: "rId2", type: `${R}/image`, target: "../media/IMAGE3.PNG" }],
  slideInner: picXml({ id: "2", name: "upper", rid: "rId2" }),
});

// ---- case E: EMF / WMF / TIFF pictures (very common in real Office decks) ----
deck("E emf+wmf+tiff", {
  media: { "ppt/media/vector1.emf": EMF, "ppt/media/vector2.wmf": EMF, "ppt/media/photo1.tiff": TIFF },
  slideRels: [
    { id: "rId2", type: `${R}/image`, target: "../media/vector1.emf" },
    { id: "rId3", type: `${R}/image`, target: "../media/vector2.wmf" },
    { id: "rId4", type: `${R}/image`, target: "../media/photo1.tiff" },
  ],
  slideInner: picXml({ id: "2", name: "emf", rid: "rId2", y: 800000 }) + picXml({ id: "3", name: "wmf", rid: "rId3", x: 5000000, y: 800000 }) + picXml({ id: "4", name: "tiff", rid: "rId4", x: 9000000, y: 800000 }),
});

// ---- case F: SVG picture (Office 2016+) ----
deck("F svg", {
  media: { "ppt/media/icon1.svg": SVG },
  slideRels: [{ id: "rId2", type: `${R}/image`, target: "../media/icon1.svg" }],
  slideInner: picXml({ id: "2", name: "svg", rid: "rId2" }),
});

// ---- case G: company logo picture living on the LAYOUT ----
deck("G picture on layout", {
  layoutMedia: { "ppt/media/layoutLogo.png": PNG },
  layoutRels: [{ id: "rId2", type: `${R}/image`, target: "../media/layoutLogo.png" }],
  layoutInner: picXml({ id: "20", name: "layout logo", rid: "rId2" }),
  slideRels: [],
  slideInner: "",
});

// ---- case H: shape picture-fill + slide picture background ----
deck("H shape blipFill + picture background", {
  media: { "ppt/media/bg1.png": PNG, "ppt/media/fill1.png": PNG },
  slideRels: [
    { id: "rId2", type: `${R}/image`, target: "../media/bg1.png" },
    { id: "rId3", type: `${R}/image`, target: "../media/fill1.png" },
  ],
  slideInner: shapeWithBlipFillXml({ rid: "rId3" }),
  bgXml: `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`,
});

// ---- case I: externally linked picture (blocked by design) ----
deck("I external link", {
  slideRels: [],
  slideInner: linkedPicXml({ id: "2", name: "linked" }),
});

// ---------------------------------------------------------------------------
async function main() {
  console.log("case | picture | imagePath | ext | MIME-gate | exists | bytes | editor result");
  console.log("---");
  for (const { name, zip } of cases) {
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const pkg = await PptxPackage.open(bytes, { fileName: `${name}.pptx` });
    const pres = readPresentation(pkg);
    const model = readSlide(pkg, pres.slides[0].path, pres);
    const els = flattenElements([...model.elements, ...model.under]).filter((e) => e.kind === "image");
    const bgImage = model.background?.type === "image" ? model.background.path : null;
    const items = [...els.map((e) => ({ label: e.name || e.id, p: e.imagePath })), ...(bgImage ? [{ label: "slide-bg", p: bgImage }] : [])];
    // shape picture fills
    for (const e of flattenElements([...model.elements, ...model.under])) {
      if (e.fill?.type === "image") items.push({ label: `fill:${e.name || e.id}`, p: e.fill.path });
    }
    if (!items.length) { console.log(`${name} | (no pictures)`); continue; }
    for (const it of items) {
      const gate = it.p ? MIME[extOf(it.p)] : undefined;
      const exists = it.p ? pkg.exists(it.p) : false;
      const bin = exists ? await pkg.bytes(it.p) : null;
      let result;
      if (!it.p) result = "unavailable (no rel)";
      else if (!gate) result = "UNAVAILABLE card (no MIME for ext)";
      else if (!bin) result = "STUCK 'Loading…' (bytes null)";
      else result = `RENDERS (${bin.length} bytes)`;
      console.log(`${name} | ${it.label} | ${it.p ?? "-"} | ${extOf(it.p || "")} | ${gate || "-"} | ${exists} | ${bin ? bin.length : "null"} | ${result}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

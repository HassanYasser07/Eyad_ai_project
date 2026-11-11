import React from "react";
import "../pptxEditor/pptxEditor.css"; // the .pptx-* rules SlideView relies on
import { PptxPackage, readPresentation, readSlide } from "../pptxEditor/engine/index.js";
import SlideView, { collectImagePaths } from "../pptxEditor/SlideView.jsx";
import { disposeMediaUrls, useMediaUrls } from "../pptxEditor/useMediaUrls.js";
import { fetchTemplatePptx } from "@/services/templateService";

/**
 * Thumbnail drawn from the FIRST SLIDE of a template's .pptx, using the same renderer as the editor.
 * Loaded lazily (only once the card scrolls near the viewport) and at most MAX_PARALLEL files at a time,
 * so a big gallery does not download every deck at once. While loading, or if the file cannot be read,
 * the `fallback` placeholder stays visible.
 */
const MAX_PARALLEL = 2;
const EMU_PER_CSS_PX = 9525;
let running = 0;
const waiting = [];
const schedule = (job) => new Promise((resolve, reject) => {
  const run = () => {
    running += 1;
    job().then(resolve, reject).finally(() => { running -= 1; waiting.shift()?.(); });
  };
  if (running < MAX_PARALLEL) run(); else waiting.push(run);
});

const NO_LABELS = { loading: "", imageUnavailable: "", chartNote: "", chartPreview: "", viewOnly: "", placeholderHint: "", newTextHint: "" };

export default function TemplateThumbnail({ template, title, fallback, onSlideCount }) {
  const boxRef = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  const [deck, setDeck] = React.useState(null); // { pkg, model, w, h } of slide 1
  const [failed, setFailed] = React.useState(false);
  const [box, setBox] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || !template?.pptx_path) return undefined;
    let cancelled = false;
    let opened = null;
    schedule(async () => {
      if (cancelled) return null;
      const { bytes, name } = await fetchTemplatePptx(template, title);
      if (cancelled) return null;
      const pkg = await PptxPackage.open(bytes, { fileName: name });
      const pres = readPresentation(pkg);
      if (!pres.slides.length) throw new Error("NO_SLIDES");
      const model = readSlide(pkg, pres.slides[0].path, pres);
      return { pkg, model, count: pres.slides.length, w: pres.size.w / EMU_PER_CSS_PX, h: pres.size.h / EMU_PER_CSS_PX };
    }).then((result) => {
      if (!result) return;
      if (cancelled) { disposeMediaUrls(result.pkg); return; }
      opened = result;
      setDeck(result);
      onSlideCount?.(result.count);
    }).catch((err) => {
      if (cancelled) return;
      console.warn("Could not render a template thumbnail", err?.message);
      setFailed(true);
    });
    return () => { cancelled = true; if (opened) disposeMediaUrls(opened.pkg); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, template?.pptx_path]);

  const urls = useMediaUrls(deck?.pkg || null, deck ? collectImagePaths(deck.model) : []);

  if (failed) return fallback;
  const k = deck && box.w && box.h ? Math.min(box.w / deck.w, box.h / deck.h) : 0;
  return (
    <span ref={boxRef} className="relative block h-full w-full overflow-hidden bg-white">
      {!k && <span className="absolute inset-0 block">{fallback}</span>}
      {k > 0 && (
        <span aria-hidden="true" className="absolute block" style={{ width: deck.w, height: deck.h, left: (box.w - deck.w * k) / 2, top: (box.h - deck.h * k) / 2, transform: `scale(${k})`, transformOrigin: "0 0", pointerEvents: "none" }}>
          <SlideView model={deck.model} urls={urls} labels={NO_LABELS} />
        </span>
      )}
    </span>
  );
}

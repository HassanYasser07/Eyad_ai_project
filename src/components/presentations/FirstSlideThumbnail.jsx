import React from "react";
import "../pptxEditor/pptxEditor.css"; // the .pptx-* rules SlideView relies on
import { PptxPackage, readPresentation, readSlide } from "../pptxEditor/engine/index.js";
import SlideView, { collectImagePaths } from "../pptxEditor/SlideView.jsx";
import { disposeMediaUrls, useMediaUrls } from "../pptxEditor/useMediaUrls.js";

/**
 * Thumbnail drawn from the FIRST SLIDE of a .pptx, with the same renderer the editor (and the template
 * gallery) uses. No PNG is generated or stored: the slide is rendered from the file itself.
 *
 * `load` is an async function returning { bytes, name }. It runs lazily (only once the box scrolls near the
 * viewport), at most MAX_PARALLEL at a time, and again whenever `reloadKey` changes (e.g. a newer version).
 * While loading, or if the file cannot be read, `fallback` stays visible.
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

export default function FirstSlideThumbnail({ load, reloadKey = "", fallback = null, className = "" }) {
  const boxRef = React.useRef(null);
  const loadRef = React.useRef(load);
  loadRef.current = load;
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
    if (!visible) return undefined;
    let cancelled = false;
    let opened = null;
    setFailed(false);
    schedule(async () => {
      if (cancelled) return null;
      const { bytes, name } = await loadRef.current();
      if (cancelled) return null;
      const pkg = await PptxPackage.open(bytes, { fileName: name });
      const pres = readPresentation(pkg);
      if (!pres.slides.length) throw new Error("NO_SLIDES");
      const model = readSlide(pkg, pres.slides[0].path, pres);
      return { pkg, model, w: pres.size.w / EMU_PER_CSS_PX, h: pres.size.h / EMU_PER_CSS_PX };
    }).then((result) => {
      if (!result) return;
      if (cancelled) { disposeMediaUrls(result.pkg); return; }
      opened = result;
      setDeck((previous) => { if (previous) disposeMediaUrls(previous.pkg); return result; });
    }).catch((err) => {
      if (cancelled) return;
      console.warn("Could not render a presentation thumbnail", err?.message);
      setFailed(true);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reloadKey]);

  // Release the object URLs of the last opened deck when the thumbnail goes away.
  const deckRef = React.useRef(null);
  deckRef.current = deck;
  React.useEffect(() => () => { if (deckRef.current) disposeMediaUrls(deckRef.current.pkg); }, []);

  const urls = useMediaUrls(deck?.pkg || null, deck ? collectImagePaths(deck.model) : []);

  if (failed && !deck) return fallback;
  const k = deck && box.w && box.h ? Math.min(box.w / deck.w, box.h / deck.h) : 0;
  return (
    <span ref={boxRef} className={`relative block h-full w-full overflow-hidden bg-white ${className}`}>
      {!k && <span className="absolute inset-0 block">{fallback}</span>}
      {k > 0 && (
        <span aria-hidden="true" className="absolute block" style={{ width: deck.w, height: deck.h, left: (box.w - deck.w * k) / 2, top: (box.h - deck.h * k) / 2, transform: `scale(${k})`, transformOrigin: "0 0", pointerEvents: "none" }}>
          <SlideView model={deck.model} urls={urls} labels={NO_LABELS} />
        </span>
      )}
    </span>
  );
}

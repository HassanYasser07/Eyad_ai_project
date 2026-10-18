import React from "react";
import { X, Plus, Copy, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import SlideView, { collectImagePaths } from "./SlideView.jsx";
import { useMediaUrls } from "./useMediaUrls.js";
import { readSlide } from "./engine/slideModel.js";
import { IconButton } from "./Controls.jsx";

/** Tracks the visual viewport so a software keyboard never hides the sheet or the canvas. */
export function useVisualViewport(enabled = true) {
  const [vp, setVp] = React.useState({ h: null, top: 0 });
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!enabled) {
      setVp((current) => current.h === null && current.top === 0 ? current : { h: null, top: 0 });
      return undefined;
    }
    const v = window.visualViewport;
    if (!v) return undefined;
    const update = () => {
      // Integer CSS pixels avoid sub-pixel viewport jitter causing repeated state updates.
      const h = Math.round(v.height);
      const top = Math.round(v.offsetTop);
      setVp((current) => current.h === h && current.top === top ? current : { h, top });
    };
    update();
    v.addEventListener("resize", update); v.addEventListener("scroll", update);
    return () => { v.removeEventListener("resize", update); v.removeEventListener("scroll", update); };
  }, [enabled]);
  return vp;
}

export function BottomSheet({ title, onClose, children, testId, tall = false, footer }) {
  return (
    <div className={`pe-sheet ${tall ? "is-tall" : ""}`} role="dialog" aria-label={title} data-testid={testId}>
      <div className="pe-sheet-grab" aria-hidden="true" />
      <div className="pe-sheet-head"><strong>{title}</strong><IconButton icon={X} label="Close" onClick={onClose} testId={`${testId}-close`} /></div>
      <div className="pe-sheet-body">{children}</div>
      {footer && <div className="pe-sheet-foot">{footer}</div>}
    </div>
  );
}

/** Dedicated text-editing mode: native <textarea> (reliable with mobile keyboards), committed explicitly. */
export function TextSheet({ initial, title, hint, onDone, onCancel, t, rtl }) {
  const [value, setValue] = React.useState(initial);
  const ref = React.useRef(null);
  React.useEffect(() => { const el = ref.current; if (el) { el.focus({ preventScroll: true }); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  const changed = value !== initial;
  return (
    <BottomSheet title={title} onClose={onCancel} testId="pptx-text-sheet" footer={
      <>
        <button type="button" className="pe-btn-secondary" onClick={onCancel} data-testid="pptx-text-cancel">{t("pptxEditor.cancel")}</button>
        <button type="button" className="pe-btn-primary" onClick={() => onDone(value.split("\n"))} disabled={!changed} data-testid="pptx-text-done"><Check size={16} aria-hidden="true" />{t("pptxEditor.done")}</button>
      </>
    }>
      <textarea ref={ref} className="pe-textarea" dir={rtl ? "rtl" : "auto"} value={value} rows={5} placeholder={hint} onChange={(e) => setValue(e.target.value)} aria-label={title} data-testid="pptx-textarea" />
      <p className="pe-note">{t("pptxEditor.textHint")}</p>
    </BottomSheet>
  );
}

function useInView(rootMargin = "300px") {
  const ref = React.useRef(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen];
}

export function Thumb({ pkg, pres, slide, width, labels }) {
  const [ref, seen] = useInView();
  const rev = pkg.rev(slide.path);
  const model = React.useMemo(() => { if (!seen) return null; try { return readSlide(pkg, slide.path, pres); } catch { return null; } }, [pkg, slide.path, rev, seen, pres.size.w, pres.size.h]);  
  const urls = useMediaUrls(pkg, model ? collectImagePaths(model) : []);
  const W = pres.size.w / 9525, H = pres.size.h / 9525, k = width / W;
  return (
    <div ref={ref} className="pe-thumb" style={{ width, height: H * k }}>
      {model && <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "0 0", pointerEvents: "none" }}><SlideView model={model} urls={urls} labels={labels} /></div>}
    </div>
  );
}

export function SlidesPanel({ pkg, pres, idx, onSelect, onAdd, onDuplicate, onDelete, onMove, t, width = 168, grid = false, labels }) {
  const dragFrom = React.useRef(null);
  const [over, setOver] = React.useState(null);
  return (
    <div className={`pe-slides ${grid ? "is-grid" : ""}`} data-testid="pptx-slides">
      <ol>
        {pres.slides.map((s, i) => (
          <li key={s.id} className={`${i === idx ? "is-active" : ""} ${over === i ? "is-over" : ""}`}
            draggable={!grid}
            onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); if (dragFrom.current !== null && dragFrom.current !== i) onMove(dragFrom.current, i); dragFrom.current = null; }}>
            <button type="button" className="pe-thumb-btn" onClick={() => onSelect(i)} aria-label={t("pptxEditor.goToSlide", { n: i + 1 })} aria-current={i === idx} data-testid={`pptx-thumb-${i}`}>
              <span className="pe-thumb-n">{i + 1}</span>
              <Thumb pkg={pkg} pres={pres} slide={s} width={width} labels={labels} />
            </button>
            {i === idx && (
              <div className="pe-thumb-actions">
                <IconButton icon={ChevronUp} label={t("pptxEditor.moveUp")} onClick={() => onMove(i, i - 1)} disabled={i === 0} testId="pptx-slide-up" />
                <IconButton icon={ChevronDown} label={t("pptxEditor.moveDown")} onClick={() => onMove(i, i + 1)} disabled={i === pres.slides.length - 1} testId="pptx-slide-down" />
                <IconButton icon={Copy} label={t("pptxEditor.duplicateSlide")} onClick={() => onDuplicate(i)} testId="pptx-slide-dup" />
                <IconButton icon={Trash2} label={t("pptxEditor.deleteSlide")} danger onClick={() => onDelete(i)} disabled={pres.slides.length < 2} testId="pptx-slide-del" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="pe-add-slide" onClick={onAdd} data-testid="pptx-add-slide"><Plus size={16} aria-hidden="true" />{t("pptxEditor.addSlide")}</button>
    </div>
  );
}

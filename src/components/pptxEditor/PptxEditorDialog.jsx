import React from "react";
import { createPortal } from "react-dom";
import {
  X, Undo2, Redo2, Download, MoreHorizontal, Type, Square, Circle, Triangle, ArrowRight, Star, Minus, ImagePlus, Upload, FileUp, Layers, Palette, Copy, Trash2,
  ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, ChevronLeft, ChevronRight, LayoutGrid, MousePointerSquareDashed, RotateCcw, AlertTriangle, SquareDashedMousePointer, Move3d, Info, RectangleHorizontal, Loader2,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useI18n } from "@/i18n/I18nContext";
import { PptxPackage, PptxError, readPresentation, readSlide, setBounds, deleteElements, duplicateElements, reorderElements, groupElements, ungroupElement, setText, setTextProps, setShapeStyle, setOpacity, addTextBox, addShape, addPicture, replacePicture, setAltText, tableRows, tableCols, copyElements, pasteElements, addSlide, duplicateSlide, deleteSlide, moveSlide, listLayouts, hasSections, computeAlign, computeDistribute, rotatedBox, unionBox } from "./engine/index.js";
import { checkPptxFile, readFile, saveBytes, pickFile, PPTX_ACCEPT, IMAGE_ACCEPT, safeName, saveDraft, loadDraft, clearDraft, imageInfo } from "./fileIO.js";
import { disposeMediaUrls } from "./useMediaUrls.js";
import Canvas from "./Canvas.jsx";
import Inspector, { elementLabel } from "./Inspector.jsx";
import { BottomSheet, TextSheet, SlidesPanel, useVisualViewport } from "./Sheets.jsx";
import { IconButton } from "./Controls.jsx";
import "./pptxEditor.css";

const bounds = (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot, flipH: e.flipH, flipV: e.flipV });

function useCompact() {
  const q = "(max-width: 767px), (max-height: 520px) and (pointer: coarse)";
  const [v, setV] = React.useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  React.useEffect(() => { const m = window.matchMedia(q); const h = () => setV(m.matches); m.addEventListener("change", h); h(); return () => m.removeEventListener("change", h); }, []);
  return v;
}

export default function PptxEditorDialog({ onClose }) {
  const { t, direction } = useI18n();
  const compact = useCompact();
  const vp = useVisualViewport();
  const rootRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const original = React.useRef(null);
  const clipboard = React.useRef(null);
  const [, force] = React.useReducer((n) => n + 1, 0);

  const [pkg, setPkg] = React.useState(null);
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState(null);
  const [feedback, setFeedback] = React.useState(null);
  const [idx, setIdx] = React.useState(0);
  const [selection, setSelection] = React.useState([]);
  const [multi, setMulti] = React.useState(false);
  const [locked, setLocked] = React.useState(() => new Set());
  const [grid, setGrid] = React.useState({ show: false, snap: false });
  const [zoom, setZoom] = React.useState(100);
  const [sheet, setSheet] = React.useState(null); // format | arrange | layers | insertShape | more | layouts | report
  const [tab, setTab] = React.useState("format");
  const [textEdit, setTextEdit] = React.useState(null);
  const [slidesOpen, setSlidesOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);
  const [report, setReport] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [panel, setPanel] = React.useState("format");

  // ----- derived document state -----
  const pres = React.useMemo(() => (pkg ? readPresentation(pkg) : null), [pkg, pkg?.version]);  
  const safeIdx = pres ? Math.min(idx, pres.slides.length - 1) : 0;
  const model = React.useMemo(() => {
    if (!pkg || !pres || !pres.slides[safeIdx]) return null;
    try { return readSlide(pkg, pres.slides[safeIdx].path, pres); } catch (err) { return { error: err }; }
  }, [pkg, pres, safeIdx, pkg?.version]);  
  const okModel = model && !model.error ? model : null;
  const sel = okModel ? okModel.elements.filter((e) => selection.includes(e.id)) : [];
  const lockedIds = React.useMemo(() => new Set([...locked].filter((k) => okModel && k.startsWith(`${okModel.path}#`)).map((k) => k.split("#")[1])), [locked, okModel]);
  const labels = React.useMemo(() => ({ canvas: t("pptxEditor.canvas"), locked: t("pptxEditor.locked"), loading: t("pptxEditor.loadingImage"), imageUnavailable: t("pptxEditor.imageUnavailable"), chartNote: t("pptxEditor.chartNote"), chartPreview: t("pptxEditor.chartPreview"), viewOnly: t("pptxEditor.viewOnly"), placeholderHint: t("pptxEditor.placeholderHint") }), [t]);

  React.useEffect(() => { if (pkg) return pkg.subscribe(() => force()); return undefined; }, [pkg]);
  React.useEffect(() => { if (okModel) setSelection((s) => { const n = s.filter((id) => okModel.elements.some((e) => e.id === id)); return n.length === s.length ? s : n; }); }, [okModel]);
  React.useEffect(() => { if (!feedback) return undefined; const id = setTimeout(() => setFeedback(null), feedback.kind === "error" ? 7000 : 3500); return () => clearTimeout(id); }, [feedback]);
  React.useEffect(() => { loadDraft().then((d) => d && d.bytes && setDraft(d)); }, []);
  React.useEffect(() => () => { if (pkgRef.current) disposeMediaUrls(pkgRef.current); }, []);
  const pkgRef = React.useRef(null);
  pkgRef.current = pkg;

  const errText = (err) => {
    const key = `pptxEditor.err.${err?.code}`;
    const msg = err?.code ? t(key) : null;
    return msg && msg !== key ? msg : t("pptxEditor.err.generic");
  };
  const run = React.useCallback((fn, ok) => {
    try { const r = fn(); if (ok) setFeedback({ kind: "ok", text: ok }); return r; }
    catch (err) { setFeedback({ kind: "error", text: errText(err) }); return undefined; }
  }, [t]);  

  // ----- opening files -----
  const openBytes = async (buf, name, orig, { fromDraft = false } = {}) => {
    setBusy(t("pptxEditor.opening"));
    try {
      const p = await PptxPackage.open(buf, { fileName: name });
      const pr = readPresentation(p);
      if (!pr.slides.length) throw new PptxError("NO_SLIDES", "No slides");
      const warnings = [];
      pr.slides.forEach((s, i) => { try { for (const w of readSlide(p, s.path, pr).warnings) warnings.push({ slide: i + 1, ...w }); } catch { warnings.push({ slide: i + 1, code: "slide-unreadable", message: t("pptxEditor.slideUnreadable") }); } });
      original.current = orig || new Uint8Array(buf).slice();
      if (pkgRef.current) disposeMediaUrls(pkgRef.current);
      if (fromDraft) p.savedVersion = -1;
      setPkg(p); setFileName(name); setIdx(0); setSelection([]); setLocked(new Set()); setSheet(null); setTextEdit(null);
      setReport({ slides: pr.slides.length, warnings, sections: hasSections(p), problems: p.validate() });
    } catch (err) { setFeedback({ kind: "error", text: errText(err) }); } finally { setBusy(null); }
  };
  const openFile = async (file) => {
    const bad = checkPptxFile(file);
    if (bad) { setFeedback({ kind: "error", text: t(`pptxEditor.err.${bad}`) }); return; }
    try { await openBytes(new Uint8Array(await readFile(file)), file.name); } catch { setFeedback({ kind: "error", text: t("pptxEditor.err.READ_FAILED") }); }
  };
  const resetToOriginal = () => { const o = original.current; if (o) openBytes(o.slice(), fileName, o); };

  // ----- autosave draft + lifecycle -----
  const flushDraft = React.useCallback(async () => {
    const p = pkgRef.current;
    if (!p || !p.isDirty || p.tx) return;
    try { const bytes = await p.exportBytes({ compression: "STORE" }); await saveDraft({ name: p.fileName, bytes, original: original.current, updatedAt: Date.now() }); } catch { /* best effort */ }
  }, []);
  React.useEffect(() => {
    if (!pkg?.isDirty) return undefined;
    const id = setTimeout(flushDraft, 1200);
    return () => clearTimeout(id);
  }, [pkg, pkg?.version, flushDraft]);
  React.useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") flushDraft(); };
    const warn = (e) => { if (pkgRef.current?.isDirty) { e.preventDefault(); e.returnValue = ""; } };
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", flushDraft); window.addEventListener("beforeunload", warn);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", flushDraft); window.removeEventListener("beforeunload", warn); };
  }, [flushDraft]);

  const requestClose = () => {
    if (pkg?.isDirty) setConfirm({ text: t("pptxEditor.discardConfirm"), yes: t("pptxEditor.discard"), run: async () => { await clearDraft(); onClose(); } });
    else { clearDraft(); onClose(); }
  };

  // ----- actions -----
  const path = okModel?.path;
  const ids = selection;
  const a = React.useMemo(() => ({
    select: (v) => setSelection(v),
    selectBehind: () => canvasRef.current?.selectBehind(),
    field: (partial) => run(() => { const e = sel[0]; setBounds(pkg, path, [{ id: e.id, ...bounds(e), ...partial }], "Edit"); }),
    order: (mode) => run(() => reorderElements(pkg, path, ids, mode)),
    align: (mode) => run(() => {
      const items = sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry).map((e) => ({ id: e.id, box: rotatedBox(bounds(e)) }));
      const ref = sel.length > 1 ? unionBox(items.map((i) => i.box)) : { x: 0, y: 0, w: okModel.size.w, h: okModel.size.h };
      const d = computeAlign(items, mode, ref);
      setBounds(pkg, path, sel.filter((e) => d[e.id]).map((e) => ({ id: e.id, ...bounds(e), x: e.x + d[e.id].dx, y: e.y + d[e.id].dy })), "Align");
    }),
    distribute: (axis) => run(() => {
      const d = computeDistribute(sel.map((e) => ({ id: e.id, box: rotatedBox(bounds(e)) })), axis);
      setBounds(pkg, path, sel.filter((e) => d[e.id]).map((e) => ({ id: e.id, ...bounds(e), x: e.x + d[e.id].dx, y: e.y + d[e.id].dy })), "Distribute");
    }),
    group: () => run(() => setSelection([groupElements(pkg, path, ids)])),
    ungroup: () => run(() => setSelection(ungroupElement(pkg, path, ids[0]))),
    duplicate: () => run(() => setSelection(duplicateElements(pkg, path, ids))),
    remove: () => run(() => { deleteElements(pkg, path, ids); setSelection([]); }),
    toggleLock: () => setLocked((s) => { const n = new Set(s); const keys = ids.map((i) => `${path}#${i}`); const all = keys.every((k) => n.has(k)); keys.forEach((k) => (all ? n.delete(k) : n.add(k))); return n; }),
    text: (props) => run(() => setTextProps(pkg, path, ids, props)),
    shape: (style) => run(() => setShapeStyle(pkg, path, ids, style)),
    opacity: (v) => run(() => setOpacity(pkg, path, ids, v, sel[0]?.fill?.hex)),
    editText: () => openText(ids[0]),
    cell: (r, c, texts) => run(() => setText(pkg, path, ids[0], texts, { row: r, col: c })),
    tableRows: (op, i) => run(() => tableRows(pkg, path, ids[0], op, i)),
    tableCols: (op, i) => run(() => tableCols(pkg, path, ids[0], op, i)),
    alt: (txt) => run(() => setAltText(pkg, path, ids[0], txt)),
    replaceImage: () => pickFile({ accept: IMAGE_ACCEPT, onPick: async (f) => {
      if (!f) return;
      const info = await imageInfo(f);
      if (!info) { setFeedback({ kind: "error", text: t("pptxEditor.err.BAD_IMAGE") }); return; }
      run(() => replacePicture(pkg, path, ids[0], { bytes: info.bytes, ext: info.ext, naturalRatio: info.w / info.h }), t("pptxEditor.imageReplaced"));
    } }),
  }), [pkg, path, ids, sel, lockedIds, okModel, run, t]);  

  function openText(id) {
    const el = okModel?.elements.find((e) => e.id === id);
    if (!el) return;
    if (el.kind === "table") { if (compact) { setTab("format"); setSheet("format"); } else setPanel("format"); return; }
    if (!el.text && el.kind !== "shape" && el.kind !== "text") return;
    if (lockedIds.has(id)) { setFeedback({ kind: "error", text: t("pptxEditor.lockedHint") }); return; }
    setSelection([id]); setSheet(null); setTextEdit({ id });
  }
  const commitBounds = (changes, label) => run(() => setBounds(pkg, path, changes, label));
  const center = (w, h) => ({ x: (okModel.size.w - w) / 2, y: (okModel.size.h - h) / 2 });
  const insertText = () => run(() => { const w = okModel.size.w * 0.4, h = okModel.size.h * 0.14; const id = addTextBox(pkg, path, { ...center(w, h), w, h, text: t("pptxEditor.newText") }); setSelection([id]); setTextEdit({ id }); });
  const insertShape = (prst) => run(() => { const w = prst === "line" ? okModel.size.w * 0.3 : okModel.size.w * 0.2, h = prst === "line" ? 0 : w * 0.7; const id = addShape(pkg, path, { prst, ...center(w, h), w, h }); setSelection([id]); setSheet(null); });
  const insertImage = () => pickFile({ accept: IMAGE_ACCEPT, onPick: async (f) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { setFeedback({ kind: "error", text: t("pptxEditor.err.FILE_TOO_LARGE") }); return; }
    const info = await imageInfo(f);
    if (!info) { setFeedback({ kind: "error", text: t("pptxEditor.err.BAD_IMAGE") }); return; }
    run(() => {
      const k = Math.min(1, (okModel.size.w * 0.6) / (info.w * 9525), (okModel.size.h * 0.6) / (info.h * 9525));
      const w = info.w * 9525 * k, h = info.h * 9525 * k;
      setSelection([addPicture(pkg, path, { bytes: info.bytes, ext: info.ext, ...center(w, h), w, h, name: safeName(f.name, "Picture") })]);
    });
  } });
  const undo = () => { pkg.undo(); };
  const redo = () => { pkg.redo(); };
  const exportNow = async () => {
    setBusy(t("pptxEditor.exporting"));
    try {
      const bytes = await pkg.exportBytes();
      const problems = pkg.validate();
      const res = await saveBytes(bytes, `${safeName(fileName)}-edited.pptx`);
      if (res.method.endsWith("cancelled")) return;
      pkg.markSaved(); clearDraft();
      setFeedback(problems.length ? { kind: "error", text: t("pptxEditor.exportWarn", { n: problems.length }) } : { kind: "ok", text: res.method === "download" ? t("pptxEditor.exported") : t("pptxEditor.exportedShare") });
    } catch (err) { setFeedback({ kind: "error", text: `${t("pptxEditor.err.EXPORT")} ${err?.message || ""}`.trim() }); } finally { setBusy(null); }
  };
  const slideOps = {
    select: (i) => { setIdx(i); setSelection([]); setSlidesOpen(false); },
    add: () => setSheet("layouts"),
    addWith: (layout) => run(() => { addSlide(pkg, safeIdx, layout); setIdx(safeIdx + 1); setSelection([]); setSheet(null); }),
    del: (i) => run(() => { deleteSlide(pkg, i); setIdx(Math.max(0, i - 1)); setSelection([]); }),
    move: (from, to) => run(() => { moveSlide(pkg, from, to); setIdx(to); }),
  };
  const dupSlide = async (i) => { try { await duplicateSlide(pkg, i); setIdx(i + 1); setSelection([]); } catch (err) { setFeedback({ kind: "error", text: errText(err) }); } };
  const pasteNow = () => run(() => { if (clipboard.current) setSelection(pasteElements(pkg, path, clipboard.current)); });

  // ----- keyboard shortcuts (desktop) -----
  React.useEffect(() => {
    if (!pkg) return undefined;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target?.isContentEditable) { if (e.key === "Escape" && textEdit) setTextEdit(null); return; }
      if (!okModel) return;
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      const act = (fn) => { e.preventDefault(); fn(); };
      if (mod && k === "z") act(e.shiftKey ? redo : undo);
      else if (mod && k === "y") act(redo);
      else if (mod && k === "s") act(exportNow);
      else if (mod && k === "a") act(() => setSelection(okModel.elements.filter((x) => !x.hidden).map((x) => x.id)));
      else if (mod && k === "d" && ids.length) act(a.duplicate);
      else if (mod && k === "c" && ids.length) act(() => run(() => { clipboard.current = copyElements(pkg, path, ids); }, t("pptxEditor.copied")));
      else if (mod && k === "v" && clipboard.current) act(pasteNow);
      else if (mod && k === "g" && ids.length) act(e.shiftKey ? a.ungroup : a.group);
      else if (mod && e.key === "]" && ids.length) act(() => a.order(e.shiftKey ? "front" : "forward"));
      else if (mod && e.key === "[" && ids.length) act(() => a.order(e.shiftKey ? "back" : "backward"));
      else if (mod && (e.key === "0")) act(() => canvasRef.current?.fit());
      else if (mod && (e.key === "=" || e.key === "+")) act(() => canvasRef.current?.zoomBy(1.25));
      else if (mod && e.key === "-") act(() => canvasRef.current?.zoomBy(0.8));
      else if ((e.key === "Delete" || e.key === "Backspace") && ids.length) act(a.remove);
      else if (e.key === "Enter" && ids.length === 1) act(() => openText(ids[0]));
      else if (e.key === "Escape") act(() => { if (confirm) setConfirm(null); else if (slidesOpen) setSlidesOpen(false); else if (sheet) setSheet(null); else if (ids.length) setSelection([]); });
      else if (e.key === "PageDown") act(() => setIdx((i) => Math.min(pres.slides.length - 1, i + 1)));
      else if (e.key === "PageUp") act(() => setIdx((i) => Math.max(0, i - 1)));
      else if (e.key.startsWith("Arrow") && ids.length) {
        const step = (e.shiftKey ? 10 : 1) * 9525, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        act(() => run(() => setBounds(pkg, path, sel.filter((x) => !lockedIds.has(x.id) && !x.readOnlyGeometry).map((x) => ({ id: x.id, ...bounds(x), x: x.x + d[0], y: x.y + d[1] })), "Nudge")));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // intentionally re-bound each render so handlers see current state

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) openFile(f); };
  const Zoom = <><IconButton icon={ZoomOut} label={t("pptxEditor.zoomOut")} onClick={() => canvasRef.current?.zoomBy(0.8)} /><span className="pe-zoom" data-testid="pptx-zoom">{zoom}%</span><IconButton icon={ZoomIn} label={t("pptxEditor.zoomIn")} onClick={() => canvasRef.current?.zoomBy(1.25)} /><IconButton icon={Maximize} label={t("pptxEditor.fitScreen")} onClick={() => canvasRef.current?.fit()} testId="pptx-fit" /></>;
  const textEl = textEdit && okModel?.elements.find((e) => e.id === textEdit.id);
  const style = vp.h ? { height: vp.h, transform: vp.top ? `translateY(${vp.top}px)` : undefined } : undefined;

  // ============ render ============
  return createPortal(
    <div ref={rootRef} className={`pe-root ${compact ? "is-compact" : "is-desktop"}`} dir={direction} style={style} role="dialog" aria-modal="true" aria-label={t("pptxEditor.title")} data-testid="pptx-editor"
      onDragOver={(e) => { e.preventDefault(); if (!pkg) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {!pkg ? (
        <Start t={t} onClose={onClose} onPick={() => pickFile({ accept: PPTX_ACCEPT, onPick: (f) => f && openFile(f) })} dragOver={dragOver} busy={busy} draft={draft}
          onResume={() => openBytes(draft.bytes, draft.name, draft.original, { fromDraft: true })} onDiscardDraft={async () => { await clearDraft(); setDraft(null); }} />
      ) : (
        <>
          <header className="pe-top">
            <IconButton icon={X} label={t("pptxEditor.close")} onClick={requestClose} testId="pptx-close" />
            <div className="pe-title"><strong title={fileName}>{fileName}</strong>{pkg.isDirty && <span className="pe-dot" title={t("pptxEditor.unsaved")} data-testid="pptx-dirty" />}</div>
            <IconButton icon={Undo2} label={t("pptxEditor.undo")} onClick={undo} disabled={!pkg.canUndo} testId="pptx-undo" />
            <IconButton icon={Redo2} label={t("pptxEditor.redo")} onClick={redo} disabled={!pkg.canRedo} testId="pptx-redo" />
            {!compact && <><span className="pe-sep" />{Zoom}<span className="pe-sep" />
              <IconButton icon={Grid3x3} label={t("pptxEditor.grid")} active={grid.show} onClick={() => setGrid((g) => ({ ...g, show: !g.show }))} testId="pptx-grid" />
              <IconButton icon={Magnet} label={t("pptxEditor.snapGrid")} active={grid.snap} onClick={() => setGrid((g) => ({ ...g, snap: !g.snap }))} />
              <IconButton icon={RotateCcw} label={t("pptxEditor.reset")} onClick={() => setConfirm({ text: t("pptxEditor.resetConfirm"), yes: t("pptxEditor.reset"), run: resetToOriginal })} testId="pptx-reset" />
              <IconButton icon={Info} label={t("pptxEditor.report")} onClick={() => setSheet("report")} active={report?.warnings.length > 0} testId="pptx-report" /></>}
            <span className="pe-grow" />
            <button type="button" className="pe-btn-primary" onClick={exportNow} disabled={!!busy} data-testid="pptx-export">{busy ? <Loader2 className="pe-spin" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}<span>{t("pptxEditor.export")}</span></button>
            {compact && <IconButton icon={MoreHorizontal} label={t("pptxEditor.more")} onClick={() => setSheet("more")} testId="pptx-more" />}
          </header>

          {!compact && (
            <div className="pe-ribbon" role="toolbar" aria-label={t("pptxEditor.insert")}>
              <IconButton icon={Type} label={t("pptxEditor.addText")} text onClick={insertText} testId="pptx-add-text" />
              {SHAPES.map(([p, I, k]) => <IconButton key={p} icon={I} label={t(`pptxEditor.shape.${k}`)} onClick={() => insertShape(p)} testId={`pptx-add-${p}`} />)}
              <IconButton icon={ImagePlus} label={t("pptxEditor.addImage")} text onClick={insertImage} testId="pptx-add-image" />
              <span className="pe-sep" />
              <IconButton icon={Copy} label={t("pptxEditor.copy")} onClick={() => run(() => { clipboard.current = copyElements(pkg, path, ids); }, t("pptxEditor.copied"))} disabled={!ids.length} />
              <IconButton icon={Layers} label={t("pptxEditor.paste")} onClick={pasteNow} disabled={!clipboard.current} />
            </div>
          )}

          <div className="pe-body">
            {!compact && <aside className="pe-left"><SlidesPanel pkg={pkg} pres={pres} idx={safeIdx} onSelect={slideOps.select} onAdd={slideOps.add} onDuplicate={dupSlide} onDelete={slideOps.del} onMove={slideOps.move} t={t} labels={labels} /></aside>}
            <main className="pe-main" dir="ltr">
              {okModel ? (
                <Canvas ref={canvasRef} pkg={pkg} model={okModel} selection={selection} onSelect={setSelection} onCommit={commitBounds} onEditText={openText} multi={multi} grid={grid} locked={lockedIds} labels={labels} onZoom={setZoom} compact={compact} />
              ) : <div className="pe-error"><AlertTriangle aria-hidden="true" />{t("pptxEditor.slideUnreadable")}</div>}
              {compact && pres && (
                <div className="pe-slidenav">
                  <IconButton icon={ChevronLeft} label={t("pptxEditor.prevSlide")} onClick={() => slideOps.select(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0} testId="pptx-prev" />
                  <button type="button" onClick={() => setSlidesOpen(true)} data-testid="pptx-slides-open" aria-label={t("pptxEditor.slides")}>{safeIdx + 1} / {pres.slides.length}</button>
                  <IconButton icon={ChevronRight} label={t("pptxEditor.nextSlide")} onClick={() => slideOps.select(Math.min(pres.slides.length - 1, safeIdx + 1))} disabled={safeIdx >= pres.slides.length - 1} testId="pptx-next" />
                </div>
              )}
              {compact && multi && <div className="pe-chip-mode">{t("pptxEditor.multiOn")}</div>}
            </main>
            {!compact && (
              <aside className="pe-right">
                <div className="pe-tabs" role="tablist">{["format", "arrange", "layers"].map((k) => <button key={k} role="tab" aria-selected={panel === k} className={panel === k ? "is-active" : ""} onClick={() => setPanel(k)}>{t(`pptxEditor.tab.${k}`)}</button>)}</div>
                <div className="pe-right-body">
                  {panel === "format" ? <><Inspector tab="format" sel={sel} model={okModel} a={a} t={t} locked={lockedIds} />{sel.length > 0 && <Inspector tab="text" sel={sel} model={okModel} a={a} t={t} locked={lockedIds} />}</>
                    : <Inspector tab={panel} sel={sel} model={okModel} a={a} t={t} locked={lockedIds} />}
                </div>
              </aside>
            )}
          </div>

          {!compact && <footer className="pe-foot"><span>{t("pptxEditor.slideOf", { n: safeIdx + 1, total: pres?.slides.length || 0 })}</span><span className="pe-grow" /><span className="pe-hint">{t("pptxEditor.shortcutsHint")}</span></footer>}

          {compact && !textEdit && (
            <nav className="pe-bottom" aria-label={t("pptxEditor.tools")} data-testid="pptx-bottombar">
              {sel.length === 0 ? (
                <>
                  <TB icon={LayoutGrid} label={t("pptxEditor.slides")} onClick={() => setSlidesOpen(true)} />
                  <TB icon={Type} label={t("pptxEditor.addText")} onClick={insertText} testId="pptx-add-text" />
                  <TB icon={Square} label={t("pptxEditor.addShape")} onClick={() => setSheet("insertShape")} testId="pptx-add-shape" />
                  <TB icon={ImagePlus} label={t("pptxEditor.addImage")} onClick={insertImage} testId="pptx-add-image" />
                  <TB icon={Layers} label={t("pptxEditor.tab.layers")} onClick={() => { setTab("layers"); setSheet("format"); }} />
                  <TB icon={MousePointerSquareDashed} label={t("pptxEditor.multiSelect")} active={multi} onClick={() => setMulti((m) => !m)} testId="pptx-multi" />
                </>
              ) : (
                <>
                  {(sel[0].text || sel[0].kind === "shape") && sel.length === 1 && sel[0].kind !== "table" && <TB icon={Type} label={t("pptxEditor.editText")} onClick={() => openText(sel[0].id)} testId="pptx-edit-text" />}
                  <TB icon={Palette} label={t("pptxEditor.style")} onClick={() => { setTab("format"); setSheet("format"); }} testId="pptx-style" />
                  <TB icon={Move3d} label={t("pptxEditor.tab.arrange")} onClick={() => { setTab("arrange"); setSheet("format"); }} testId="pptx-arrange" />
                  <TB icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} testId="pptx-duplicate" />
                  <TB icon={Trash2} label={t("pptxEditor.delete")} onClick={a.remove} danger testId="pptx-delete" />
                  <TB icon={SquareDashedMousePointer} label={t("pptxEditor.selectBehind")} onClick={a.selectBehind} />
                  <TB icon={MousePointerSquareDashed} label={t("pptxEditor.multiSelect")} active={multi} onClick={() => setMulti((m) => !m)} testId="pptx-multi" />
                </>
              )}
            </nav>
          )}

          {compact && sheet === "format" && (
            <BottomSheet title={sel.length ? elementLabel(sel[0], t) : t("pptxEditor.tab.layers")} onClose={() => setSheet(null)} testId="pptx-props-sheet">
              <div className="pe-tabs" role="tablist">{(sel.length ? ["format", "text", "arrange", "layers"] : ["layers"]).map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-active" : ""} onClick={() => setTab(k)}>{t(`pptxEditor.tab.${k}`)}</button>)}</div>
              <Inspector tab={sel.length ? tab : "layers"} sel={sel} model={okModel} a={a} t={t} locked={lockedIds} />
            </BottomSheet>
          )}
          {sheet === "insertShape" && (
            <BottomSheet title={t("pptxEditor.addShape")} onClose={() => setSheet(null)} testId="pptx-shape-sheet">
              <div className="pe-shapes">{SHAPES.map(([p, I, k]) => <button key={p} type="button" onClick={() => insertShape(p)} data-testid={`pptx-add-${p}`}><I size={26} aria-hidden="true" /><span>{t(`pptxEditor.shape.${k}`)}</span></button>)}</div>
            </BottomSheet>
          )}
          {sheet === "layouts" && (
            <BottomSheet title={t("pptxEditor.chooseLayout")} onClose={() => setSheet(null)} testId="pptx-layout-sheet">
              <ul className="pe-list">{listLayouts(pkg).map((l) => <li key={l.path}><button type="button" onClick={() => slideOps.addWith(l.path)} data-testid="pptx-layout-item">{l.name}</button></li>)}</ul>
            </BottomSheet>
          )}
          {sheet === "more" && (
            <BottomSheet title={t("pptxEditor.more")} onClose={() => setSheet(null)} testId="pptx-more-sheet">
              <ul className="pe-list">
                <li><button type="button" onClick={() => { setSheet(null); exportNow(); }}><Download size={16} aria-hidden="true" />{t("pptxEditor.export")}</button></li>
                <li><button type="button" onClick={() => { setGrid((g) => ({ ...g, show: !g.show })); }}><Grid3x3 size={16} aria-hidden="true" />{t("pptxEditor.grid")} {grid.show ? "✓" : ""}</button></li>
                <li><button type="button" onClick={() => canvasRef.current?.fit()}><Maximize size={16} aria-hidden="true" />{t("pptxEditor.fitScreen")}</button></li>
                <li><button type="button" onClick={() => setSheet("report")}><Info size={16} aria-hidden="true" />{t("pptxEditor.report")}</button></li>
                <li><button type="button" className="is-danger" onClick={() => { setSheet(null); setConfirm({ text: t("pptxEditor.resetConfirm"), yes: t("pptxEditor.reset"), run: resetToOriginal }); }} data-testid="pptx-reset"><RotateCcw size={16} aria-hidden="true" />{t("pptxEditor.reset")}</button></li>
              </ul>
            </BottomSheet>
          )}
          {sheet === "report" && report && <ReportSheet report={report} t={t} onClose={() => setSheet(null)} />}
          {textEdit && textEl && (
            <TextSheet key={textEl.id} title={elementLabel(textEl, t)} initial={(textEl.text?.plain || [""]).join("\n")} hint={t("pptxEditor.placeholderHint")} t={t} rtl={direction === "rtl"}
              onCancel={() => setTextEdit(null)} onDone={(texts) => { run(() => setText(pkg, path, textEl.id, texts)); setTextEdit(null); }} />
          )}
          {compact && (
            <Drawer open={slidesOpen} onOpenChange={setSlidesOpen} shouldScaleBackground={false}>
              <DrawerContent container={rootRef.current} className="pe-drawer" aria-describedby={undefined}>
                <DrawerHeader><DrawerTitle>{t("pptxEditor.slides")}</DrawerTitle></DrawerHeader>
                <div className="pe-drawer-body"><SlidesPanel grid pkg={pkg} pres={pres} idx={safeIdx} width={132} onSelect={slideOps.select} onAdd={slideOps.add} onDuplicate={dupSlide} onDelete={slideOps.del} onMove={slideOps.move} t={t} labels={labels} /></div>
              </DrawerContent>
            </Drawer>
          )}
          {confirm && (
            <div className="pe-modal" role="alertdialog" aria-modal="true" data-testid="pptx-confirm">
              <div className="pe-modal-card"><p>{confirm.text}</p>
                <div className="pe-modal-actions"><button type="button" className="pe-btn-secondary" onClick={() => setConfirm(null)} data-testid="pptx-confirm-no">{t("pptxEditor.cancel")}</button>
                  <button type="button" className="pe-btn-danger" onClick={() => { const c = confirm; setConfirm(null); c.run(); }} data-testid="pptx-confirm-yes">{confirm.yes}</button></div></div>
            </div>
          )}
          {busy && <div className="pe-busy" aria-live="polite"><Loader2 className="pe-spin" aria-hidden="true" />{busy}</div>}
        </>
      )}
      {feedback && <div className={`pe-toast ${feedback.kind}`} role="status" data-testid="pptx-toast">{feedback.kind === "error" && <AlertTriangle size={15} aria-hidden="true" />}{feedback.text}</div>}
    </div>,
    document.body
  );
}

const SHAPES = [["rect", Square, "rect"], ["roundRect", RectangleHorizontal, "round"], ["ellipse", Circle, "ellipse"], ["triangle", Triangle, "triangle"], ["rightArrow", ArrowRight, "arrow"], ["star5", Star, "star"], ["line", Minus, "line"]];

function TB({ icon: Icon, label, onClick, active, danger, testId }) {
  return <button type="button" className={`pe-tb ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`} onClick={onClick} data-testid={testId} aria-label={label} title={label}><Icon size={22} aria-hidden="true" /><span>{label}</span></button>;
}

function Start({ t, onClose, onPick, dragOver, busy, draft, onResume, onDiscardDraft }) {
  return (
    <div className="pe-start" data-testid="pptx-start">
      <header className="pe-top"><IconButton icon={X} label={t("pptxEditor.close")} onClick={onClose} testId="pptx-close" /><div className="pe-title"><strong>{t("pptxEditor.title")}</strong></div></header>
      <div className="pe-start-body">
        {draft && (
          <div className="pe-card pe-draft" data-testid="pptx-draft">
            <div><strong>{t("pptxEditor.draftFound")}</strong><p>{draft.name} · {new Date(draft.updatedAt).toLocaleString()}</p></div>
            <div className="pe-row"><button type="button" className="pe-btn-primary" onClick={onResume} data-testid="pptx-resume">{t("pptxEditor.resume")}</button><button type="button" className="pe-btn-secondary" onClick={onDiscardDraft}>{t("pptxEditor.discard")}</button></div>
          </div>
        )}
        <button type="button" className={`pe-drop ${dragOver ? "is-over" : ""}`} onClick={onPick} disabled={!!busy} data-testid="pptx-open">
          {busy ? <Loader2 className="pe-spin" size={34} aria-hidden="true" /> : <FileUp size={34} aria-hidden="true" />}
          <strong>{busy || t("pptxEditor.open")}</strong>
          <span>{t("pptxEditor.dropHint")}</span>
        </button>
        <div className="pe-card"><h3><Upload size={15} aria-hidden="true" /> {t("pptxEditor.supportTitle")}</h3>
          <ul><li>{t("pptxEditor.support1")}</li><li>{t("pptxEditor.support2")}</li><li>{t("pptxEditor.support3")}</li></ul>
          <h3><AlertTriangle size={15} aria-hidden="true" /> {t("pptxEditor.limitTitle")}</h3>
          <ul><li>{t("pptxEditor.limit1")}</li><li>{t("pptxEditor.limit2")}</li><li>{t("pptxEditor.limit3")}</li></ul></div>
      </div>
    </div>
  );
}

function ReportSheet({ report, t, onClose }) {
  const grouped = report.warnings.reduce((m, w) => { (m[w.code] ||= []).push(w); return m; }, {});
  return (
    <BottomSheet title={t("pptxEditor.report")} onClose={onClose} testId="pptx-report-sheet" tall>
      <p className="pe-note">{t("pptxEditor.reportSlides", { n: report.slides })}</p>
      {!report.warnings.length && !report.sections && !report.problems.length && <p>{t("pptxEditor.reportClean")}</p>}
      {Object.entries(grouped).map(([code, list]) => (
        <div key={code} className="pe-report-item"><AlertTriangle size={15} aria-hidden="true" /><div><strong>{list[0].message}</strong><p>{t("pptxEditor.onSlides", { list: [...new Set(list.map((w) => w.slide))].slice(0, 12).join(", ") })}</p></div></div>
      ))}
      {report.sections && <div className="pe-report-item"><Info size={15} aria-hidden="true" /><div><strong>{t("pptxEditor.sectionsNote")}</strong></div></div>}
      {report.problems.length > 0 && <div className="pe-report-item"><AlertTriangle size={15} aria-hidden="true" /><div><strong>{t("pptxEditor.integrityNote", { n: report.problems.length })}</strong></div></div>}
      <p className="pe-note">{t("pptxEditor.preservedNote")}</p>
    </BottomSheet>
  );
}

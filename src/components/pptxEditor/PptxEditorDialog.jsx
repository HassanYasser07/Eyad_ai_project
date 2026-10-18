import React from "react";
import { createPortal } from "react-dom";
import {
  X, Undo2, Redo2, Download, MoreHorizontal, Type, Square, Circle, Triangle, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Star, Minus, Plus, ImagePlus, Upload, FileUp, Layers, Palette, Copy, Trash2, Shapes, Zap, Sun, Moon, MessageSquare, FileText, Hexagon, Eye, EyeOff,
  ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, ChevronLeft, ChevronRight, LayoutGrid, MousePointerSquareDashed, RotateCcw, AlertTriangle, SquareDashedMousePointer, Move3d, Info, RectangleHorizontal, Loader2,
  Home, ClipboardCopy, ClipboardPaste, Scissors, FlipHorizontal2, FlipVertical2, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Search, Bold, Italic, Underline,
  Play, List, Strikethrough, Table2, Type as TextIcon, Image as ImageIcon,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useI18n } from "@/i18n/I18nContext";
import { PptxPackage, PptxError, readPresentation, readSlide, setSlideBackground, setPresentationBackground, setBounds, deleteElements, duplicateElements, reorderElements, moveElementToLayer, setElementsHidden, groupElements, ungroupElement, setText, setTextProps, setShapeStyle, setOpacity, addTextBox, addShape, addPicture, replacePicture, setAltText, tableRows, tableCols, copyElements, pasteElements, addSlide, duplicateSlide, deleteSlide, moveSlide, listLayouts, hasSections, computeAlign, computeDistribute, rotatedBox, unionBox, applySlidePalette } from "./engine/index.js";
import { checkPptxFile, readFile, saveBytes, pickFile, PPTX_ACCEPT, IMAGE_ACCEPT, safeName, saveDraft, loadDraft, clearDraft, imageInfo } from "./fileIO.js";
import { disposeMediaUrls, useMediaUrls } from "./useMediaUrls.js";
import Canvas from "./Canvas.jsx";
import SlideView, { collectImagePaths } from "./SlideView.jsx";
import Inspector, { elementLabel } from "./Inspector.jsx";
import ColorPalettePicker from "../shared/ColorPalettePicker.jsx";
import { PRESENTATION_PALETTES } from "../shared/presentationPalettes.js";
import { BottomSheet, TextSheet, SlidesPanel, useVisualViewport } from "./Sheets.jsx";
import { IconButton, ColorField, NumberField, SliderField, SelectField } from "./Controls.jsx";
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
  const vp = useVisualViewport(compact);
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
  const [sheet, setSheet] = React.useState(null); // responsive command sheet / properties / shapes / layouts / report
  const [activeRibbon, setActiveRibbon] = React.useState("home");
  const [allSlidesBackground, setAllSlidesBackground] = React.useState(false);
  const [selectedPaletteId, setSelectedPaletteId] = React.useState("ocean-mist");
  const [previewHiddenIds, setPreviewHiddenIds] = React.useState(() => new Set());
  const [clipboardReady, setClipboardReady] = React.useState(false);
  const [shapeQuery, setShapeQuery] = React.useState("");
  const [altTextDraft, setAltTextDraft] = React.useState("");
  const [textEdit, setTextEdit] = React.useState(null);
  const [slidesOpen, setSlidesOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);
  const [report, setReport] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [panel, setPanel] = React.useState("arrange");
  const [presenting, setPresenting] = React.useState(false);
  const contextSheetTimer = React.useRef(null);
  const clearContextSheetTimer = React.useCallback(() => {
    if (contextSheetTimer.current !== null) clearTimeout(contextSheetTimer.current);
    contextSheetTimer.current = null;
  }, []);
  React.useEffect(() => () => clearContextSheetTimer(), [clearContextSheetTimer]);

  // ----- derived document state -----
  const pres = React.useMemo(() => (pkg ? readPresentation(pkg) : null), [pkg, pkg?.version]);  
  const safeIdx = pres ? Math.min(idx, pres.slides.length - 1) : 0;
  const model = React.useMemo(() => {
    if (!pkg || !pres || !pres.slides[safeIdx]) return null;
    try { return readSlide(pkg, pres.slides[safeIdx].path, pres); } catch (err) { return { error: err }; }
  }, [pkg, pres, safeIdx, pkg?.version]);  
  const okModel = model && !model.error ? model : null;
  const sel = okModel ? okModel.elements.filter((e) => selection.includes(e.id)) : [];
  React.useEffect(() => { setPreviewHiddenIds(new Set()); }, [safeIdx]);
  const canvasModel = React.useMemo(() => {
    if (!okModel || previewHiddenIds.size === 0) return okModel;
    const filterItems = (items) => items.filter((item) => !previewHiddenIds.has(item.id)).map((item) => item.kind === "group" ? { ...item, children: filterItems(item.children || []) } : item);
    return { ...okModel, elements: filterItems(okModel.elements), under: filterItems(okModel.under || []) };
  }, [okModel, previewHiddenIds]);
  const previewSelectedHidden = sel.length > 0 && sel.every((item) => previewHiddenIds.has(item.id));
  const togglePreviewVisibility = () => setPreviewHiddenIds((current) => {
    const next = new Set(current);
    if (sel.length && sel.every((item) => next.has(item.id))) sel.forEach((item) => next.delete(item.id));
    else sel.forEach((item) => next.add(item.id));
    return next;
  });
  const applyColorPalette = (palette) => {
    try {
      applySlidePalette(pkg, path, palette);
      setFeedback({ kind: "ok", text: t("palette.applied") });
      setSelectedPaletteId(palette.id);
      setAllSlidesBackground(false);
      setSheet(null);
    } catch (err) {
      // Keep the gallery open if a particular imported slide cannot be styled safely.
      const key = `pptxEditor.err.${err?.code}`;
      const message = err?.code && t(key) !== key ? t(key) : t("pptxEditor.err.generic");
      setFeedback({ kind: "error", text: message });
    }
  };
  const lockedIds = React.useMemo(() => new Set([...locked].filter((k) => okModel && k.startsWith(`${okModel.path}#`)).map((k) => k.split("#")[1])), [locked, okModel]);
  const labels = React.useMemo(() => ({ canvas: t("pptxEditor.canvas"), locked: t("pptxEditor.locked"), loading: t("pptxEditor.loadingImage"), imageUnavailable: t("pptxEditor.imageUnavailable"), chartNote: t("pptxEditor.chartNote"), chartPreview: t("pptxEditor.chartPreview"), viewOnly: t("pptxEditor.viewOnly"), placeholderHint: t("pptxEditor.placeholderHint"), selectionActions: t("pptxEditor.selectionActions"), quickCopy: t("pptxEditor.quickCopyHint"), quickRotate: t("pptxEditor.quickRotateHint"), quickDelete: t("pptxEditor.quickDeleteHint") }), [t]);

  React.useEffect(() => { if (pkg) return pkg.subscribe(() => force()); return undefined; }, [pkg]);
  React.useEffect(() => { if (okModel) setSelection((s) => { const n = s.filter((id) => okModel.elements.some((e) => e.id === id)); return n.length === s.length ? s : n; }); }, [okModel]);
  const selectionKey = selection.join("|");
  React.useEffect(() => {
    if (!sel.length) return;
    const kinds = new Set(sel.map((item) => item.kind));
    if (kinds.size > 1) { setActiveRibbon("home"); return; }
    const kind = sel[0].kind;
    if (kind === "text" || kind === "table") setActiveRibbon("text");
    else if (kind === "shape" || kind === "line") setActiveRibbon("shapes");
    else if (kind === "image") setActiveRibbon("image");
    else setActiveRibbon("home");
  // Only selection identity triggers contextual ribbon navigation, not style/model updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, safeIdx]);
  const activateContextForSelection = React.useCallback((ids) => {
    const items = okModel?.elements.filter((item) => ids.includes(item.id)) || [];
    if (!items.length) return;
    const kinds = new Set(items.map((item) => item.kind));
    const next = kinds.size > 1 ? "home" : (["text", "table"].includes(items[0].kind) ? "text" : (["shape", "line"].includes(items[0].kind) ? "shapes" : (items[0].kind === "image" ? "image" : "home")));
    setActiveRibbon(next);
    if (compact && !textEdit) {
      clearContextSheetTimer();
      contextSheetTimer.current = setTimeout(() => {
        contextSheetTimer.current = null;
        setSheet("ribbon");
      }, 420);
    }
  }, [okModel, compact, textEdit, clearContextSheetTimer]);
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
      setPkg(p); setFileName(name); setIdx(0); setSelection([]); setLocked(new Set()); setSheet(null); setTextEdit(null); setActiveRibbon("home"); setAllSlidesBackground(false); setPreviewHiddenIds(new Set()); setSelectedPaletteId("ocean-mist"); clipboard.current = null; setClipboardReady(false); setShapeQuery("");
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
    background: (hex, allSlides = false) => run(
      () => allSlides ? setPresentationBackground(pkg, hex) : setSlideBackground(pkg, path, hex),
      allSlides ? (hex ? t("pptxEditor.backgroundAllUpdated") : t("pptxEditor.backgroundAllReset")) : (hex ? t("pptxEditor.backgroundUpdated") : t("pptxEditor.backgroundReset")),
    ),
    selectBehind: () => canvasRef.current?.selectBehind(),
    field: (partial) => run(() => { const e = sel.find((item) => !lockedIds.has(item.id) && !item.readOnlyGeometry); if (!e) return; setBounds(pkg, path, [{ id: e.id, ...bounds(e), ...partial }], "Edit"); }),
    order: (mode) => run(() => { const editable = sel.filter((item) => !lockedIds.has(item.id) && !item.readOnlyGeometry).map((item) => item.id); if (editable.length) reorderElements(pkg, path, editable, mode); }),
    align: (mode) => run(() => {
      const items = sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry).map((e) => ({ id: e.id, box: rotatedBox(bounds(e)) }));
      const ref = sel.length > 1 ? unionBox(items.map((i) => i.box)) : { x: 0, y: 0, w: okModel.size.w, h: okModel.size.h };
      const d = computeAlign(items, mode, ref);
      setBounds(pkg, path, sel.filter((e) => d[e.id]).map((e) => ({ id: e.id, ...bounds(e), x: e.x + d[e.id].dx, y: e.y + d[e.id].dy })), "Align");
    }),
    distribute: (axis) => run(() => {
      const editable = sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry);
      const d = computeDistribute(editable.map((e) => ({ id: e.id, box: rotatedBox(bounds(e)) })), axis);
      setBounds(pkg, path, editable.filter((e) => d[e.id]).map((e) => ({ id: e.id, ...bounds(e), x: e.x + d[e.id].dx, y: e.y + d[e.id].dy })), "Distribute");
    }),
    group: () => run(() => { const editable = sel.filter((item) => !lockedIds.has(item.id) && !item.readOnlyGeometry).map((item) => item.id); if (editable.length > 1) setSelection([groupElements(pkg, path, editable)]); }),
    ungroup: () => run(() => { if (ids[0] && !lockedIds.has(ids[0])) setSelection(ungroupElement(pkg, path, ids[0])); }),
    duplicate: () => run(() => { const editable = sel.filter((item) => !lockedIds.has(item.id) && !item.readOnlyGeometry).map((item) => item.id); if (editable.length) setSelection(duplicateElements(pkg, path, editable)); }),
    remove: () => run(() => { const removable = sel.filter((item) => !lockedIds.has(item.id) && !item.readOnlyGeometry).map((item) => item.id); if (!removable.length) return; deleteElements(pkg, path, removable); setSelection((current) => current.filter((id) => !removable.includes(id))); }),
    toggleLock: (targetIds = ids) => setLocked((s) => { const n = new Set(s); const keys = targetIds.map((i) => `${path}#${i}`); const all = keys.every((k) => n.has(k)); keys.forEach((k) => (all ? n.delete(k) : n.add(k))); return n; }),
    nudge: (dx, dy) => run(() => setBounds(pkg, path, sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry).map((e) => ({ id: e.id, ...bounds(e), x: e.x + dx, y: e.y + dy })), "Nudge")),
    moveLayer: (id, targetIndex) => { if (!lockedIds.has(id)) run(() => moveElementToLayer(pkg, path, id, targetIndex)); },
    setHidden: (id, hidden) => run(() => { setElementsHidden(pkg, path, [id], hidden); if (hidden) setSelection((current) => current.filter((selectedId) => selectedId !== id)); }),
    flipH: () => run(() => setBounds(pkg, path, sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry).map((e) => ({ id: e.id, ...bounds(e), flipH: !e.flipH })), "Flip horizontal")),
    flipV: () => run(() => setBounds(pkg, path, sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry).map((e) => ({ id: e.id, ...bounds(e), flipV: !e.flipV })), "Flip vertical")),
    rotate: (delta) => run(() => setBounds(pkg, path, sel.filter((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry).map((e) => ({ id: e.id, ...bounds(e), rot: ((e.rot || 0) + delta + 360) % 360 })), "Rotate")),
    text: (props) => run(() => { const editable = sel.filter((item) => !lockedIds.has(item.id)).map((item) => item.id); if (editable.length) setTextProps(pkg, path, editable, props); }),
    shape: (style) => run(() => { const editable = sel.filter((item) => !lockedIds.has(item.id) && !item.readOnlyGeometry).map((item) => item.id); if (editable.length) setShapeStyle(pkg, path, editable, style); }),
    opacity: (v) => run(() => { const editable = sel.filter((item) => !lockedIds.has(item.id)).map((item) => item.id); if (editable.length) setOpacity(pkg, path, editable, v); }),
    editText: () => openText(ids[0]),
    cell: (r, c, texts) => run(() => { if (ids[0] && !lockedIds.has(ids[0])) setText(pkg, path, ids[0], texts, { row: r, col: c }); }),
    tableRows: (op, i) => run(() => { if (ids[0] && !lockedIds.has(ids[0])) tableRows(pkg, path, ids[0], op, i); }),
    tableCols: (op, i) => run(() => { if (ids[0] && !lockedIds.has(ids[0])) tableCols(pkg, path, ids[0], op, i); }),
    alt: (txt) => run(() => { const image = sel.find((item) => item.kind === "image" && !lockedIds.has(item.id)); if (image) setAltText(pkg, path, image.id, txt); }),
    replaceImage: () => pickFile({ accept: IMAGE_ACCEPT, onPick: async (f) => {
      if (!f) return;
      const info = await imageInfo(f);
      if (!info) { setFeedback({ kind: "error", text: t("pptxEditor.err.BAD_IMAGE") }); return; }
      run(() => replacePicture(pkg, path, ids[0], { bytes: info.bytes, ext: info.ext, naturalRatio: info.w / info.h }), t("pptxEditor.imageReplaced"));
    } }),
  }), [pkg, path, ids, sel, lockedIds, okModel, run, t]);  

  function openText(id) {
    clearContextSheetTimer();
    const el = okModel?.elements.find((e) => e.id === id);
    if (!el) return;
    if (el.kind === "table") { setSelection([id]); setActiveRibbon("text"); setSheet("table"); return; }
    if (!el.text && el.kind !== "shape" && el.kind !== "text") return;
    if (lockedIds.has(id)) { setFeedback({ kind: "error", text: t("pptxEditor.lockedHint") }); return; }
    setSelection([id]); setActiveRibbon("text"); setSheet(null); setTextEdit({ id });
  }
  const commitBounds = (changes, label) => run(() => setBounds(pkg, path, changes, label));
  const center = (w, h) => ({ x: (okModel.size.w - w) / 2, y: (okModel.size.h - h) / 2 });
  const insertText = () => run(() => { const w = okModel.size.w * 0.4, h = okModel.size.h * 0.14; const id = addTextBox(pkg, path, { ...center(w, h), w, h, text: t("pptxEditor.newText") }); setSelection([id]); setActiveRibbon("text"); setPanel("arrange"); setTextEdit({ id }); });
  const insertShape = (prst) => run(() => {
    const square = ["diamond", "triangle", "rtTriangle", "pentagon", "hexagon", "octagon", "plus", "heart", "lightningBolt", "sun", "moon", "star4", "star5", "star6", "star8", "flowChartProcess", "flowChartPredefinedProcess", "flowChartAlternateProcess", "flowChartTerminator", "flowChartDecision", "flowChartConnector", "flowChartPreparation", "flowChartOffpageConnector"].includes(prst);
    const verticalArrow = ["upArrow", "downArrow", "upDownArrow"].includes(prst);
    const w = prst === "line" ? okModel.size.w * 0.3 : verticalArrow ? okModel.size.w * 0.12 : square ? Math.min(okModel.size.w * 0.2, okModel.size.h * 0.26) : okModel.size.w * 0.2;
    const h = prst === "line" ? 0 : verticalArrow ? okModel.size.h * 0.28 : square ? w : w * 0.7;
    const id = addShape(pkg, path, { prst, ...center(w, h), w, h }); setSelection([id]); setActiveRibbon("shapes"); setPanel("arrange"); setSheet(compact ? "ribbon" : null);
  });
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
  const copyNow = () => {
    if (!ids.length) return;
    run(() => { clipboard.current = copyElements(pkg, path, ids); setClipboardReady(true); }, t("pptxEditor.copied"));
  };
  const cutNow = () => {
    if (!ids.length) return;
    try {
      clipboard.current = copyElements(pkg, path, ids);
      setClipboardReady(true);
      deleteElements(pkg, path, ids);
      setSelection([]);
      setFeedback({ kind: "ok", text: t("pptxEditor.cut") });
    } catch (err) { setFeedback({ kind: "error", text: errText(err) }); }
  };
  const pasteNow = () => run(() => { if (clipboard.current) setSelection(pasteElements(pkg, path, clipboard.current)); });
  const openRibbon = (key) => {
    clearContextSheetTimer();
    setActiveRibbon(key);
    if (!compact) return;
    if (key === "arrange" || key === "layers") { setPanel(key); setSheet("panel"); }
    else if (key === "table") setSheet("table");
    else setSheet("ribbon");
  };
  const requestDeleteCurrentSlide = () => setConfirm({
    text: t("pptxEditor.deleteSlideConfirm"), yes: t("pptxEditor.deleteSlide"),
    run: () => slideOps.del(safeIdx),
  });
  const toggleAllSlidesBackground = (checked) => {
    if (checked) {
      if (okModel?.background?.type !== "solid") return;
      a.background(okModel.background.hex, true);
    }
    setAllSlidesBackground(checked);
  };
  const setBackgroundColor = (hex) => a.background(hex, allSlidesBackground);
  const resetBackground = () => a.background(null, allSlidesBackground);

  // ----- keyboard shortcuts (desktop) -----
  React.useEffect(() => {
    if (!pkg) return undefined;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target?.isContentEditable) { if (e.key === "Escape" && textEdit) setTextEdit(null); return; }
      if (!okModel || presenting) return;
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      const act = (fn) => { e.preventDefault(); fn(); };
      if (mod && k === "z") act(e.shiftKey ? redo : undo);
      else if (mod && k === "y") act(redo);
      else if (mod && k === "s") act(exportNow);
      else if (mod && k === "a") act(() => setSelection(okModel.elements.filter((x) => !x.hidden).map((x) => x.id)));
      else if (mod && k === "d" && ids.length) act(a.duplicate);
      else if (mod && k === "c" && ids.length) act(copyNow);
      else if (mod && k === "x" && ids.length) act(cutNow);
      else if (mod && k === "v" && clipboard.current) act(pasteNow);
      else if (mod && k === "g" && ids.length) act(e.shiftKey ? a.ungroup : a.group);
      else if (mod && e.key === "]" && ids.length) act(() => a.order(e.shiftKey ? "front" : "forward"));
      else if (mod && e.key === "[" && ids.length) act(() => a.order(e.shiftKey ? "back" : "backward"));
      else if (e.shiftKey && !mod && !e.altKey && k === "r" && ids.length) act(() => a.rotate(90));
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
  const selectedEl = sel[0] || null;
  const selectedOpacity = selectedEl?.kind === "image"
    ? (selectedEl.opacity ?? 1)
    : selectedEl?.fill?.type === "gradient"
      ? (selectedEl.fill.stops?.[0]?.alpha ?? selectedEl.line?.alpha ?? 1)
      : (selectedEl?.fill?.alpha ?? selectedEl?.line?.alpha ?? 1);
  React.useEffect(() => { setAltTextDraft(selectedEl?.kind === "image" ? (selectedEl.alt || "") : ""); }, [selectedEl?.id, selectedEl?.kind, selectedEl?.alt]);
  const ribbonColors = okModel ? ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dk2", "lt2"].map((k) => okModel.theme.colors[k]).filter(Boolean) : [];
  const textStyle = selectedEl?.text?.paragraphs?.find((p) => p.runs.length)?.runs[0]?.style || selectedEl?.text?.paragraphs?.[0]?.end || null;
  const textHasContent = (e) => !!e?.text?.plain?.some((v) => String(v).trim());
  const canTextEdit = sel.length > 0 && sel.every((e) => e.kind !== "table" && (e.kind === "text" || textHasContent(e)));
  const canShapeEdit = sel.length > 0 && sel.every((e) => e.kind === "shape" || e.kind === "line");
  const canShapeFill = canShapeEdit && sel.every((e) => e.kind === "shape" && e.geom?.kind !== "line");
  const canShapeLine = canShapeEdit;
  const formatDisabled = !canTextEdit || sel.some((e) => lockedIds.has(e.id));
  const shapeDisabled = !canShapeEdit || sel.some((e) => lockedIds.has(e.id) || e.readOnlyGeometry);
  const canImageEdit = sel.length > 0 && sel.every((e) => e.kind === "image");
  const imageDisabled = !canImageEdit || sel.some((e) => lockedIds.has(e.id) || e.readOnlyGeometry);
  const canFlipSelection = sel.length > 0 && sel.every((e) => !lockedIds.has(e.id) && !e.readOnlyGeometry && ["text", "shape", "line", "image", "table", "chart", "diagram", "group", "object"].includes(e.kind));
  const flipDisabled = !canFlipSelection;
  const canEditImageAlt = sel.length === 1 && selectedEl?.kind === "image" && !imageDisabled;
  const disabledField = (disabled, child) => <fieldset disabled={disabled} className={`pe-disabled-control ${disabled ? "is-disabled" : ""}`} aria-disabled={disabled || undefined}>{child}</fieldset>;
  const ribbonTabs = ["home", "insert", "design", "text", "shapes", "image", "view"];
  const ribbonContent = (() => {
    if (activeRibbon === "home") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.slides")}>
        <RibbonButton icon={Plus} label={t("pptxEditor.addSlide")} onClick={slideOps.add} />
        <RibbonButton icon={Copy} label={t("pptxEditor.duplicateSlide")} onClick={() => dupSlide(safeIdx)} />
        <RibbonButton icon={Trash2} label={t("pptxEditor.deleteSlide")} danger onClick={requestDeleteCurrentSlide} disabled={pres?.slides.length <= 1} />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.clipboard")}>
        <RibbonButton icon={Scissors} label={t("pptxEditor.cut")} onClick={cutNow} disabled={!ids.length} />
        <RibbonButton icon={ClipboardCopy} label={t("pptxEditor.copy")} onClick={copyNow} disabled={!ids.length} />
        <RibbonButton icon={ClipboardPaste} label={t("pptxEditor.paste")} onClick={pasteNow} disabled={!clipboardReady} />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.objects")}>
        <RibbonButton icon={Type} label={t("pptxEditor.addText")} onClick={insertText} testId="pptx-add-text" />
        <RibbonButton icon={ImagePlus} label={t("pptxEditor.addImage")} onClick={insertImage} testId="pptx-add-image" />
        <RibbonButton icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} disabled={!ids.length || sel.every((e) => lockedIds.has(e.id) || e.readOnlyGeometry)} testId="pptx-duplicate" />
        <RibbonButton icon={Trash2} label={t("pptxEditor.delete")} onClick={a.remove} disabled={!ids.length || sel.every((e) => lockedIds.has(e.id) || e.readOnlyGeometry)} danger testId="pptx-delete" />
      </RibbonGroup>
      {selectedEl?.kind === "table" && <RibbonGroup title={t("pptxEditor.section.table")}><RibbonButton icon={Table2} label={t("pptxEditor.editTable")} onClick={() => setSheet("table")} /></RibbonGroup>}
    </>;
    if (activeRibbon === "insert") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.slides")}><RibbonButton icon={LayoutGrid} label={t("pptxEditor.addSlide")} onClick={slideOps.add} /></RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.shapes")}>
        <RibbonButton icon={Shapes} label={t("pptxEditor.allShapes")} onClick={() => { setShapeQuery(""); setSheet("insertShape"); }} testId="pptx-all-shapes" />
        <RibbonButton icon={Square} label={t("pptxEditor.shape.rect")} onClick={() => insertShape("rect")} testId="pptx-add-rect" />
        <RibbonButton icon={Circle} label={t("pptxEditor.shape.ellipse")} onClick={() => insertShape("ellipse")} testId="pptx-add-ellipse" />
        <RibbonButton icon={Minus} label={t("pptxEditor.shape.line")} onClick={() => insertShape("line")} testId="pptx-add-line" />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.media")}><RibbonButton icon={Type} label={t("pptxEditor.addText")} onClick={insertText} /><RibbonButton icon={ImagePlus} label={t("pptxEditor.addImage")} onClick={insertImage} /></RibbonGroup>
    </>;
    if (activeRibbon === "design") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.background")}>
        <ColorField label={t("pptxEditor.backgroundColor")} value={okModel?.background?.type === "solid" ? okModel.background.hex : null} themeColors={ribbonColors} testId="pptx-ribbon-background"
          onChange={setBackgroundColor} onNone={resetBackground} />
        <label className="pe-checkbox-row pe-background-scope" title={t("pptxEditor.backgroundAllHint")}>
          <input type="checkbox" checked={allSlidesBackground} disabled={okModel?.background?.type !== "solid" && !allSlidesBackground} data-testid="pptx-apply-background-all"
            onChange={(event) => toggleAllSlidesBackground(event.target.checked)} />
          <span>{t("pptxEditor.applyBackgroundAllNow")}</span>
        </label>
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.backgroundPresets")}>
        <div className="pe-background-presets">
          {[
            ["paper", "F8FAFC"], ["warm", "FEF3C7"], ["sky", "DBEAFE"],
            ["mint", "D1FAE5"], ["lavender", "EDE9FE"], ["midnight", "0F172A"],
          ].map(([name, color]) => <button type="button" key={name} className="pe-background-preset" onClick={() => setBackgroundColor(color)} aria-label={t(`pptxEditor.backgroundPreset.${name}`)} title={t(`pptxEditor.backgroundPreset.${name}`)}>
            <span style={{ background: `#${color}` }} />
            <small>{t(`pptxEditor.backgroundPreset.${name}`)}</small>
          </button>)}
        </div>
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.backgroundActions")}>
        <RibbonButton icon={Palette} label={t("pptxEditor.backgroundResetAction")} onClick={resetBackground} />
        <RibbonButton icon={RotateCcw} label={t("pptxEditor.backgroundResetAllNow")} onClick={() => a.background(null, true)} />
      </RibbonGroup>
      <RibbonGroup title={t("palette.title")}>
        <button type="button" className="pe-palette-open-button" onClick={() => setSheet("palettes")} data-testid="pptx-open-palettes" aria-label={t("palette.open")}>
          <span className="pe-palette-circle" aria-hidden="true">{PRESENTATION_PALETTES.find((item) => item.id === selectedPaletteId)?.colors.slice(0, 5).map((color) => <i key={color} style={{ background: color }} />)}</span>
          <span>{t("palette.open")}</span>
        </button>
      </RibbonGroup>
    </>;
    if (activeRibbon === "text") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.textInsert")}>
        <RibbonButton icon={Type} label={t("pptxEditor.addText")} onClick={insertText} testId="pptx-add-text-context" />
        <RibbonButton icon={TextIcon} label={t("pptxEditor.editText")} onClick={() => selectedEl && openText(selectedEl.id)} disabled={!canTextEdit || sel.length !== 1 || selectedEl?.kind === "table" || lockedIds.has(selectedEl?.id)} />
        <RibbonButton icon={Trash2} label={t("pptxEditor.deleteText")} onClick={a.remove} disabled={!sel.length || !sel.every((e) => e.kind === "text")} danger />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.font")}>
        {disabledField(formatDisabled, <SelectField label={t("pptxEditor.font")} value={textStyle?.font || "Arial"} testId="pptx-font" onChange={(font) => a.text({ font })} options={["Arial", "Calibri", "Verdana", "Georgia", "Times New Roman", "Courier New", "Inter", "Roboto", "Montserrat", "Poppins", "Cairo", "Tajawal", "Almarai"].map((font) => ({ value: font, label: font }))} />)}
        {disabledField(formatDisabled, <NumberField label={t("pptxEditor.size")} suffix="pt" value={textStyle?.size ?? 18} min={1} max={400} step={1} decimals={0} testId="pptx-size" onCommit={(v) => a.text({ size: v })} />)}
        <RibbonButton icon={Bold} label={t("pptxEditor.bold")} active={!!textStyle?.bold} onClick={() => a.text({ bold: !textStyle?.bold })} disabled={formatDisabled} testId="pptx-bold" />
        <RibbonButton icon={Italic} label={t("pptxEditor.italic")} active={!!textStyle?.italic} onClick={() => a.text({ italic: !textStyle?.italic })} disabled={formatDisabled} testId="pptx-italic" />
        <RibbonButton icon={Underline} label={t("pptxEditor.underline")} active={!!textStyle?.underline} onClick={() => a.text({ underline: !textStyle?.underline })} disabled={formatDisabled} />
        <RibbonButton icon={Strikethrough} label={t("pptxEditor.strike")} active={!!textStyle?.strike} onClick={() => a.text({ strike: !textStyle?.strike })} disabled={formatDisabled} />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.textColor")}>
        {disabledField(formatDisabled, <ColorField label={t("pptxEditor.textColor")} value={textStyle?.color?.hex} themeColors={ribbonColors} onChange={(hex) => a.text({ color: hex })} />)}
        {disabledField(formatDisabled, <ColorField label={t("pptxEditor.highlight")} value={textStyle?.highlight?.hex} themeColors={ribbonColors} onChange={(hex) => a.text({ highlight: hex })} onNone={() => a.text({ highlight: null })} />)}
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.paragraph")}>
        {[ ["l", AlignStartVertical, "alignLeft"], ["ctr", AlignCenterVertical, "alignCenter"], ["r", AlignEndVertical, "alignRight"] ].map(([v, I, k]) => <RibbonButton key={v} icon={I} label={t(`pptxEditor.${k}`)} onClick={() => a.text({ align: v })} disabled={formatDisabled} />)}
        <RibbonButton icon={List} label={t("pptxEditor.bullets")} onClick={() => a.text({ bullet: selectedEl?.text?.paragraphs?.[0]?.bullet?.kind === "none" })} disabled={formatDisabled} />
        <RibbonButton icon={Table2} label={t("pptxEditor.editTable")} onClick={() => setSheet("table")} disabled={selectedEl?.kind !== "table"} />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.transform")}>
        <RibbonButton icon={FlipHorizontal2} label={t("pptxEditor.flipH")} onClick={a.flipH} disabled={flipDisabled} />
        <RibbonButton icon={FlipVertical2} label={t("pptxEditor.flipV")} onClick={a.flipV} disabled={flipDisabled} />
      </RibbonGroup>
    </>;
    if (activeRibbon === "shapes") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.shapeInsert")}>
        <RibbonButton icon={Shapes} label={t("pptxEditor.allShapes")} onClick={() => { setShapeQuery(""); setSheet("insertShape"); }} testId="pptx-all-shapes-context" />
        <RibbonButton icon={Square} label={t("pptxEditor.shape.rect")} onClick={() => insertShape("rect")} />
        <RibbonButton icon={Circle} label={t("pptxEditor.shape.ellipse")} onClick={() => insertShape("ellipse")} />
        <RibbonButton icon={Minus} label={t("pptxEditor.shape.line")} onClick={() => insertShape("line")} />
        <RibbonButton icon={Trash2} label={t("pptxEditor.delete")} danger onClick={a.remove} disabled={!canShapeEdit || shapeDisabled} />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.section.appearance")}>
        {disabledField(!canShapeFill || shapeDisabled, <ColorField label={t("pptxEditor.fill")} value={selectedEl?.fill?.type === "solid" ? selectedEl.fill.hex : null} themeColors={ribbonColors} testId="pptx-ribbon-fill" onChange={(hex) => a.shape({ fill: { hex, alpha: selectedEl?.fill?.alpha ?? (selectedEl?.fill?.type === "gradient" ? selectedEl.fill.stops?.[0]?.alpha : 1) ?? 1 } })} onNone={() => a.shape({ fill: { none: true } })} />)}
        {disabledField(!canShapeLine || shapeDisabled, <ColorField label={t("pptxEditor.line")} value={selectedEl?.line && !selectedEl.line.none ? selectedEl.line.hex : null} themeColors={ribbonColors} testId="pptx-ribbon-line" onChange={(hex) => a.shape({ line: { hex, w: selectedEl?.line?.w || 12700, alpha: selectedEl?.line?.alpha ?? 1 } })} onNone={() => a.shape({ line: { none: true } })} />)}
        {disabledField(!canShapeLine || shapeDisabled, <NumberField label={t("pptxEditor.width")} suffix="pt" value={(selectedEl?.line?.w ?? 12700) / 12700} min={0} max={50} step={0.5} onCommit={(v) => a.shape({ line: v === 0 ? { none: true } : { w: v * 12700, hex: selectedEl?.line?.hex || "000000", alpha: selectedEl?.line?.alpha ?? 1 } })} />)}
        {disabledField(!canShapeLine || shapeDisabled, <SelectField label={t("pptxEditor.lineStyle")} value={selectedEl?.line?.dash || "solid"} onChange={(dash) => a.shape({ line: { dash } })} testId="pptx-line-style" options={[["solid","solid"],["dash","dash"],["dot","dot"],["dashDot","dashDot"],["lgDash","longDash"],["lgDashDot","longDashDot"],["lgDashDotDot","longDashDotDot"],["sysDash","systemDash"],["sysDot","systemDot"],["sysDashDot","systemDashDot"],["sysDashDotDot","systemDashDotDot"]].map(([value,key]) => ({ value, label: t(`pptxEditor.lineStyle.${key}`) }))} />)}
        {disabledField(shapeDisabled || !(canShapeFill || canShapeLine), <SliderField label={t("pptxEditor.opacity")} value={Math.round(selectedOpacity * 100)} onCommit={(v) => a.opacity(v / 100)} testId="pptx-opacity" />)}
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.transform")}>
        <RibbonButton icon={FlipHorizontal2} label={t("pptxEditor.flipH")} onClick={a.flipH} disabled={flipDisabled} />
        <RibbonButton icon={FlipVertical2} label={t("pptxEditor.flipV")} onClick={a.flipV} disabled={flipDisabled} />
        <RibbonButton icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} disabled={!canShapeEdit || shapeDisabled} />
      </RibbonGroup>
    </>;
    if (activeRibbon === "image") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.media")}>
        <RibbonButton icon={ImagePlus} label={t("pptxEditor.replaceImage")} onClick={a.replaceImage} disabled={!canEditImageAlt} />
        <RibbonButton icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} disabled={imageDisabled} />
        <RibbonButton icon={Trash2} label={t("pptxEditor.delete")} onClick={a.remove} disabled={imageDisabled} danger />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.transform")}>
        <RibbonButton icon={FlipHorizontal2} label={t("pptxEditor.flipH")} onClick={a.flipH} disabled={flipDisabled} />
        <RibbonButton icon={FlipVertical2} label={t("pptxEditor.flipV")} onClick={a.flipV} disabled={flipDisabled} />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.section.appearance")}>
        {disabledField(imageDisabled, <SliderField label={t("pptxEditor.opacity")} value={Math.round(selectedOpacity * 100)} onCommit={(v) => a.opacity(v / 100)} testId="pptx-image-opacity" />)}
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.section.image")}>
        {disabledField(!canEditImageAlt, <label className="pe-sel pe-ribbon-select pe-alt-text-field"><span>{t("pptxEditor.altText")}</span><input className="pe-input" value={altTextDraft} onChange={(e) => setAltTextDraft(e.target.value)} onBlur={() => { if (selectedEl?.kind === "image" && altTextDraft !== (selectedEl.alt || "")) a.alt(altTextDraft); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>)}
      </RibbonGroup>
    </>;
    if (activeRibbon === "view") return <>
      <RibbonGroup title={t("pptxEditor.ribbon.group.zoom")}>
        <RibbonButton icon={ZoomOut} label={t("pptxEditor.zoomOut")} onClick={() => canvasRef.current?.zoomBy(0.8)} />
        <RibbonButton icon={ZoomIn} label={t("pptxEditor.zoomIn")} onClick={() => canvasRef.current?.zoomBy(1.25)} />
        <RibbonButton icon={Maximize} label={t("pptxEditor.fitScreen")} onClick={() => canvasRef.current?.fit()} testId="pptx-fit" />
        <RibbonButton icon={Play} label={t("pptxEditor.present")} onClick={() => setPresenting(true)} testId="pptx-present" />
      </RibbonGroup>
      <RibbonGroup title={t("pptxEditor.ribbon.group.workspace")}>
        <RibbonButton icon={Grid3x3} label={t("pptxEditor.grid")} active={grid.show} onClick={() => setGrid((g) => ({ ...g, show: !g.show }))} testId="pptx-grid" />
        <RibbonButton icon={Magnet} label={t("pptxEditor.snapGrid")} active={grid.snap} onClick={() => setGrid((g) => ({ ...g, snap: !g.snap }))} />
        <RibbonButton icon={Layers} label={t("pptxEditor.tab.layers")} onClick={() => { setPanel("layers"); if (compact) setSheet("panel"); }} />
        <RibbonButton icon={previewSelectedHidden ? Eye : EyeOff} label={previewSelectedHidden ? t("palette.showSelectedInEditor") : t("palette.hideSelectedInEditor")} onClick={togglePreviewVisibility} disabled={!sel.length} testId="pptx-preview-visibility" active={previewSelectedHidden} />
        <RibbonButton icon={Info} label={t("pptxEditor.report")} onClick={() => setSheet("report")} active={report?.warnings.length > 0} />
        <RibbonButton icon={MousePointerSquareDashed} label={t("pptxEditor.multiSelect")} active={multi} onClick={() => setMulti((m) => !m)} testId="pptx-multi" />
        {ids.length > 0 && <RibbonButton icon={SquareDashedMousePointer} label={t("pptxEditor.selectBehind")} onClick={a.selectBehind} />}
      </RibbonGroup>
    </>;
    return null;
  })();

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
            <IconButton icon={Play} label={t("pptxEditor.present")} onClick={() => setPresenting(true)} testId="pptx-present" />
            <button type="button" className="pe-btn-primary" onClick={exportNow} disabled={!!busy} data-testid="pptx-export">{busy ? <Loader2 className="pe-spin" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}<span>{t("pptxEditor.export")}</span></button>
            {compact && <IconButton icon={MoreHorizontal} label={t("pptxEditor.more")} onClick={() => setSheet("more")} testId="pptx-more" />}
          </header>

          {!compact && (
            <div className="pe-ribbon-shell">
              <div className="pe-ribbon-tabs" role="tablist" aria-label={t("pptxEditor.tools")}>
                {ribbonTabs.map((key) => <button key={key} type="button" role="tab" aria-selected={activeRibbon === key} className={activeRibbon === key ? "is-active" : ""}
                  onClick={() => openRibbon(key)}>{t(`pptxEditor.ribbon.${key}`)}</button>)}
              </div>
              <div className="pe-ribbon" role="toolbar" aria-label={t(`pptxEditor.ribbon.${activeRibbon}`)} data-testid="pptx-ribbon-content">
                {ribbonContent}
              </div>
            </div>
          )}

          <div className="pe-body">
            {!compact && <aside className="pe-left"><SlidesPanel pkg={pkg} pres={pres} idx={safeIdx} onSelect={slideOps.select} onAdd={slideOps.add} onDuplicate={dupSlide} onDelete={slideOps.del} onMove={slideOps.move} t={t} labels={labels} /></aside>}
            <main className="pe-main" dir="ltr">
              {okModel ? (
                <Canvas ref={canvasRef} pkg={pkg} model={canvasModel} selection={selection} onSelect={setSelection} onSelectionComplete={activateContextForSelection} onInteractionStart={clearContextSheetTimer} onCommit={commitBounds} onEditText={openText} onCopy={copyNow} onDelete={a.remove} onRotate={() => a.rotate(90)} multi={multi} grid={grid} locked={lockedIds} labels={labels} onZoom={setZoom} compact={compact} />
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
              <aside className="pe-right" aria-label={t("pptxEditor.sidePanel")}>
                <div className="pe-tabs" role="tablist">{["arrange", "layers"].map((k) => <button key={k} role="tab" aria-selected={panel === k} className={panel === k ? "is-active" : ""} onClick={() => setPanel(k)}>{t(`pptxEditor.tab.${k}`)}</button>)}</div>
                <div className="pe-right-body"><Inspector tab={panel} sel={sel} model={okModel} a={a} t={t} locked={lockedIds} /></div>
              </aside>
            )}
          </div>

          {!compact && <footer className="pe-foot"><span>{t("pptxEditor.slideOf", { n: safeIdx + 1, total: pres?.slides.length || 0 })}</span><span className="pe-grow" /><span className="pe-hint">{t("pptxEditor.shortcutsHint")}</span></footer>}

          {compact && !textEdit && (
            <nav className="pe-bottom" aria-label={t("pptxEditor.tools")} data-testid="pptx-bottombar">
              <TB icon={Home} label={t("pptxEditor.ribbon.home")} active={activeRibbon === "home"} onClick={() => openRibbon("home")} />
              <TB icon={Shapes} label={t("pptxEditor.ribbon.insert")} active={activeRibbon === "insert"} onClick={() => openRibbon("insert")} />
              <TB icon={Palette} label={t("pptxEditor.ribbon.design")} active={activeRibbon === "design"} onClick={() => openRibbon("design")} />
              <TB icon={Type} label={t("pptxEditor.ribbon.text")} active={activeRibbon === "text"} onClick={() => openRibbon("text")} />
              <TB icon={Square} label={t("pptxEditor.ribbon.shapes")} active={activeRibbon === "shapes"} onClick={() => openRibbon("shapes")} />
              <TB icon={ImageIcon} label={t("pptxEditor.ribbon.image")} active={activeRibbon === "image"} onClick={() => openRibbon("image")} />
              <TB icon={Move3d} label={t("pptxEditor.tab.arrange")} active={sheet === "panel" && panel === "arrange"} onClick={() => openRibbon("arrange")} />
              <TB icon={Layers} label={t("pptxEditor.tab.layers")} active={sheet === "panel" && panel === "layers"} onClick={() => openRibbon("layers")} />
              <TB icon={LayoutGrid} label={t("pptxEditor.slides")} onClick={() => setSlidesOpen(true)} />
              <TB icon={Grid3x3} label={t("pptxEditor.ribbon.view")} active={activeRibbon === "view"} onClick={() => openRibbon("view")} />
            </nav>
          )}

          {compact && sheet === "panel" && (
            <BottomSheet title={t(`pptxEditor.tab.${panel}`)} onClose={() => setSheet(null)} testId={`pptx-${panel}-sheet`} tall>
              <div className="pe-tabs" role="tablist">{["arrange", "layers"].map((k) => <button key={k} role="tab" aria-selected={panel === k} className={panel === k ? "is-active" : ""} onClick={() => setPanel(k)}>{t(`pptxEditor.tab.${k}`)}</button>)}</div>
              <Inspector tab={panel} sel={sel} model={okModel} a={a} t={t} locked={lockedIds} />
            </BottomSheet>
          )}
          {sheet === "table" && (
            <BottomSheet title={t("pptxEditor.section.table")} onClose={() => setSheet(null)} testId="pptx-table-sheet" tall>
              <Inspector tab="table" sel={sel} model={okModel} a={a} t={t} locked={lockedIds} />
            </BottomSheet>
          )}

          {compact && sheet === "ribbon" && (
            <BottomSheet title={t(`pptxEditor.ribbon.${activeRibbon}`)} onClose={() => setSheet(null)} testId="pptx-mobile-ribbon" tall>
              <div className="pe-mobile-ribbon">{ribbonContent}</div>
            </BottomSheet>
          )}
          {sheet === "insertShape" && (
            <BottomSheet title={t("pptxEditor.allShapes")} onClose={() => setSheet(null)} testId="pptx-shape-sheet" tall>
              <label className="pe-shape-search"><Search size={16} aria-hidden="true" /><input className="pe-input" value={shapeQuery} onChange={(e) => setShapeQuery(e.target.value)} placeholder={t("pptxEditor.shapeSearch")} aria-label={t("pptxEditor.shapeSearch")} /></label>
              <div className="pe-shape-categories">
                {SHAPE_CATEGORIES.map((category) => {
                  const items = SHAPES.filter(([prst, , key, group]) => group === category.key && `${prst} ${t(`pptxEditor.shape.${key}`)}`.toLowerCase().includes(shapeQuery.trim().toLowerCase()));
                  return items.length ? <section key={category.key} className="pe-shape-category"><h4>{t(`pptxEditor.shapeCategory.${category.key}`)}</h4><div className="pe-shapes">{items.map(([prst, I, key]) => <button key={prst} type="button" onClick={() => insertShape(prst)} data-testid={`pptx-add-${prst}`}><I size={26} aria-hidden="true" /><span>{t(`pptxEditor.shape.${key}`)}</span></button>)}</div></section> : null;
                })}
                {!SHAPES.some(([prst, , key]) => `${prst} ${t(`pptxEditor.shape.${key}`)}`.toLowerCase().includes(shapeQuery.trim().toLowerCase())) && <p className="pe-note">{t("pptxEditor.noShapesFound")}</p>}
              </div>
            </BottomSheet>
          )}
          {sheet === "palettes" && (
            <BottomSheet title={t("palette.galleryTitle")} onClose={() => setSheet(null)} testId="pptx-palette-sheet" tall>
              <p className="pe-note pe-palette-hint">{t("palette.galleryHint")}</p>
              <ColorPalettePicker onSelect={applyColorPalette} selectedPaletteId={selectedPaletteId} t={t} />
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
          {presenting && pres && <PresentationPreview pkg={pkg} pres={pres} idx={safeIdx} onClose={() => setPresenting(false)} onSelect={(i) => { const next = Math.max(0, Math.min(pres.slides.length - 1, i)); if (next !== safeIdx) setPreviewHiddenIds(new Set()); setIdx(next); }} previewHiddenIds={previewHiddenIds} t={t} labels={labels} />}
          {textEdit && textEl && (
            <TextSheet key={textEl.id} title={elementLabel(textEl, t)} initial={(textEl.text?.plain || [""]).join("\n")} hint={t("pptxEditor.placeholderHint")} t={t} rtl={direction === "rtl"}
              onCancel={() => { setTextEdit(null); if (compact) setSheet("ribbon"); }} onDone={(texts) => { run(() => setText(pkg, path, textEl.id, texts)); setTextEdit(null); if (compact) setSheet("ribbon"); }} />
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

const SHAPE_CATEGORIES = [
  { key: "basic" }, { key: "lines" }, { key: "arrows" }, { key: "stars" }, { key: "callouts" }, { key: "flow" },
];
const SHAPES = [
  ["rect", Square, "rect", "basic"], ["roundRect", RectangleHorizontal, "round", "basic"], ["ellipse", Circle, "ellipse", "basic"],
  ["triangle", Triangle, "triangle", "basic"], ["rtTriangle", Triangle, "rightTriangle", "basic"], ["diamond", Shapes, "diamond", "basic"],
  ["parallelogram", Shapes, "parallelogram", "basic"], ["trapezoid", Shapes, "trapezoid", "basic"], ["pentagon", Shapes, "pentagon", "basic"],
  ["hexagon", Shapes, "hexagon", "basic"], ["octagon", Shapes, "octagon", "basic"],
  ["line", Minus, "line", "lines"],
  ["rightArrow", ArrowRight, "rightArrow", "arrows"], ["leftArrow", ArrowLeft, "leftArrow", "arrows"], ["upArrow", ArrowUp, "upArrow", "arrows"],
  ["downArrow", ArrowDown, "downArrow", "arrows"], ["leftRightArrow", ArrowLeft, "leftRightArrow", "arrows"], ["upDownArrow", ArrowUp, "upDownArrow", "arrows"],
  ["quadArrow", Move3d, "quadArrow", "arrows"], ["notchedRightArrow", ArrowRight, "notchedRightArrow", "arrows"], ["bentArrow", ArrowRight, "bentArrow", "arrows"],
  ["chevron", ChevronRight, "chevron", "arrows"], ["homePlate", ArrowRight, "homePlate", "arrows"],
  ["plus", Plus, "plus", "stars"], ["heart", Shapes, "heart", "stars"], ["lightningBolt", Zap, "lightningBolt", "stars"],
  ["sun", Sun, "sun", "stars"], ["moon", Moon, "moon", "stars"], ["wedgeRectCallout", MessageSquare, "callout", "callouts"],
  ["star4", Star, "star4", "stars"], ["star5", Star, "star5", "stars"], ["star6", Star, "star6", "stars"], ["star8", Star, "star8", "stars"],
  ["flowChartProcess", Square, "process", "flow"], ["flowChartPredefinedProcess", RectangleHorizontal, "predefinedProcess", "flow"],
  ["flowChartAlternateProcess", RectangleHorizontal, "alternateProcess", "flow"], ["flowChartTerminator", Circle, "terminator", "flow"],
  ["flowChartDecision", Shapes, "decision", "flow"], ["flowChartConnector", Circle, "connector", "flow"],
  ["flowChartInputOutput", Shapes, "inputOutput", "flow"], ["flowChartPreparation", Hexagon, "preparation", "flow"],
  ["flowChartManualInput", RectangleHorizontal, "manualInput", "flow"], ["flowChartOffpageConnector", Triangle, "offpageConnector", "flow"],
  ["flowChartDocument", FileText, "document", "flow"],
];

function RibbonGroup({ title, children }) {
  return <div className="pe-ribbon-group"><div className="pe-ribbon-group-items">{children}</div><span className="pe-ribbon-group-title">{title}</span></div>;
}

function RibbonButton({ icon: Icon, label, onClick, disabled = false, active, danger = false, testId }) {
  return <button type="button" className={`pe-ribbon-button ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`} onClick={onClick} disabled={disabled}
    title={label} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} data-testid={testId}>
    {Icon && <Icon size={20} aria-hidden="true" />}<span>{label}</span>
  </button>;
}

function TB({ icon: Icon, label, onClick, active, danger, testId }) {
  return <button type="button" className={`pe-tb ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`} onClick={onClick} data-testid={testId} aria-label={label} title={label}><Icon size={22} aria-hidden="true" /><span>{label}</span></button>;
}

function PresentationPreview({ pkg, pres, idx, onClose, onSelect, previewHiddenIds = new Set(), t, labels }) {
  const slide = pres.slides[idx];
  const model = React.useMemo(() => { try { return readSlide(pkg, slide.path, pres); } catch { return null; } }, [pkg, pkg?.version, slide.path, pres]);
  const displayModel = React.useMemo(() => {
    if (!model || !previewHiddenIds?.size) return model;
    const filterItems = (items) => items.filter((item) => !previewHiddenIds.has(item.id)).map((item) => item.kind === "group" ? { ...item, children: filterItems(item.children || []) } : item);
    return { ...model, elements: filterItems(model.elements), under: filterItems(model.under || []) };
  }, [model, previewHiddenIds]);
  const urls = useMediaUrls(pkg, displayModel ? collectImagePaths(displayModel) : []);
  const [viewport, setViewport] = React.useState(() => ({ w: typeof window !== "undefined" ? window.innerWidth : 1024, h: typeof window !== "undefined" ? window.innerHeight : 768 }));
  const root = React.useRef(null);
  React.useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const update = () => { const r = el.getBoundingClientRect(); setViewport({ w: r.width, h: r.height }); };
    const ro = new ResizeObserver(update); ro.observe(el); update();
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    const key = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); onSelect(Math.min(pres.slides.length - 1, idx + 1)); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); onSelect(Math.max(0, idx - 1)); }
      else if (event.key === "Home") { event.preventDefault(); onSelect(0); }
      else if (event.key === "End") { event.preventDefault(); onSelect(pres.slides.length - 1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [idx, pres.slides.length, onClose, onSelect]);
  const W = displayModel ? displayModel.size.w / 9525 : 1;
  const H = displayModel ? displayModel.size.h / 9525 : 1;
  const scale = displayModel ? Math.max(0.01, Math.min((viewport.w - 48) / W, (viewport.h - 104) / H)) : 1;
  return <div className="pe-present" role="dialog" aria-modal="true" aria-label={t("pptxEditor.present")} data-testid="pptx-present-mode">
    <header className="pe-present-head">
      <div className="pe-present-title"><strong>{t("pptxEditor.present")}</strong><span>{idx + 1} / {pres.slides.length}</span></div>
      <div className="pe-present-actions">
        <IconButton icon={ChevronLeft} label={t("pptxEditor.prevSlide")} onClick={() => onSelect(Math.max(0, idx - 1))} disabled={idx === 0} />
        <IconButton icon={ChevronRight} label={t("pptxEditor.nextSlide")} onClick={() => onSelect(Math.min(pres.slides.length - 1, idx + 1))} disabled={idx >= pres.slides.length - 1} />
        <IconButton icon={X} label={t("pptxEditor.closePreview")} onClick={onClose} testId="pptx-present-close" />
      </div>
    </header>
    <main ref={root} className="pe-present-stage" onClick={(event) => { if (event.target === event.currentTarget) onSelect(Math.min(pres.slides.length - 1, idx + 1)); }}>
      {displayModel ? <div className="pe-present-sized" style={{ width: W * scale, height: H * scale }}><div className="pe-present-scaled" style={{ width: W, height: H, transform: `scale(${scale})` }}><SlideView model={displayModel} urls={urls} hints={false} labels={labels} /></div></div> : <p>{t("pptxEditor.slideUnreadable")}</p>}
    </main>
    <footer className="pe-present-foot"><span>{t("pptxEditor.presentHint")}</span><button type="button" onClick={onClose}>{t("pptxEditor.closePreview")}</button></footer>
  </div>;
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

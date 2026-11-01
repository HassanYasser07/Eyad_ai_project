import React from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/I18nContext";
import {
  X, Upload, Download, Undo2, Redo2, RotateCcw,
  Copy, Trash2, Group, Ungroup, FileCode2,
  MousePointer2, Type, CircleAlert, CheckCircle2, FileUp,
  Palette, Eye, EyeOff,
  Image, ChevronLeft, Check, Loader2,
} from "lucide-react";
import SvgLayersPanel from "@/components/svgEditor/SvgLayersPanel";
import SvgPropertiesPanel from "@/components/svgEditor/SvgPropertiesPanel";
import SvgContextBar from "@/components/svgEditor/SvgContextBar";
import LogoPalettePicker from "@/components/svgEditor/LogoPalettePicker";
import { ensureEditorFonts } from "@/components/svgEditor/svgEditorControls";
import {
  LayersIcon, ArrangeIcon, SizeIcon, ColorsIcon, TextIcon, TypographyIcon, BackgroundIcon,
  SolidIcon, GradientIcon, ImageIcon, ResetIcon, BackIcon,
} from "@/components/svgEditor/svgEditorIcons";
import {
  addTextElement,
  cloneSelectedElements,
  deleteSelectedElements,
  editSvgMarkup,
  exportSvgMarkup,
  flipElement,
  getElementDetails,
  getElementPaint,
  getElementTree,
  groupSelectedElements,
  parseSvgDocument,
  renameElement,
  rotateElement,
  toggleElementHidden,
  toggleElementLock,
  ungroupElement,
  updateElementAttribute,
  nudgeElement,
  updateElementSize,
  updateElementText,
  reorderElementRelative,
  getBackgroundInfo,
  setSolidBackground,
  setGradientBackground,
  setImageBackground,
  applyLogoPalette,
  rotateBackground,
  removeBackground,
} from "@/components/svgEditor/svgDocument";
import "@/components/svgEditor/svgEditor.css";

const MOBILE_QUERY = "(max-width: 660px)";

/** Tracks a CSS media query so the editor can switch between the desktop and mobile layouts live. */
function useMediaQuery(query) {
  const getMatch = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = React.useState(getMatch);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener ? media.addEventListener("change", onChange) : media.addListener(onChange);
    return () => { media.removeEventListener ? media.removeEventListener("change", onChange) : media.removeListener(onChange); };
  }, [query]);
  return matches;
}

const MAX_HISTORY = 100;

function ToolbarButton({ icon: Icon, label, onClick, disabled = false, active = false, danger = false }) {
  return (
    <button type="button" className={`svg-editor-tool ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function getBounds(element) {
  try {
    const local = element?.getBBox?.();
    if (!local) return null;
    const parent = element.parentElement;
    const nodeMatrix = element.getCTM?.();
    const parentMatrix = parent?.getCTM?.();
    let matrix = nodeMatrix;
    if (nodeMatrix && parentMatrix) matrix = parentMatrix.inverse().multiply(nodeMatrix);
    const points = [
      [local.x, local.y], [local.x + local.width, local.y],
      [local.x, local.y + local.height], [local.x + local.width, local.y + local.height],
    ].map(([x, y]) => {
      if (!matrix) return { x, y };
      const point = element.ownerSVGElement.createSVGPoint();
      point.x = x;
      point.y = y;
      const mapped = point.matrixTransform(matrix);
      return { x: mapped.x, y: mapped.y };
    });
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      localX: local.x, localY: local.y, localWidth: local.width, localHeight: local.height,
    };
  } catch {
    return null;
  }
}

function isDomElementLocked(element) {
  let current = element;
  while (current) {
    if (current.getAttribute?.("data-editor-locked") === "true") return true;
    if (current.localName === "svg" && !current.ownerSVGElement) break;
    current = current.parentElement;
  }
  return false;
}

function serializeLiveSvg(svg) {
  const clone = svg.cloneNode(true);
  clone.removeAttribute("data-editor-selected");
  clone.querySelectorAll("[data-editor-selected]").forEach((element) => element.removeAttribute("data-editor-selected"));
  clone.querySelectorAll("[data-editor-ui-overlay]").forEach((element) => element.remove());
  if (!clone.hasAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function pointInParent(svg, parent, clientX, clientY) {
  try {
    const matrix = parent?.getScreenCTM?.();
    if (!matrix) return { x: clientX, y: clientY };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  } catch {
    return { x: clientX, y: clientY };
  }
}

function localizeSvgError(message, t) {
  const text = String(message || "");
  const rules = [
    [/SVG parsing is only available in a browser/i, "svgEditor.errors.browserOnly"],
    [/selected file is empty/i, "svgEditor.errors.emptyFile"],
    [/document types or custom entities/i, "svgEditor.errors.unsafeDocument"],
    [/does not contain valid SVG XML/i, "svgEditor.errors.invalidXml"],
    [/must have an SVG root element/i, "svgEditor.errors.svgRoot"],
    [/SVG files must be 10 MB or smaller/i, "svgEditor.fileTooLarge"],
    [/SVG_FETCH_FAILED/i, "svgEditor.errors.loadFailed"],
    [/select at least one element to duplicate/i, "svgEditor.errors.selectToDuplicate"],
    [/unlock selected elements before duplicating/i, "svgEditor.errors.unlockDuplicate"],
    [/select two or more sibling elements to group/i, "svgEditor.errors.selectToGroup"],
    [/unlock selected elements before grouping/i, "svgEditor.errors.unlockGroup"],
    [/selected elements share the same parent/i, "svgEditor.errors.sameParent"],
    [/cannot be grouped safely at this level/i, "svgEditor.errors.cannotGroup"],
    [/contiguous sibling elements/i, "svgEditor.errors.contiguousGroup"],
    [/select a group to ungroup/i, "svgEditor.errors.selectGroup"],
    [/unlock this group before ungrouping/i, "svgEditor.errors.unlockGroupToUngroup"],
    [/transform or presentation attributes/i, "svgEditor.errors.unsafeUngroup"],
    [/group cannot be ungrouped/i, "svgEditor.errors.cannotUngroup"],
    [/item cannot be reordered safely/i, "svgEditor.errors.cannotReorder"],
    [/unlock these items before changing their order/i, "svgEditor.errors.unlockReorder"],
    [/within the same group/i, "svgEditor.errors.sameGroupReorder"],
    [/unlock selected elements before deleting/i, "svgEditor.errors.unlockDelete"],
    [/referenced elsewhere in the SVG/i, "svgEditor.errors.referencedDelete"],
    [/nested formatting/i, "svgEditor.errors.nestedText"],
    [/unlock this element before editing its text/i, "svgEditor.errors.unlockText"],
    [/unlock this element before editing its properties/i, "svgEditor.errors.unlockProperties"],
    [/unlock this element before moving/i, "svgEditor.errors.unlockMove"],
    [/unlock this element before resizing/i, "svgEditor.errors.unlockResize"],
    [/unlock this element before rotating/i, "svgEditor.errors.unlockRotate"],
    [/unlock this element before flipping/i, "svgEditor.errors.unlockFlip"],
    [/position must be a valid number/i, "svgEditor.errors.invalidPosition"],
    [/dimensions must be a non-negative number/i, "svgEditor.errors.invalidDimensions"],
    [/no measurable bounds for resizing/i, "svgEditor.errors.noBounds"],
    [/rotation must be a valid number/i, "svgEditor.errors.invalidRotation"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(text));
  if (matched) return t(matched[1]);
  const numericField = text.match(/^(.+) must be a valid number\.$/i);
  if (numericField) return t("svgEditor.errors.invalidNumber");
  return text || t("svgEditor.errors.generic");
}

function getElementBoundsInRoot(svg, element) {
  try {
    const box = element.getBBox();
    const rootMatrix = svg.getScreenCTM();
    const elementMatrix = element.getScreenCTM();
    if (!rootMatrix || !elementMatrix) return null;
    const matrix = rootMatrix.inverse().multiply(elementMatrix);
    const points = [
      [box.x, box.y], [box.x + box.width, box.y],
      [box.x, box.y + box.height], [box.x + box.width, box.y + box.height],
    ].map(([x, y]) => {
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      return point.matrixTransform(matrix);
    });
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  } catch {
    return null;
  }
}

function updateSelectionFrames(svg, ids, labels = {}, includeHandles = true) {
  if (!svg) return;
  svg.querySelectorAll("[data-editor-ui-overlay]").forEach((element) => element.remove());
  const namespace = "http://www.w3.org/2000/svg";
  const matrix = svg.getScreenCTM?.();
  const screenScale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
  const userUnitsPerPixel = 1 / Math.max(0.015, screenScale);
  // Handles are sized in SCREEN pixels (converted to user units), so they stay the same readable size
  // whatever the artwork's viewBox is. (They used to be clamped to 30 user units, which made them tiny on
  // large viewBoxes, while their strokes were computed in user units but drawn in pixels - a thick white blob.)
  const coarsePointer = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 660px), (pointer: coarse)").matches;
  const handleRadius = (coarsePointer ? 13 : 11) * userUnitsPerPixel;

  ids.forEach((id) => {
    const element = Array.from(svg.querySelectorAll("[data-editor-id]"))
      .find((item) => item.getAttribute("data-editor-id") === id);
    if (!element || element === svg) return;
    const bounds = getElementBoundsInRoot(svg, element);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const padding = Math.max(1.5, Math.min(5, Math.max(bounds.width, bounds.height) * 0.025));
    const frame = svg.ownerDocument.createElementNS(namespace, "rect");
    frame.setAttribute("data-editor-ui-overlay", "selection");
    frame.setAttribute("x", String(bounds.x - padding));
    frame.setAttribute("y", String(bounds.y - padding));
    frame.setAttribute("width", String(bounds.width + padding * 2));
    frame.setAttribute("height", String(bounds.height + padding * 2));
    frame.setAttribute("rx", String(3 * userUnitsPerPixel));
    frame.setAttribute("fill", "none");
    frame.setAttribute("stroke", "#60a5fa");
    frame.setAttribute("stroke-width", "1.5");
    frame.setAttribute("stroke-dasharray", "4 3");
    frame.setAttribute("vector-effect", "non-scaling-stroke");
    frame.setAttribute("pointer-events", "none");
    frame.setAttribute("aria-hidden", "true");
    svg.appendChild(frame);

    // Resize/delete handles are only unambiguous for one selected element.
    if (!includeHandles || ids.length !== 1 || isDomElementLocked(element)) return;
    const makeHandle = (kind, cx, cy, fill, label) => {
      const group = svg.ownerDocument.createElementNS(namespace, "g");
      group.setAttribute("data-editor-ui-overlay", "handle");
      group.setAttribute("data-editor-handle", kind);
      group.setAttribute("aria-label", label);
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("pointer-events", "all");
      group.setAttribute("style", `cursor:${kind === "resize" ? "nwse-resize" : "pointer"};touch-action:none;`);
      const hitArea = svg.ownerDocument.createElementNS(namespace, "circle");
      hitArea.setAttribute("cx", String(cx));
      hitArea.setAttribute("cy", String(cy));
      hitArea.setAttribute("r", String(handleRadius));
      hitArea.setAttribute("fill", fill);
      hitArea.setAttribute("stroke", "#ffffff");
      hitArea.setAttribute("stroke-width", "2");
      hitArea.setAttribute("vector-effect", "non-scaling-stroke");
      // Inline style wins over any <style> rule shipped inside an uploaded SVG (e.g. "circle { fill: #fff }").
      hitArea.setAttribute("style", `fill:${fill};stroke:#ffffff;stroke-width:2px;`);
      group.appendChild(hitArea);

      const glyph = svg.ownerDocument.createElementNS(namespace, "path");
      if (kind === "delete") {
        glyph.setAttribute("d", `M ${cx - handleRadius * 0.37} ${cy - handleRadius * 0.33} H ${cx + handleRadius * 0.37} M ${cx - handleRadius * 0.22} ${cy - handleRadius * 0.52} H ${cx + handleRadius * 0.22} M ${cx - handleRadius * 0.25} ${cy - handleRadius * 0.12} L ${cx - handleRadius * 0.2} ${cy + handleRadius * 0.4} H ${cx + handleRadius * 0.2} L ${cx + handleRadius * 0.25} ${cy - handleRadius * 0.12}`);
      } else {
        glyph.setAttribute("d", `M ${cx - handleRadius * 0.32} ${cy + handleRadius * 0.1} L ${cx + handleRadius * 0.3} ${cy - handleRadius * 0.52} M ${cx + handleRadius * 0.02} ${cy - handleRadius * 0.52} H ${cx + handleRadius * 0.3} V ${cy - handleRadius * 0.24} M ${cx - handleRadius * 0.3} ${cy - handleRadius * 0.1} L ${cx + handleRadius * 0.32} ${cy + handleRadius * 0.52} M ${cx + handleRadius * 0.04} ${cy + handleRadius * 0.52} H ${cx + handleRadius * 0.32} V ${cy + handleRadius * 0.24}`);
      }
      glyph.setAttribute("fill", "none");
      glyph.setAttribute("stroke", "#ffffff");
      glyph.setAttribute("stroke-width", "1.7");
      glyph.setAttribute("style", "fill:none;stroke:#ffffff;stroke-width:1.7px;");
      glyph.setAttribute("stroke-linecap", "round");
      glyph.setAttribute("stroke-linejoin", "round");
      glyph.setAttribute("vector-effect", "non-scaling-stroke");
      glyph.setAttribute("pointer-events", "none");
      group.appendChild(glyph);
      svg.appendChild(group);
      return group;
    };

    makeHandle("delete", bounds.x + bounds.width + padding, bounds.y - padding, "#ef4444", labels.delete || "Delete selected item");
    makeHandle("resize", bounds.x + bounds.width + padding, bounds.y + bounds.height + padding, "#2563eb", labels.resize || "Resize selected item");
  });
}

function rootPointInParent(svg, parent, x, y) {
  try {
    const rootMatrix = svg?.getScreenCTM?.();
    const parentMatrix = parent?.getScreenCTM?.();
    if (!rootMatrix || !parentMatrix) return { x, y };
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(rootMatrix).matrixTransform(parentMatrix.inverse());
  } catch {
    return { x, y };
  }
}

// `initialSvgUrl` (optional) opens the editor with an existing SVG already loaded
// (for example a Recraft-vectorized logo). Without it the editor behaves exactly
// as before and starts with the upload screen.
export default function SvgEditorDialog({ onClose, direction = "ltr", initialSvgUrl = null, initialName = "" }) {
  const { t } = useI18n();
  const [svgMarkup, setSvgMarkup] = React.useState("");
  const [originalMarkup, setOriginalMarkup] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [selectedBounds, setSelectedBounds] = React.useState(null);
  const [history, setHistory] = React.useState({ past: [], future: [] });
  const [error, setError] = React.useState("");
  const [, setNotice] = React.useState(""); // success notices are no longer displayed (no message bar)
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const [layersCollapsed, setLayersCollapsed] = React.useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = React.useState(false);
  const [mobileEditorTab, setMobileEditorTab] = React.useState(null);
  const [colorTarget, setColorTarget] = React.useState("fill");
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [mobileTextComposerOpen, setMobileTextComposerOpen] = React.useState(false);
  const [mobileTextDraft, setMobileTextDraft] = React.useState("");
  const [mobileTextComposerMode, setMobileTextComposerMode] = React.useState("add");
  const [backgroundSubTab, setBackgroundSubTab] = React.useState("solid");

  // Mobile bottom bars scroll sideways: keep the active tab centred in view whenever it changes.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelectorAll(".svg-editor-mobile-tabbar, .svg-editor-background-tabbar").forEach((bar) => {
        const active = bar.querySelector(".is-active");
        if (!active || bar.scrollWidth <= bar.clientWidth) return;
        const left = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
        bar.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [mobileEditorTab, backgroundSubTab]);
  const [palettePickerOpen, setPalettePickerOpen] = React.useState(false);
  // Extra Google fonts for the font picker (loaded once, one <link> per family).
  React.useEffect(() => { ensureEditorFonts(); }, []);


  const [selectedPaletteId, setSelectedPaletteId] = React.useState("");
  const [previewHiddenIds, setPreviewHiddenIds] = React.useState(() => new Set());
  const [initialLoading, setInitialLoading] = React.useState(Boolean(initialSvgUrl));
  const fileInputRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const markupRef = React.useRef("");
  const dragRef = React.useRef(null);
  const shortcutsRef = React.useRef({});
  const paintSnapshotsRef = React.useRef(new Map());
  const [dragEndTick, setDragEndTick] = React.useState(0);
  const viewRef = React.useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  viewRef.current = { zoom, pan };

  const updateView = React.useCallback((nextOrUpdater) => {
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(viewRef.current) : nextOrUpdater;
    const normalized = { zoom: next.zoom, pan: { x: next.pan.x, y: next.pan.y } };
    viewRef.current = normalized;
    setZoom(normalized.zoom);
    setPan(normalized.pan);
    return normalized;
  }, []);

  const pageAspect = React.useMemo(() => {
    if (!svgMarkup) return 1;
    try {
      const root = new DOMParser().parseFromString(svgMarkup, "image/svg+xml").documentElement;
      const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
      if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return viewBox[2] / viewBox[3];
      const width = Number.parseFloat(root.getAttribute("width")) || 1;
      const height = Number.parseFloat(root.getAttribute("height")) || 1;
      return width / height;
    } catch {
      return 1;
    }
  }, [svgMarkup]);
  const artboardSize = React.useMemo(() => {
    if (!canvasSize.width) return { width: 1, height: 1 };
    const isMobile = canvasSize.width <= 660;
    const horizontalMargin = isMobile ? 0 : 14;
    const verticalMargin = isMobile ? 10 : 14;
    const maxWidth = Math.max(1, canvasSize.width - horizontalMargin * 2);
    const maxHeight = Math.max(1, canvasSize.height - verticalMargin * 2);
    const width = Math.max(1, Math.min(maxWidth, maxHeight * pageAspect));
    return { width, height: width / pageAspect };
  }, [canvasSize.width, canvasSize.height, pageAspect]);

  const rememberView = React.useCallback((previousView) => {
    const currentView = viewRef.current;
    if (Math.abs(previousView.zoom - currentView.zoom) < 0.0001
      && Math.abs(previousView.pan.x - currentView.pan.x) < 0.25
      && Math.abs(previousView.pan.y - currentView.pan.y) < 0.25) return;
    setHistory((current) => ({
      past: [...current.past, { markup: markupRef.current, zoom: previousView.zoom, pan: { ...previousView.pan } }].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const replaceMarkup = React.useCallback((nextMarkup) => {
    markupRef.current = nextMarkup;
    setSvgMarkup(nextMarkup);
  }, []);

  const commitMarkup = React.useCallback((nextMarkup, previousMarkup = markupRef.current, previousView = viewRef.current) => {
    liveRef.current = null; // any real commit ends a stale live-preview session
    if (liveFrameRef.current) { cancelAnimationFrame(liveFrameRef.current); liveFrameRef.current = 0; }
    livePendingRef.current = null;
    if (!nextMarkup || nextMarkup === previousMarkup) return;
    setHistory((current) => ({
      past: [...current.past, { markup: previousMarkup, zoom: previousView.zoom, pan: { ...previousView.pan } }].slice(-MAX_HISTORY),
      future: [],
    }));
    replaceMarkup(nextMarkup);
    setError("");
    setNotice("");
  }, [replaceMarkup]);

  const performEdit = React.useCallback((label, edit) => {
    if (!markupRef.current) return;
    try {
      const next = editSvgMarkup(markupRef.current, edit);
      if (next !== markupRef.current) commitMarkup(next);
      setNotice(label);
      setError("");
      return true;
    } catch (editError) {
      setError(localizeSvgError(editError?.message, t));
      return false;
    }
  }, [commitMarkup, t]);

  // ── Live editing ──────────────────────────────────────────────────────
  // While a control is being dragged/typed, `livePreview` re-renders the canvas
  // from the markup captured at the start of the gesture (no history entries).
  // `liveCommit` then records the whole gesture as ONE undo step.
  const liveRef = React.useRef(null);
  const liveFrameRef = React.useRef(0);
  const livePendingRef = React.useRef(null);

  const flushLive = React.useCallback(() => {
    liveFrameRef.current = 0;
    const job = livePendingRef.current;
    livePendingRef.current = null;
    const session = liveRef.current;
    if (!job || !session) return;
    try {
      const next = editSvgMarkup(session.markup, (root) => job(root, session.bounds));
      session.out = next;
      replaceMarkup(next);
    } catch { /* ignore transient invalid values while dragging */ }
  }, [replaceMarkup]);

  const livePreview = React.useCallback((job, bounds) => {
    if (!markupRef.current) return;
    let session = liveRef.current;
    if (!session || markupRef.current !== session.out) {
      session = { markup: markupRef.current, out: markupRef.current, view: { zoom: viewRef.current.zoom, pan: { ...viewRef.current.pan } }, bounds };
      liveRef.current = session;
    }
    livePendingRef.current = job;
    if (!liveFrameRef.current) liveFrameRef.current = requestAnimationFrame(flushLive);
  }, [flushLive]);

  const stopLiveFrame = () => {
    if (liveFrameRef.current) { cancelAnimationFrame(liveFrameRef.current); liveFrameRef.current = 0; }
    livePendingRef.current = null;
  };

  const liveCancel = React.useCallback(() => {
    stopLiveFrame();
    const session = liveRef.current;
    liveRef.current = null;
    if (session && markupRef.current === session.out) replaceMarkup(session.markup);
  }, [replaceMarkup]);

  const liveCommit = React.useCallback((label, job, bounds) => {
    stopLiveFrame();
    const session = liveRef.current;
    liveRef.current = null;
    if (!session || markupRef.current !== session.out) {
      return performEdit(label, (root) => job(root, bounds));
    }
    try {
      const next = editSvgMarkup(session.markup, (root) => job(root, session.bounds));
      if (next !== session.markup) commitMarkup(next, session.markup, session.view);
      else replaceMarkup(session.markup);
      setNotice(label);
      setError("");
      return true;
    } catch (editError) {
      replaceMarkup(session.markup);
      setError(localizeSvgError(editError?.message, t));
      return false;
    }
  }, [performEdit, commitMarkup, replaceMarkup, t]);

  React.useEffect(() => () => { if (liveFrameRef.current) cancelAnimationFrame(liveFrameRef.current); }, []);

  // Shared by the file picker and the optional `initialSvgUrl` loader so both
  // go through exactly the same parsing/sanitising and editor reset.
  const applySvgSource = (source, name) => {
    const parsed = parseSvgDocument(source);
    replaceMarkup(parsed.markup);
    setOriginalMarkup(parsed.markup);
    setFileName(String(name || "").replace(/\.svg$/i, "") || "untitled");
    setSelectedIds([]);
    paintSnapshotsRef.current = new Map();
    setPreviewHiddenIds(new Set());
    setSelectedPaletteId("");
    setPalettePickerOpen(false);
    setHistory({ past: [], future: [] });
    updateView({ zoom: 1, pan: { x: 0, y: 0 } });
    setNotice(t("svgEditor.imported"));
  };

  React.useEffect(() => {
    if (!initialSvgUrl) return undefined;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const response = await fetch(initialSvgUrl, { mode: "cors" });
        if (!response.ok) throw new Error("SVG_FETCH_FAILED");
        const source = await response.text();
        if (cancelled) return;
        if (source.length > 10 * 1024 * 1024) throw new Error("SVG files must be 10 MB or smaller.");
        applySvgSource(source, initialName || "logo");
      } catch (loadError) {
        if (!cancelled) setError(localizeSvgError(loadError?.message, t));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialSvgUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFile = async (file) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (!/\.svg$/i.test(file.name) && file.type !== "image/svg+xml") {
      setError(t("svgEditor.nonSvgError"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("svgEditor.fileTooLarge"));
      return;
    }
    try {
      const source = await file.text();
      applySvgSource(source, file.name);
    } catch (parseError) {
      setError(localizeSvgError(parseError?.message, t));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const undo = React.useCallback(() => {
    if (!history.past.length) return;
    const previous = history.past[history.past.length - 1];
    const currentSnapshot = { markup: markupRef.current, zoom: viewRef.current.zoom, pan: { ...viewRef.current.pan } };
    replaceMarkup(previous.markup);
    updateView({ zoom: previous.zoom, pan: previous.pan });
    setHistory({
      past: history.past.slice(0, -1),
      future: [...history.future, currentSnapshot].slice(-MAX_HISTORY),
    });
    setSelectedIds([]);
    setError("");
    setNotice(t("svgEditor.undoDone"));
  }, [history, replaceMarkup, updateView, t]);

  const redo = React.useCallback(() => {
    if (!history.future.length) return;
    const next = history.future[history.future.length - 1];
    const currentSnapshot = { markup: markupRef.current, zoom: viewRef.current.zoom, pan: { ...viewRef.current.pan } };
    replaceMarkup(next.markup);
    updateView({ zoom: next.zoom, pan: next.pan });
    setHistory({
      past: [...history.past, currentSnapshot].slice(-MAX_HISTORY),
      future: history.future.slice(0, -1),
    });
    setSelectedIds([]);
    setError("");
    setNotice(t("svgEditor.redoDone"));
  }, [history, replaceMarkup, updateView, t]);

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const tree = React.useMemo(() => {
    if (!svgMarkup) return [];
    try { return getElementTree(svgMarkup, { itemLabel: t("svgEditor.itemLabel"), groupLabel: t("svgEditor.groupLabel"), copySuffix: t("svgEditor.copySuffix") }); } catch { return []; }
  }, [svgMarkup, t]);
  const details = React.useMemo(() => {
    if (!svgMarkup || !selectedId) return null;
    try { return getElementDetails(svgMarkup, selectedId, { itemLabel: t("svgEditor.itemLabel"), groupLabel: t("svgEditor.groupLabel"), copySuffix: t("svgEditor.copySuffix") }); } catch { return null; }
  }, [svgMarkup, selectedId, t]);
  const locked = selectedIds.some((id) => {
    const element = Array.from(stageRef.current?.querySelectorAll("[data-editor-id]") || []).find((item) => item.getAttribute("data-editor-id") === id);
    return element ? isDomElementLocked(element) : false;
  });

  // Fill / stroke of the selected item now, and its ORIGINAL paints (from the file as it was opened,
  // or — for items created inside the editor — as they were when first selected). The original
  // color is offered as the first swatch so a preset can always be undone.
  const paint = React.useMemo(() => {
    if (!svgMarkup || !selectedId) return null;
    let current = null;
    let original = null;
    try { current = getElementPaint(svgMarkup, selectedId); } catch { current = null; }
    if (!current) return null;
    try { original = originalMarkup ? getElementPaint(originalMarkup, selectedId) : null; } catch { original = null; }
    if (!original) {
      const snapshots = paintSnapshotsRef.current;
      if (!snapshots.has(selectedId)) snapshots.set(selectedId, current);
      original = snapshots.get(selectedId);
    }
    return { current, original };
  }, [svgMarkup, originalMarkup, selectedId]);

  // Mobile: picking an item opens "Arrange"; picking a text item opens its text options.
  const selectedIsText = !!details && ["text", "tspan"].includes(details.tag);
  const lastAutoTabId = React.useRef(null);
  React.useEffect(() => {
    if (!isMobile) { lastAutoTabId.current = selectedId; return; }
    if (!selectedId) {
      if (lastAutoTabId.current && ["controls", "size", "colors", "typography"].includes(mobileEditorTab)) setMobileEditorTab(null);
      lastAutoTabId.current = null;
      return;
    }
    if (!details) return; // wait until the item's details are available
    if (dragRef.current) return; // opening a sheet mid-drag would resize the canvas under the pointer; retried on drag end
    if (lastAutoTabId.current === selectedId) return;
    lastAutoTabId.current = selectedId;
    setMobileEditorTab((current) => (current === "layers" || mobileTextComposerOpen ? current : selectedIsText ? "typography" : "controls"));
  }, [isMobile, selectedId, details, selectedIsText, dragEndTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // The "Typography" sheet only makes sense for text; never leave it open on another item.
  React.useEffect(() => {
    if (mobileEditorTab === "typography" && selectedId && details && !selectedIsText) setMobileEditorTab("controls");
  }, [mobileEditorTab, selectedId, details, selectedIsText]);

  React.useLayoutEffect(() => {
    const svg = stageRef.current?.querySelector("svg");
    if (!svg) {
      setSelectedBounds(null);
      return;
    }
    svg.querySelectorAll("[data-editor-selected]").forEach((element) => element.removeAttribute("data-editor-selected"));
    selectedIds.forEach((id) => {
      const element = Array.from(svg.querySelectorAll("[data-editor-id]")).find((item) => item.getAttribute("data-editor-id") === id);
      if (element) element.setAttribute("data-editor-selected", "true");
    });
    updateSelectionFrames(svg, selectedIds, { delete: t("svgEditor.deleteSelectionHandle"), resize: t("svgEditor.resizeSelection") });
    const selectedElement = selectedId
      ? Array.from(svg.querySelectorAll("[data-editor-id]")).find((element) => element.getAttribute("data-editor-id") === selectedId)
      : null;
    setSelectedBounds(getBounds(selectedElement));
  }, [svgMarkup, selectedIds, selectedId, zoom, pan, t]);

  const selectElement = (id, additive = false) => {
    if (!id) return;
    if (additive) {
      setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  const hideElement = (id) => performEdit(t("svgEditor.visibilityUpdated"), (root) => toggleElementHidden(root, id));
  const lockElement = (id) => performEdit(t("svgEditor.lockUpdated"), (root) => toggleElementLock(root, id));

  const duplicateSelection = () => {
    if (!selectedIds.length) return;
    let duplicated = [];
    performEdit(t("svgEditor.duplicated"), (root) => { duplicated = cloneSelectedElements(root, selectedIds); });
    if (duplicated.length) setSelectedIds(duplicated);
  };

  const createTextSelection = (textValue) => {
    if (!markupRef.current) return;
    let newId = null;
    const succeeded = performEdit(t("svgEditor.textAdded"), (root) => {
      newId = addTextElement(root, textValue ?? t("svgEditor.newText"));
    });
    if (succeeded && newId) setSelectedIds([newId]);
  };

  const requestAddText = () => {
    if (!markupRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 660px)").matches) {
      setMobileTextComposerMode("add");
      setMobileTextDraft("");
      setMobileTextComposerOpen(true);
      setMobileEditorTab(null);
      return;
    }
    createTextSelection();
  };

  const requestEditText = () => {
    if (!details || !["text", "tspan"].includes(details.tag) || locked) return;
    setMobileTextComposerMode("edit");
    setMobileTextDraft(details.textContent || "");
    setMobileTextComposerOpen(true);
    setMobileEditorTab(null);
  };

  const confirmMobileText = () => {
    const value = mobileTextDraft.trim();
    if (!value) return;
    if (mobileTextComposerMode === "edit" && selectedId) {
      performEdit(t("svgEditor.textUpdated"), (root) => updateElementText(root, selectedId, value));
    } else {
      createTextSelection(value);
    }
    setMobileTextComposerOpen(false);
    setMobileEditorTab(null);
  };

  const getParentDeltaForRootMove = React.useCallback((element, dx, dy) => {
    try {
      const svg = stageRef.current?.querySelector("svg");
      const parent = element?.parentElement;
      const rootMatrix = svg?.getScreenCTM?.();
      const parentMatrix = parent?.getScreenCTM?.();
      if (!svg || !rootMatrix || !parentMatrix) return { x: dx, y: dy };
      const parentInverse = parentMatrix.inverse();
      const mapPoint = (x, y) => {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        return point.matrixTransform(rootMatrix).matrixTransform(parentInverse);
      };
      const origin = mapPoint(0, 0);
      const offset = mapPoint(dx, dy);
      return { x: offset.x - origin.x, y: offset.y - origin.y };
    } catch {
      return { x: dx, y: dy };
    }
  }, []);

  const nudgeSelection = React.useCallback((dx, dy) => {
    if (!selectedIds.length || locked) return;
    const svg = stageRef.current?.querySelector("svg");
    const selectedElements = selectedIds.map((id) => ({
      id,
      element: Array.from(svg?.querySelectorAll("[data-editor-id]") || []).find((item) => item.getAttribute("data-editor-id") === id),
    })).filter((item) => item.element);
    const svgViewBox = (svg?.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
    const hasViewBox = svgViewBox.length === 4 && svgViewBox.every(Number.isFinite) && svgViewBox[2] > 0 && svgViewBox[3] > 0;
    const movements = selectedElements.filter(({ element }) => !selectedElements.some(({ element: candidate }) => candidate !== element && candidate.contains(element)))
      .map(({ id, element }) => {
        let moveX = dx;
        let moveY = dy;
        const bounds = svg ? getElementBoundsInRoot(svg, element) : null;
        if (hasViewBox && bounds) {
          const [left, top, width, height] = svgViewBox;
          const right = left + width;
          const bottom = top + height;
          if (bounds.width >= width) moveX = left - bounds.x;
          else if (bounds.x + moveX < left) moveX = left - bounds.x;
          else if (bounds.x + bounds.width + moveX > right) moveX = right - (bounds.x + bounds.width);
          if (bounds.height >= height) moveY = top - bounds.y;
          else if (bounds.y + moveY < top) moveY = top - bounds.y;
          else if (bounds.y + bounds.height + moveY > bottom) moveY = bottom - (bounds.y + bounds.height);
        }
        return { id, ...getParentDeltaForRootMove(element, moveX, moveY) };
      });
    if (!movements.length) return;
    performEdit(t("svgEditor.positionUpdated"), (root) => {
      movements.forEach(({ id, x, y }) => nudgeElement(root, id, x, y));
    });
  }, [selectedIds, locked, performEdit, getParentDeltaForRootMove, t]);

  const deleteSelection = () => {
    if (!selectedIds.length) return;
    const succeeded = performEdit(t("svgEditor.deleted"), (root) => deleteSelectedElements(root, selectedIds));
    if (succeeded) setSelectedIds([]);
  };

  const flipSelectedElement = (axis) => {
    if (!selectedId) return;
    const svg = stageRef.current?.querySelector("svg");
    const liveElement = Array.from(svg?.querySelectorAll("[data-editor-id]") || [])
      .find((item) => item.getAttribute("data-editor-id") === selectedId);
    const boundsInParent = getBounds(liveElement) || selectedBounds;
    performEdit(t("svgEditor.flipped"), (root) => flipElement(root, selectedId, axis, boundsInParent));
  };

  const choosePalette = (palette) => {
    const changed = performEdit(t("svgEditor.logoPaletteApplied"), (root) => applyLogoPalette(root, palette));
    if (changed) {
      setSelectedPaletteId(palette.id);
      setPalettePickerOpen(false);
    }
  };
  const previewSelectedHidden = selectedIds.length > 0 && selectedIds.every((id) => previewHiddenIds.has(id));
  const togglePreviewVisibility = () => setPreviewHiddenIds((current) => {
    const next = new Set(current);
    if (selectedIds.length && selectedIds.every((id) => next.has(id))) selectedIds.forEach((id) => next.delete(id));
    else selectedIds.forEach((id) => next.add(id));
    return next;
  });
  const previewVisibilityCss = Array.from(previewHiddenIds)
    .map((id) => `.svg-editor-artboard [data-editor-id="${String(id).replace(/[^a-zA-Z0-9_-]/g, "")}"]{visibility:hidden!important;}`)
    .join("\n");

  const groupSelection = () => {
    if (selectedIds.length < 2) return;
    let groupId = null;
    performEdit(t("svgEditor.grouped"), (root) => { groupId = groupSelectedElements(root, selectedIds); });
    if (groupId) setSelectedIds([groupId]);
  };

  const ungroupSelection = () => {
    if (!selectedId) return;
    const succeeded = performEdit(t("svgEditor.ungrouped"), (root) => ungroupElement(root, selectedId));
    if (succeeded) setSelectedIds([]);
  };


  const reorderBetween = (sourceId, targetId, after) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    performEdit(t("svgEditor.reordered"), (root) => reorderElementRelative(root, sourceId, targetId, after));
  };

  const solidJob = (color) => (root) => { setSolidBackground(root, color); };
  const gradientJob = (color1, color2, angle = 90) => (root) => { setGradientBackground(root, color1, color2, angle); };
  const imageJob = (dataUrl, opacity = 1) => (root) => { setImageBackground(root, dataUrl, opacity); };
  const rotateBgJob = (angle) => (root) => { rotateBackground(root, angle); };
  const bgLabel = t("svgEditor.backgroundUpdated");

  const handleSetSolidBackground = React.useCallback((color) => liveCommit(bgLabel, solidJob(color)), [liveCommit, bgLabel]);
  const handleSetGradientBackground = React.useCallback((c1, c2, angle = 90) => liveCommit(bgLabel, gradientJob(c1, c2, angle)), [liveCommit, bgLabel]);
  const handleSetImageBackground = React.useCallback((dataUrl, opacity = 1) => liveCommit(bgLabel, imageJob(dataUrl, opacity)), [liveCommit, bgLabel]);
  const handleRotateBackground = React.useCallback((angle) => liveCommit(bgLabel, rotateBgJob(angle)), [liveCommit, bgLabel]);
  const handleSetSolidBackgroundLive = React.useCallback((color) => livePreview(solidJob(color)), [livePreview]);
  const handleSetGradientBackgroundLive = React.useCallback((c1, c2, angle = 90) => livePreview(gradientJob(c1, c2, angle)), [livePreview]);
  const handleSetImageBackgroundLive = React.useCallback((dataUrl, opacity = 1) => livePreview(imageJob(dataUrl, opacity)), [livePreview]);
  const handleRotateBackgroundLive = React.useCallback((angle) => livePreview(rotateBgJob(angle)), [livePreview]);

  const handleRemoveBackground = React.useCallback(() => {
    performEdit(t("svgEditor.backgroundRemoved"), (root) => {
      removeBackground(root);
    });
  }, [performEdit, t]);

  const backgroundInfo = React.useMemo(() => {
    if (!svgMarkup) return null;
    try {
      const root = parseSvgDocument(svgMarkup).documentElement;
      return getBackgroundInfo(root);
    } catch {
      return null;
    }
  }, [svgMarkup]);

  // Reset is only meaningful while the artwork actually has a background layer.
  const hasBackground = React.useMemo(() => /data-editor-background=["']true["']/.test(svgMarkup || ""), [svgMarkup]);

  const resetEditor = () => {
    if (!originalMarkup) return;
    if (!window.confirm(t("svgEditor.resetProjectConfirm"))) return;
    replaceMarkup(originalMarkup);
    setHistory({ past: [], future: [] });
    setSelectedIds([]);
    paintSnapshotsRef.current = new Map();
    setPreviewHiddenIds(new Set());
    setError("");
    setNotice(t("svgEditor.resetDone"));
    updateView({ zoom: 1, pan: { x: 0, y: 0 } });
  };

  const downloadSvg = () => {
    try {
      const { markup: exportedMarkup } = exportSvgMarkup(markupRef.current);
      const blob = new Blob([exportedMarkup], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName || "edited-logo"}-edited.svg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t("svgEditor.exportStarted"));
      setError("");
    } catch {
      setError(t("svgEditor.exportError"));
    }
  };

  const beginCanvasInteraction = (event) => {
    if (!svgMarkup || event.button !== 0) return;
    const svg = stageRef.current?.querySelector("svg");
    if (!svg) return;

    const handle = event.target.closest?.("[data-editor-handle]");
    if (handle) {
      const handleType = handle.getAttribute("data-editor-handle");
      event.preventDefault();
      event.stopPropagation();
      if (handleType !== "resize" || !selectedId || locked) return;
      const target = Array.from(svg.querySelectorAll("[data-editor-id]"))
        .find((item) => item.getAttribute("data-editor-id") === selectedId);
      const parent = target?.parentElement;
      const bounds = target ? getElementBoundsInRoot(svg, target) : null;
      if (!target || !parent || !bounds || bounds.width <= 0 || bounds.height <= 0) return;
      const startPoint = pointInParent(svg, svg, event.clientX, event.clientY);
      const anchorParent = rootPointInParent(svg, parent, bounds.x, bounds.y);
      dragRef.current = {
        type: "resize",
        id: selectedId,
        target,
        parent,
        startPoint,
        bounds,
        anchorParent: { x: anchorParent.x, y: anchorParent.y },
        moved: false,
        originalTransform: target.getAttribute("transform") || "",
        startMarkup: markupRef.current,
        startView: { zoom: viewRef.current.zoom, pan: { ...viewRef.current.pan } },
      };
      return;
    }


    const target = event.target.closest?.("[data-editor-id]");
    if (target) {
      const id = target.getAttribute("data-editor-id");
      const isAdditive = event.shiftKey || event.metaKey || event.ctrlKey;
      selectElement(id, isAdditive);
      if (isAdditive || isDomElementLocked(target)) return;
      const parent = target.parentElement;
      const point = pointInParent(svg, parent, event.clientX, event.clientY);
      dragRef.current = {
        id,
        target,
        parent,
        startPoint: point,
        moved: false,
        originalTransform: target.getAttribute("transform") || "",
        startMarkup: markupRef.current,
        startView: { zoom: viewRef.current.zoom, pan: { ...viewRef.current.pan } },
      };
      event.preventDefault();
      return;
    }
    // Empty canvas space is intentionally not draggable: the artboard stays fixed.
    // Deselect any currently selected elements when clicking empty canvas space.
    if (selectedIds.length > 0) {
      setSelectedIds([]);
    }
  };

  const handleCanvasClick = (event) => {
    const handle = event.target.closest?.("[data-editor-handle]");
    if (handle) {
      if (handle.getAttribute("data-editor-handle") === "delete") deleteSelection();
      return;
    }
    // A click must NEVER deselect. Selecting an item changes the layout (context bar / bottom sheet) a few
    // milliseconds after pointer-down, so by pointer-up the pointer is often over empty canvas and the browser
    // reports the click on the canvas itself - which used to clear the selection the user had just made.
    // Deselecting on empty space is handled on pointer-down (beginCanvasInteraction) instead.
    const target = event.target.closest?.("[data-editor-id]");
    if (!target) return;
    // SVG element selection is performed during pointer-down; this click fallback
    // is only for keyboard-generated activation events.
    if (event.detail !== 0) return;
    selectElement(target.getAttribute("data-editor-id"), event.shiftKey || event.metaKey || event.ctrlKey);
  };


  React.useEffect(() => {
    const onPointerMove = (event) => {
      const drag = dragRef.current;
      if (drag) {
        const svg = stageRef.current?.querySelector("svg");
        if (!svg || !drag.parent?.isConnected || !drag.target?.isConnected) return;
        if (drag.type === "resize") {
          const point = pointInParent(svg, svg, event.clientX, event.clientY);
          const dx = point.x - drag.startPoint.x;
          const dy = point.y - drag.startPoint.y;
          const scaleX = 1 + dx / Math.max(1, drag.bounds.width);
          const scaleY = 1 + dy / Math.max(1, drag.bounds.height);
          const scale = Math.max(0.05, Math.min(20, (scaleX + scaleY) / 2));
          if (Math.abs(scale - 1) > 0.003) drag.moved = true;
          const anchor = drag.anchorParent;
          drag.target.setAttribute("transform", `translate(${anchor.x} ${anchor.y}) scale(${scale} ${scale}) translate(${-anchor.x} ${-anchor.y}) ${drag.originalTransform}`.trim());
          updateSelectionFrames(svg, [drag.id], { delete: t("svgEditor.deleteSelectionHandle"), resize: t("svgEditor.resizeSelection") }, false);
          event.preventDefault();
          return;
        }
        const point = pointInParent(svg, drag.parent, event.clientX, event.clientY);
        const dx = point.x - drag.startPoint.x;
        const dy = point.y - drag.startPoint.y;
        if (Math.hypot(dx, dy) > 0.5) drag.moved = true;
        drag.target.setAttribute("transform", `translate(${dx} ${dy}) ${drag.originalTransform}`.trim());
        updateSelectionFrames(svg, [drag.id], { delete: t("svgEditor.deleteSelectionHandle"), resize: t("svgEditor.resizeSelection") });
        event.preventDefault();
        return;
      }
    };

    const onPointerUp = (event) => {
            const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      setDragEndTick((tick) => tick + 1);
      if (!drag.moved) {
        if (drag.target?.isConnected) {
          if (drag.originalTransform) drag.target.setAttribute("transform", drag.originalTransform);
          else drag.target.removeAttribute("transform");
        }
        const svg = stageRef.current?.querySelector("svg");
        if (svg) updateSelectionFrames(svg, [drag.id], { delete: t("svgEditor.deleteSelectionHandle"), resize: t("svgEditor.resizeSelection") });
        return;
      }
      const svg = stageRef.current?.querySelector("svg");
      if (!svg) return;
      // Elements may intentionally extend beyond the artboard while editing.
      // The SVG export applies the artboard viewport clip instead.
      const next = serializeLiveSvg(svg);
      commitMarkup(next, drag.startMarkup, drag.startView);
      setNotice(t(drag.type === "resize" ? "svgEditor.dimensionsUpdated" : "svgEditor.moved"));
    };

    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [commitMarkup, updateView, rememberView, t]);

  React.useEffect(() => {
    const element = stageRef.current;
    if (!element || !svgMarkup || typeof ResizeObserver === "undefined") return;
    const measure = () => setCanvasSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [svgMarkup]);

  React.useEffect(() => {
    shortcutsRef.current = { undo, redo, duplicateSelection, deleteSelection, nudgeSelection };
  });

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const editingText = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "Escape") {
        if (selectedIds.length > 0) {
          setSelectedIds([]);
          return;
        }
        onClose();
        return;
      }
      if (editingText) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) shortcutsRef.current.redo?.(); else shortcutsRef.current.undo?.();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        shortcutsRef.current.redo?.();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        shortcutsRef.current.duplicateSelection?.();
      } else if (["Delete", "Backspace"].includes(event.key) && selectedIds.length) {
        event.preventDefault();
        shortcutsRef.current.deleteSelection?.();
      } else if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key) && selectedIds.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          ArrowUp: [0, -step], ArrowRight: [step, 0],
          ArrowDown: [0, step], ArrowLeft: [-step, 0],
        }[event.key];
        shortcutsRef.current.nudgeSelection?.(delta[0], delta[1]);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, selectedIds.length]);

  const renderCanvas = () => {
    if (!svgMarkup && initialLoading) {
      return (
        <div className="svg-editor-empty-state">
          <div className="svg-editor-upload-card">
            <span className="svg-editor-upload-icon"><Loader2 size={28} className="animate-spin" /></span>
            <h2>{t("svgEditor.loadingLogo")}</h2>
          </div>
        </div>
      );
    }
    if (!svgMarkup) {
      return (
        <div className="svg-editor-empty-state" onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true); }} onDragLeave={() => setIsDraggingFile(false)} onDrop={(event) => { event.preventDefault(); setIsDraggingFile(false); loadFile(event.dataTransfer.files?.[0]); }}>
          <div className={`svg-editor-upload-card ${isDraggingFile ? "is-dragging" : ""}`}>
            <span className="svg-editor-upload-icon"><FileUp size={28} /></span>
            <h2>{t("svgEditor.uploadTitle")}</h2>
            <p>{t("svgEditor.uploadDescription")}</p>
            <button type="button" className="svg-editor-primary-button" onClick={() => fileInputRef.current?.click()}><Upload size={16} />{t("svgEditor.uploadButton")}</button>
            <span className="svg-editor-file-hint">{t("svgEditor.fileHint")}</span>
            <span className="svg-editor-drop-hint">{t("svgEditor.dropHint")}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="svg-editor-canvas" ref={stageRef} onPointerDown={beginCanvasInteraction} onClick={handleCanvasClick} onKeyDown={(event) => {
        const handle = event.target.closest?.("[data-editor-handle]");
        if (!handle || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        if (handle.getAttribute("data-editor-handle") === "delete") deleteSelection();
      }}>
        {previewVisibilityCss && <style>{previewVisibilityCss}</style>}
        <ArtboardSurface markup={svgMarkup} width={artboardSize.width} height={artboardSize.height} />
        <div className="svg-editor-canvas-hint"><MousePointer2 size={13} /> {t("svgEditor.selectHint")}</div>
      </div>
    );
  };

  // Handlers shared by the properties sidebar, the desktop context bar and the mobile sheets.
  const handleSizeCommit = (dimension, value, bounds) => liveCommit(t("svgEditor.dimensionsUpdated"), (root, b) => updateElementSize(root, selectedId, dimension, value, b), bounds);
  const handleSizeLive = (dimension, value, bounds) => livePreview((root, b) => updateElementSize(root, selectedId, dimension, value, b), bounds);
  const handleAttributeCommit = (name, value) => liveCommit(t("svgEditor.appearanceUpdated"), (root) => updateElementAttribute(root, selectedId, name, value));
  const handleAttributeLive = (name, value) => livePreview((root) => updateElementAttribute(root, selectedId, name, value));

  // Mobile sheets only exist in the mobile layout; on desktop the sidebar always shows the item's own controls.
  const activeMobileTab = isMobile ? mobileEditorTab : null;

  // Errors never push the layout around: they float over the canvas and dismiss themselves.
  React.useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(""), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const body = (
    <div className="svg-editor-overlay" role="presentation">
      <section className="svg-editor-dialog" role="dialog" aria-modal="true" aria-label={t("svgEditor.title")} dir={direction}>
        <header className="svg-editor-header">
          <div className="svg-editor-header-brand">
            <span className="svg-editor-brand-icon"><FileCode2 size={20} /></span>
            <div><h1>{t("svgEditor.title")}</h1><p>{fileName ? `${fileName}.svg` : t("svgEditor.subtitle")}</p></div>
          </div>
          <div className="svg-editor-header-actions">
            <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" onChange={(event) => loadFile(event.target.files?.[0])} hidden />
            <button type="button" className="svg-editor-secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={15} /><span className="svg-editor-header-btn-label">{t("svgEditor.open")}</span></button>
            <button type="button" className="svg-editor-export-button" onClick={downloadSvg} disabled={!svgMarkup}><Download size={15} /><span className="svg-editor-header-btn-label">{t("svgEditor.export")}</span></button>
            <button type="button" className="svg-editor-close-button" onClick={onClose} aria-label={t("svgEditor.close")}><X size={19} /></button>
          </div>
        </header>

        <div className="svg-editor-toolbar">
          <div className="svg-editor-tool-group">
            <ToolbarButton icon={Undo2} label={t("svgEditor.undo")} onClick={undo} disabled={!history.past.length} />
            <ToolbarButton icon={Redo2} label={t("svgEditor.redo")} onClick={redo} disabled={!history.future.length} />
            <span className="svg-editor-toolbar-divider" />
            <ToolbarButton icon={RotateCcw} label={t("svgEditor.resetView")} onClick={resetEditor} disabled={!originalMarkup} danger />
          </div>
          <div className="svg-editor-tool-group svg-editor-arrange-tools">
            <ToolbarButton icon={Palette} label={t("palette.open")} onClick={() => setPalettePickerOpen(true)} disabled={!svgMarkup} />
            <ToolbarButton icon={previewSelectedHidden ? Eye : EyeOff} label={previewSelectedHidden ? t("palette.showSelectedInEditor") : t("palette.hideSelectedInEditor")} onClick={togglePreviewVisibility} disabled={!selectedIds.length} active={previewSelectedHidden} />
            <ToolbarButton icon={Type} label={t("svgEditor.addText")} onClick={requestAddText} disabled={!svgMarkup} />
            <ToolbarButton
              icon={Image}
              label={t("svgEditor.background") || "Background"}
              onClick={() => {
                setSelectedIds([]);
                setPropertiesCollapsed(false);
              }}
              disabled={!svgMarkup}
            />
            <ToolbarButton icon={Copy} label={t("svgEditor.duplicate")} onClick={duplicateSelection} disabled={!selectedIds.length || locked} />
            <ToolbarButton icon={Group} label={t("svgEditor.group")} onClick={groupSelection} disabled={selectedIds.length < 2 || locked} />
            <ToolbarButton icon={Ungroup} label={t("svgEditor.ungroup")} onClick={ungroupSelection} disabled={!details || details.tag !== "g" || locked} />
            <ToolbarButton icon={Trash2} label={t("svgEditor.delete")} onClick={deleteSelection} disabled={!selectedIds.length || locked} danger />
          </div>
        </div>

        <SvgContextBar
          selectedCount={selectedIds.length}
          isMobile={isMobile}
          details={details}
          bounds={selectedBounds}
          locked={locked}
          paint={paint}
          colorTarget={colorTarget}
          onColorTargetChange={setColorTarget}
          onAttribute={handleAttributeCommit}
          onAttributeLive={handleAttributeLive}
          t={t}
        />

        {palettePickerOpen && (
          <div className="svg-editor-palette-overlay" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setPalettePickerOpen(false); }}>
            <section className="svg-editor-palette-dialog" role="dialog" aria-modal="true" aria-label={t("svgEditor.logoPalettesTitle")}>
              <header><div><Palette size={18} /><div><strong>{t("svgEditor.logoPalettesTitle")}</strong><small>{t("svgEditor.logoPalettesHint")}</small></div></div><button type="button" onClick={() => setPalettePickerOpen(false)} aria-label={t("svgEditor.close")}><X size={18} /></button></header>
              <LogoPalettePicker onSelect={choosePalette} selectedPaletteId={selectedPaletteId} t={t} />
            </section>
          </div>
        )}

        {mobileTextComposerOpen && (
          <div className="svg-editor-mobile-text-composer" role="dialog" aria-modal="true" aria-label={mobileTextComposerMode === "edit" ? (t("svgEditor.editText") || "Edit text") : (t("svgEditor.addText") || "Add text")}>
            <header className="svg-editor-mobile-text-composer-header">
              <button type="button" className="svg-editor-mobile-text-back" onClick={() => setMobileTextComposerOpen(false)} aria-label={t("svgEditor.backToTabs") || "Back"}><ChevronLeft size={20} /></button>
              <strong>{mobileTextComposerMode === "edit" ? (t("svgEditor.editText") || "Edit text") : (t("svgEditor.addText") || "Add text")}</strong>
              <span />
            </header>
            <div className="svg-editor-mobile-text-composer-body">
              <div className="svg-editor-mobile-text-input-card">
                <Type size={22} />
                <textarea autoFocus value={mobileTextDraft} onChange={(event) => setMobileTextDraft(event.target.value)} maxLength={1000} placeholder={t("svgEditor.newText") || "Type your text..."} aria-label={t("svgEditor.textContent") || "Text content"} />
                <small>{mobileTextDraft.length}/1000</small>
              </div>
              <button type="button" className="svg-editor-mobile-text-confirm" onClick={confirmMobileText} disabled={!mobileTextDraft.trim()}><Check size={18} />{t("svgEditor.confirmText") || "OK"}</button>
            </div>
          </div>
        )}

        {error && <div className="svg-editor-toast" role="alert"><CircleAlert size={15} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label={t("svgEditor.close")}><X size={14} /></button></div>}

        <div className={`svg-editor-workspace ${layersCollapsed ? "layers-collapsed" : ""} ${propertiesCollapsed ? "properties-collapsed" : ""}`} data-mobile-tab={activeMobileTab || ""}>
          <SvgLayersPanel tree={tree} selectedIds={selectedIds} onSelect={selectElement} onHide={hideElement} onLock={lockElement} onReorder={reorderBetween} t={t} collapsed={layersCollapsed} onToggleCollapsed={() => setLayersCollapsed((value) => !value)} onClose={() => setMobileEditorTab(null)} />
          <button type="button" className="svg-editor-layers-backdrop" tabIndex={-1} aria-hidden="true" onClick={() => setMobileEditorTab(null)} />
          <main
            className="svg-editor-center-panel"
            onPointerDown={(event) => {
              // Clicking anywhere on the workspace backdrop deselects any active element
              if (
                !event.target.closest("[data-editor-id]") &&
                !event.target.closest("[data-editor-handle]") &&
                !event.target.closest(".svg-editor-panel") &&
                !event.target.closest("button") &&
                !event.target.closest("input") &&
                !event.target.closest("textarea") &&
                !event.target.closest(".svg-editor-toolbar")
              ) {
                if (selectedIds.length > 0) {
                  setSelectedIds([]);
                }
              }
            }}
          >
            <div className="svg-editor-canvas-heading"><div><strong>{t("svgEditor.canvas")}</strong><span>{svgMarkup ? t("svgEditor.vectorArtwork") : t("svgEditor.awaitingFile")}</span></div><span className="svg-editor-document-chip">{svgMarkup ? `${tree.reduce((sum, node) => sum + countTreeNodes(node), 0)} ${t("svgEditor.nodes")}` : t("svgEditor.noDocument")}</span></div>
            {renderCanvas()}
          </main>
          <SvgPropertiesPanel
            selectedCount={selectedIds.length}
            details={details}
            bounds={selectedBounds}
            locked={locked}
            error={error}
            onRename={(label) => performEdit(t("svgEditor.labelUpdated"), (root) => renameElement(root, selectedId, label))}
            onText={(value) => liveCommit(t("svgEditor.textUpdated"), (root) => updateElementText(root, selectedId, value))}
            onTextLive={(value) => livePreview((root) => updateElementText(root, selectedId, value))}
            onSize={handleSizeCommit}
            onSizeLive={handleSizeLive}
            onRotate={(value, bounds) => liveCommit(t("svgEditor.rotationUpdated"), (root, b) => rotateElement(root, selectedId, value, b), bounds)}
            onRotateLive={(value, bounds) => livePreview((root, b) => rotateElement(root, selectedId, value, b), bounds)}
            onFlip={(axis) => flipSelectedElement(axis)}
            onAttribute={handleAttributeCommit}
            onAttributeLive={handleAttributeLive}
            onLiveCancel={liveCancel}
            onNudge={nudgeSelection}
            collapsed={propertiesCollapsed}
            onToggleCollapsed={() => setPropertiesCollapsed((value) => !value)}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onGroup={groupSelection}
            onUngroup={ungroupSelection}
            onEditText={requestEditText}
            activeMobileTab={activeMobileTab}
            paint={paint}
            colorTarget={colorTarget}
            onColorTargetChange={setColorTarget}
            onSetSolidBackground={handleSetSolidBackground}
            onSetSolidBackgroundLive={handleSetSolidBackgroundLive}
            onSetGradientBackgroundLive={handleSetGradientBackgroundLive}
            onSetImageBackgroundLive={handleSetImageBackgroundLive}
            onRotateBackgroundLive={handleRotateBackgroundLive}
            onSetGradientBackground={handleSetGradientBackground}
            onSetImageBackground={handleSetImageBackground}
            onRotateBackground={handleRotateBackground}
            onRemoveBackground={handleRemoveBackground}
            backgroundInfo={backgroundInfo}
            hasBackground={hasBackground}
            backgroundSubTab={backgroundSubTab}
            onSelectBackgroundSubTab={setBackgroundSubTab}
            t={t}
          />
        </div>
        {mobileEditorTab === "background" ? (
          <nav className="svg-editor-background-tabbar" aria-label="Background options">
            <button
              type="button"
              className="svg-editor-bg-tab svg-editor-bg-back-btn"
              onClick={() => setMobileEditorTab(null)}
              title={t("svgEditor.backToTabs") || "Back"}
            >
              <BackIcon />
              <span>{t("svgEditor.backToTabs") || "Back"}</span>
            </button>
            <span className="svg-editor-mobile-tab-divider" aria-hidden="true" />
            <button
              type="button"
              className={`svg-editor-bg-tab ${backgroundSubTab === "solid" ? "is-active" : ""}`}
              onClick={() => setBackgroundSubTab("solid")}
            >
              <SolidIcon />
              <span>{t("svgEditor.solidColor") || "Solid"}</span>
            </button>
            <button
              type="button"
              className={`svg-editor-bg-tab ${backgroundSubTab === "gradient" ? "is-active" : ""}`}
              onClick={() => setBackgroundSubTab("gradient")}
            >
              <GradientIcon />
              <span>{t("svgEditor.gradientColor") || "Gradient"}</span>
            </button>
            <button
              type="button"
              className={`svg-editor-bg-tab ${backgroundSubTab === "image" ? "is-active" : ""}`}
              onClick={() => setBackgroundSubTab("image")}
            >
              <ImageIcon />
              <span>{t("svgEditor.imageBackground") || "Image"}</span>
            </button>
            <button
              type="button"
              className="svg-editor-bg-tab svg-editor-bg-reset-btn"
              onClick={() => handleRemoveBackground()}
              disabled={!hasBackground}
              title={t("svgEditor.resetBgAction") || "Reset"}
              aria-label={t("svgEditor.resetBgAction") || "Reset"}
            >
              <ResetIcon />
              <span>{t("svgEditor.resetBgAction") || "Reset"}</span>
            </button>
          </nav>
        ) : (
          <nav className="svg-editor-mobile-tabbar" aria-label="Editor tabs">
            {/* Layers: opens the animated layers drawer (first tab) */}
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "layers" ? "is-active" : ""}`} onClick={() => setMobileEditorTab((prev) => (prev === "layers" ? null : "layers"))} aria-expanded={mobileEditorTab === "layers"} disabled={!svgMarkup}>
              <LayersIcon />
              <span>{t("svgEditor.layers") || "Layers"}</span>
            </button>
            <span className="svg-editor-mobile-tab-divider" aria-hidden="true" />
            {/* Object: arrange → size → colors */}
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "controls" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "controls" ? null : "controls")}>
              <ArrangeIcon />
              <span>{t("svgEditor.arrange")}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "size" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "size" ? null : "size")}>
              <SizeIcon />
              <span>{t("svgEditor.size") || "Size"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "colors" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "colors" ? null : "colors")}>
              <ColorsIcon />
              <span>{t("svgEditor.colors") || "Colors"}</span>
            </button>
            <span className="svg-editor-mobile-tab-divider" aria-hidden="true" />
            {/* Text: add text → typography */}
            <button type="button" className="svg-editor-mobile-tab" onClick={requestAddText}>
              <TextIcon />
              <span>{t("svgEditor.text") || "Text"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "typography" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "typography" ? null : "typography")} disabled={!selectedIsText} aria-disabled={!selectedIsText} title={selectedIsText ? undefined : (t("svgEditor.typographyDisabled") || "Select a text item to edit its text options")}>
              <TypographyIcon />
              <span>{t("svgEditor.typography") || "Typography"}</span>
            </button>
            <span className="svg-editor-mobile-tab-divider" aria-hidden="true" />
            {/* Canvas */}
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "background" ? "is-active" : ""}`} onClick={() => { setMobileEditorTab("background"); setBackgroundSubTab("solid"); }}>
              <BackgroundIcon />
              <span>{t("svgEditor.background") || "Background"}</span>
            </button>
          </nav>
        )}
        <footer className="svg-editor-footer"><span><CheckCircle2 size={13} /> {t("svgEditor.localOnly")}</span><span>{t("svgEditor.shortcuts")}</span></footer>
      </section>
    </div>
  );

  return createPortal(body, document.body);
}

// The artwork is injected as raw markup. Keeping the `{ __html }` object stable (and the component memoised)
// guarantees React never re-injects it on an unrelated re-render, which would wipe the live selection frame,
// the resize/delete handles and the data-editor-selected flags the moment anything else changes.
const ArtboardSurface = React.memo(function ArtboardSurface({ markup, width, height }) {
  const html = React.useMemo(() => ({ __html: markup }), [markup]);
  return (
    <div
      className="svg-editor-artboard"
      style={{ width: `${width}px`, height: `${height}px`, transform: "translate(-50%, -50%)" }}
      dangerouslySetInnerHTML={html}
    />
  );
});

function countTreeNodes(node) {
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
}

import React from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/I18nContext";
import {
  X, Upload, Download, Undo2, Redo2, RotateCcw,
  Copy, Trash2, Group, Ungroup, FileCode2,
  MousePointer2, Type, CircleAlert, CheckCircle2, FileUp,
  SlidersHorizontal, Maximize2, Layers, Palette, Eye, EyeOff,
  Blend, RotateCw, Paintbrush, Image, Sparkles, ChevronLeft,
} from "lucide-react";
import SvgLayersPanel from "@/components/svgEditor/SvgLayersPanel";
import SvgPropertiesPanel from "@/components/svgEditor/SvgPropertiesPanel";
import ColorPalettePicker from "@/components/shared/ColorPalettePicker";
import {
  addTextElement,
  cloneSelectedElements,
  deleteSelectedElements,
  editSvgMarkup,
  exportSvgMarkup,
  flipElement,
  getElementDetails,
  getElementTree,
  groupSelectedElements,
  parseSvgDocument,
  renameElement,
  rotateElement,
  toggleElementHidden,
  toggleElementLock,
  ungroupElement,
  updateElementAttribute,
  updateElementPosition,
  nudgeElement,
  updateElementSize,
  updateElementText,
  reorderElementRelative,
  getBackgroundInfo,
  setSolidBackground,
  setGradientBackground,
  setImageBackground,
  applySvgPalette,
  rotateBackground,
  removeBackground,
} from "@/components/svgEditor/svgDocument";
import "@/components/svgEditor/svgEditor.css";

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
  const handleRadius = Math.max(2.4, Math.min(30, 6.5 * userUnitsPerPixel));

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
    frame.setAttribute("rx", String(Math.max(1.5, handleRadius * 0.22)));
    frame.setAttribute("fill", "none");
    frame.setAttribute("stroke", "#60a5fa");
    frame.setAttribute("stroke-width", String(Math.max(1, handleRadius * 0.22)));
    frame.setAttribute("stroke-dasharray", `${Math.max(3, handleRadius * 0.65)} ${Math.max(2, handleRadius * 0.48)}`);
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
      hitArea.setAttribute("stroke-width", String(Math.max(1.2, handleRadius * 0.28)));
      hitArea.setAttribute("vector-effect", "non-scaling-stroke");
      group.appendChild(hitArea);

      const glyph = svg.ownerDocument.createElementNS(namespace, "path");
      if (kind === "delete") {
        glyph.setAttribute("d", `M ${cx - handleRadius * 0.37} ${cy - handleRadius * 0.33} H ${cx + handleRadius * 0.37} M ${cx - handleRadius * 0.22} ${cy - handleRadius * 0.52} H ${cx + handleRadius * 0.22} M ${cx - handleRadius * 0.25} ${cy - handleRadius * 0.12} L ${cx - handleRadius * 0.2} ${cy + handleRadius * 0.4} H ${cx + handleRadius * 0.2} L ${cx + handleRadius * 0.25} ${cy - handleRadius * 0.12}`);
      } else {
        glyph.setAttribute("d", `M ${cx - handleRadius * 0.32} ${cy + handleRadius * 0.1} L ${cx + handleRadius * 0.3} ${cy - handleRadius * 0.52} M ${cx + handleRadius * 0.02} ${cy - handleRadius * 0.52} H ${cx + handleRadius * 0.3} V ${cy - handleRadius * 0.24} M ${cx - handleRadius * 0.3} ${cy - handleRadius * 0.1} L ${cx + handleRadius * 0.32} ${cy + handleRadius * 0.52} M ${cx + handleRadius * 0.04} ${cy + handleRadius * 0.52} H ${cx + handleRadius * 0.32} V ${cy + handleRadius * 0.24}`);
      }
      glyph.setAttribute("fill", "none");
      glyph.setAttribute("stroke", "#ffffff");
      glyph.setAttribute("stroke-width", String(Math.max(1, handleRadius * 0.16)));
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

export default function SvgEditorDialog({ onClose, direction = "ltr" }) {
  const { t } = useI18n();
  const [svgMarkup, setSvgMarkup] = React.useState("");
  const [originalMarkup, setOriginalMarkup] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [selectedBounds, setSelectedBounds] = React.useState(null);
  const [history, setHistory] = React.useState({ past: [], future: [] });
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const [layersCollapsed, setLayersCollapsed] = React.useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = React.useState(false);
  const [mobileEditorTab, setMobileEditorTab] = React.useState(null);
  const [backgroundSubTab, setBackgroundSubTab] = React.useState("solid");
  const [palettePickerOpen, setPalettePickerOpen] = React.useState(false);
  const [selectedPaletteId, setSelectedPaletteId] = React.useState("ocean-mist");
  const [previewHiddenIds, setPreviewHiddenIds] = React.useState(() => new Set());
  const fileInputRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const markupRef = React.useRef("");
  const dragRef = React.useRef(null);
  const shortcutsRef = React.useRef({});
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
    // Fit the complete artboard inside the measured canvas without a mutable
    // zoom factor. Mobile has a dedicated, tighter fit so the artwork uses the
    // available width while still respecting the visible canvas height.
    const isMobile = canvasSize.width <= 660;
    // On mobile, use the full canvas width whenever the document's aspect ratio
    // allows it. Height is derived from the original SVG aspect ratio and the
    // available canvas height, never from the currently opened control tab.
    // Control panels are overlays, so opening one must not resize the artboard.
    const horizontalMargin = isMobile ? 0 : 48;
    const verticalMargin = isMobile ? 16 : 48;
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
      const parsed = parseSvgDocument(source);
      replaceMarkup(parsed.markup);
      setOriginalMarkup(parsed.markup);
      setFileName(file.name.replace(/\.svg$/i, "") || "untitled");
      setSelectedIds([]);
      setPreviewHiddenIds(new Set());
      setSelectedPaletteId("ocean-mist");
      setPalettePickerOpen(false);
      setHistory({ past: [], future: [] });
      updateView({ zoom: 1, pan: { x: 0, y: 0 } });
      setNotice(t("svgEditor.imported"));
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

  const createTextSelection = () => {
    if (!markupRef.current) return;
    let newId = null;
    const succeeded = performEdit(t("svgEditor.textAdded"), (root) => {
      newId = addTextElement(root, t("svgEditor.newText"));
    });
    if (succeeded && newId) setSelectedIds([newId]);
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
    // flipElement needs bounds in the selected element's parent coordinate space,
    // not the root artboard coordinates used by the blue selection frame.
    const boundsInParent = getBounds(liveElement) || selectedBounds;
    performEdit(t("svgEditor.flipped"), (root) => flipElement(root, selectedId, axis, boundsInParent));
  };

  const choosePalette = (palette) => {
    const changed = performEdit(t("palette.applied"), (root) => applySvgPalette(root, palette));
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

  const handleSetSolidBackground = React.useCallback((color) => {
    performEdit(t("svgEditor.backgroundUpdated"), (root) => {
      setSolidBackground(root, color);
    });
  }, [performEdit, t]);

  const handleSetGradientBackground = React.useCallback((color1, color2, angle = 90) => {
    performEdit(t("svgEditor.backgroundUpdated"), (root) => {
      setGradientBackground(root, color1, color2, angle);
    });
  }, [performEdit, t]);

  const handleSetImageBackground = React.useCallback((dataUrl, opacity = 1) => {
    performEdit(t("svgEditor.backgroundUpdated"), (root) => {
      setImageBackground(root, dataUrl, opacity);
    });
  }, [performEdit, t]);

  const handleRotateBackground = React.useCallback((angle) => {
    performEdit(t("svgEditor.backgroundUpdated"), (root) => {
      rotateBackground(root, angle);
    });
  }, [performEdit, t]);

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

  const resetEditor = () => {
    if (!originalMarkup) return;
    if (!window.confirm(t("svgEditor.resetProjectConfirm"))) return;
    replaceMarkup(originalMarkup);
    setHistory({ past: [], future: [] });
    setSelectedIds([]);
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
    const target = event.target.closest?.("[data-editor-id]");
    if (!target) {
      if (selectedIds.length > 0) {
        setSelectedIds([]);
      }
      return;
    }
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
        <div
          className="svg-editor-artboard"
          style={{
            width: `${artboardSize.width}px`,
            height: `${artboardSize.height}px`,
            transform: "translate(-50%, -50%)",
          }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
        <div className="svg-editor-canvas-hint"><MousePointer2 size={13} /> {t("svgEditor.selectHint")}</div>
      </div>
    );
  };

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
            <button type="button" className={`svg-editor-secondary-button svg-editor-layers-header-btn ${mobileEditorTab === "layers" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "layers" ? null : "layers")} title={t("svgEditor.layersTitle") || "Layers"}><Layers size={15} /><span>{t("svgEditor.layersTitle") || "Layers"}</span></button>
            <button type="button" className="svg-editor-secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={15} />{t("svgEditor.open")}</button>
            <button type="button" className="svg-editor-export-button" onClick={downloadSvg} disabled={!svgMarkup}><Download size={15} />{t("svgEditor.export")}</button>
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
            <ToolbarButton icon={Type} label={t("svgEditor.addText")} onClick={createTextSelection} disabled={!svgMarkup} />
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

        {(error || notice) && <div className={`svg-editor-feedback ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={15} /> : <CheckCircle2 size={15} />}{error || notice}</div>}

        {palettePickerOpen && (
          <div className="svg-editor-palette-overlay" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setPalettePickerOpen(false); }}>
            <section className="svg-editor-palette-dialog" role="dialog" aria-modal="true" aria-label={t("palette.galleryTitle")}>
              <header><div><Palette size={18} /><div><strong>{t("palette.galleryTitle")}</strong><small>{t("palette.galleryHint")}</small></div></div><button type="button" onClick={() => setPalettePickerOpen(false)} aria-label={t("svgEditor.close")}><X size={18} /></button></header>
              <ColorPalettePicker onSelect={choosePalette} selectedPaletteId={selectedPaletteId} t={t} />
            </section>
          </div>
        )}

        <div className={`svg-editor-workspace ${layersCollapsed ? "layers-collapsed" : ""} ${propertiesCollapsed ? "properties-collapsed" : ""}`} data-mobile-tab={mobileEditorTab || ""}>
          <SvgLayersPanel tree={tree} selectedIds={selectedIds} onSelect={selectElement} onHide={hideElement} onLock={lockElement} onReorder={reorderBetween} t={t} collapsed={layersCollapsed} onToggleCollapsed={() => setLayersCollapsed((value) => !value)} />
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
            onPosition={(axis, value, bounds) => performEdit(t("svgEditor.positionUpdated"), (root) => updateElementPosition(root, selectedId, axis, value, bounds))}
            onText={(value) => performEdit(t("svgEditor.textUpdated"), (root) => updateElementText(root, selectedId, value))}
            onSize={(dimension, value, bounds) => performEdit(t("svgEditor.dimensionsUpdated"), (root) => updateElementSize(root, selectedId, dimension, value, bounds))}
            onRotate={(value, bounds) => performEdit(t("svgEditor.rotationUpdated"), (root) => rotateElement(root, selectedId, value, bounds))}
            onFlip={(axis) => flipSelectedElement(axis)}
            onAttribute={(name, value) => performEdit(t("svgEditor.appearanceUpdated"), (root) => updateElementAttribute(root, selectedId, name, value))}
            onNudge={nudgeSelection}
            collapsed={propertiesCollapsed}
            onToggleCollapsed={() => setPropertiesCollapsed((value) => !value)}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onGroup={groupSelection}
            onUngroup={ungroupSelection}
            onAddText={createTextSelection}
            activeMobileTab={mobileEditorTab}
            onSetSolidBackground={handleSetSolidBackground}
            onSetGradientBackground={handleSetGradientBackground}
            onSetImageBackground={handleSetImageBackground}
            onRotateBackground={handleRotateBackground}
            onRemoveBackground={handleRemoveBackground}
            backgroundInfo={backgroundInfo}
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
              <ChevronLeft size={20} />
              <span>{t("svgEditor.backToTabs") || "Back"}</span>
            </button>
            <button
              type="button"
              className={`svg-editor-bg-tab ${backgroundSubTab === "solid" ? "is-active" : ""}`}
              onClick={() => setBackgroundSubTab("solid")}
            >
              <Palette size={20} />
              <span>{t("svgEditor.solidColor") || "Solid"}</span>
            </button>
            <button
              type="button"
              className={`svg-editor-bg-tab ${backgroundSubTab === "gradient" ? "is-active" : ""}`}
              onClick={() => setBackgroundSubTab("gradient")}
            >
              <Sparkles size={20} />
              <span>{t("svgEditor.gradientColor") || "Gradient"}</span>
            </button>
            <button
              type="button"
              className={`svg-editor-bg-tab ${backgroundSubTab === "image" ? "is-active" : ""}`}
              onClick={() => setBackgroundSubTab("image")}
            >
              <Image size={20} />
              <span>{t("svgEditor.imageBackground") || "Image"}</span>
            </button>
            <button
              type="button"
              className={`svg-editor-bg-tab svg-editor-bg-reset-btn ${backgroundSubTab === "clear" ? "is-active" : ""}`}
              onClick={() => {
                handleRemoveBackground();
                setBackgroundSubTab("clear");
              }}
              title={t("svgEditor.clearBackground") || "Clear"}
            >
              <Trash2 size={20} />
              <span>{t("svgEditor.clearBackground") || "Clear"}</span>
            </button>
          </nav>
        ) : (
          <nav className="svg-editor-mobile-tabbar" aria-label="Editor tabs">
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "controls" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "controls" ? null : "controls")}>
              <SlidersHorizontal size={20} />
              <span>{t("svgEditor.controls") || "Controls"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "text" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "text" ? null : "text")}>
              <Type size={20} />
              <span>{t("svgEditor.text") || "Text"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "size" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "size" ? null : "size")}>
              <Maximize2 size={20} />
              <span>{t("svgEditor.size") || "Size"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "colors" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "colors" ? null : "colors")}>
              <Palette size={20} />
              <span>{t("svgEditor.colors") || "Colors"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "background" ? "is-active" : ""}`} onClick={() => { setMobileEditorTab("background"); setBackgroundSubTab("solid"); }}>
              <Image size={20} />
              <span>{t("svgEditor.background") || "Background"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "opacity" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "opacity" ? null : "opacity")}>
              <Blend size={20} />
              <span>{t("svgEditor.opacity") || "Opacity"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "rotation" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "rotation" ? null : "rotation")}>
              <RotateCw size={20} />
              <span>{t("svgEditor.rotation")?.replace(/\(.*\)/, "").trim() || "Rotation"}</span>
            </button>
            <button type="button" className={`svg-editor-mobile-tab ${mobileEditorTab === "stroke" ? "is-active" : ""}`} onClick={() => setMobileEditorTab(prev => prev === "stroke" ? null : "stroke")}>
              <Paintbrush size={20} />
              <span>{t("svgEditor.stroke") || "Stroke"}</span>
            </button>
          </nav>
        )}
        <footer className="svg-editor-footer"><span><CheckCircle2 size={13} /> {t("svgEditor.localOnly")}</span><span>{t("svgEditor.shortcuts")}</span></footer>
      </section>
    </div>
  );

  return createPortal(body, document.body);
}

function countTreeNodes(node) {
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
}

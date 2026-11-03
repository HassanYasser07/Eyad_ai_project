import React from "react";
import { Eye, EyeOff, Lock, Unlock, Layers3, GripVertical, X } from "lucide-react";
import SlideView, { collectImagePaths } from "./SlideView.jsx";
import { useMediaUrls } from "./useMediaUrls.js";
import { rotatedBox } from "./engine/index.js";

const EMU_PX = 9525;
const CLEAR_BG = { type: "solid", hex: "FFFFFF", alpha: 0 };

export function elementLabel(el, t) {
  const txt = el?.text?.plain?.find((s) => s.trim());
  if (txt) return txt.slice(0, 40);
  if (el?.kind === "table") return t("pptxEditor.kind.table");
  return el?.name || t(`pptxEditor.kind.${el?.kind || "shape"}`) || el?.kind || "Object";
}

/**
 * Layer thumbnail: a real miniature render of just this element, cropped to its (rotated) bounding box with the
 * same 14% breathing room the SVG editor uses. Memoised so unrelated edits do not re-render every thumbnail.
 */
const LayerThumb = React.memo(function LayerThumb({ el, model, urls, labels }) {
  const hostRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 48, h: 42 });
  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (w > 0 && h > 0) setSize((c) => (c.w === w && c.h === h ? c : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const thumbModel = React.useMemo(
    () => ({ ...model, background: CLEAR_BG, under: [], elements: [{ ...el, hidden: false }] }),
    [model, el],
  );
  const box = rotatedBox({ x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot });
  const bw = Math.max(box.w / EMU_PX, 1), bh = Math.max(box.h / EMU_PX, 1);
  const pad = Math.max(1, Math.max(bw, bh) * 0.14);
  const vw = bw + pad * 2, vh = bh + pad * 2;
  const k = Math.min(size.w / vw, size.h / vh);
  const ox = (size.w - vw * k) / 2 - (box.x / EMU_PX - pad) * k;
  const oy = (size.h - vh * k) / 2 - (box.y / EMU_PX - pad) * k;
  const W = model.size.w / EMU_PX, H = model.size.h / EMU_PX;

  return (
    <span ref={hostRef} className="pe-layer-thumbnail" aria-hidden="true" dir="ltr">
      <span className="pe-layer-thumb-stage" style={{ width: W, height: H, transform: `translate(${ox}px, ${oy}px) scale(${k})` }}>
        <SlideView model={thumbModel} urls={urls} hints={false} labels={labels} />
      </span>
    </span>
  );
});

function LayerRow({ el, model, urls, labels, selected, locked, onSelect, onHide, onLock, onReorder, t }) {
  const readOnly = !!el.readOnlyGeometry;
  const hidden = !!el.hidden;
  const noDrag = locked || readOnly;
  const EyeIcon = hidden ? EyeOff : Eye;
  const LockIcon = locked ? Lock : Unlock;
  const label = elementLabel(el, t);

  return (
    <div
      className={`pe-layer-card ${selected ? "is-selected" : ""} ${hidden ? "is-hidden" : ""} ${locked ? "is-locked" : ""}`}
      data-layer-card-id={el.id}
      draggable={!noDrag}
      onDragStart={(event) => {
        if (noDrag) { event.preventDefault(); return; }
        event.dataTransfer.setData("text/plain", el.id);
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("is-dragging");
      }}
      onDragEnd={(event) => event.currentTarget.classList.remove("is-dragging")}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        event.currentTarget.classList.add("is-drop-target");
      }}
      onDragLeave={(event) => event.currentTarget.classList.remove("is-drop-target")}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove("is-drop-target");
        const sourceId = event.dataTransfer.getData("text/plain");
        if (!sourceId || sourceId === el.id) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        onReorder(sourceId, el.id, event.clientY > bounds.top + bounds.height / 2);
      }}
    >
      <button
        type="button"
        className="pe-layer-select"
        onClick={(event) => onSelect(el.id, event.shiftKey || event.metaKey || event.ctrlKey)}
        aria-pressed={selected}
        aria-label={`${t("pptxEditor.selectLayer")}: ${label}`}
        title={label}
      >
        <span className="pe-layer-drag-handle" aria-hidden="true" title={t("pptxEditor.dragLayer")}><GripVertical size={15} /></span>
        <LayerThumb el={el} model={model} urls={urls} labels={labels} />
        <span className="pe-layer-copy"><strong>{label}</strong></span>
      </button>
      <span className="pe-layer-actions">
        <button type="button" onClick={() => onHide(el.id, !hidden)} aria-label={hidden ? t("pptxEditor.showLayer") : t("pptxEditor.hideLayer")} title={hidden ? t("pptxEditor.showLayer") : t("pptxEditor.hideLayer")}>
          <EyeIcon size={15} />
        </button>
        <button type="button" onClick={() => onLock(el.id)} aria-label={locked ? t("pptxEditor.unlock") : t("pptxEditor.lock")} title={locked ? t("pptxEditor.unlock") : t("pptxEditor.lock")}>
          <LockIcon size={15} />
        </button>
      </span>
    </div>
  );
}

/**
 * The layer list itself (rows, thumbnails, mouse drag-and-drop, touch/pen drag from the grip). Used by the desktop
 * "Layers" tab and by the mobile layers sidebar so both behave identically.
 */
export function PptxLayerList({ pkg, model, sel, locked, a, t, labels }) {
  const layerListRef = React.useRef(null);
  const pointerDragRef = React.useRef(null);
  const urls = useMediaUrls(pkg, model ? collectImagePaths(model) : []);
  const list = React.useMemo(() => (model ? [...model.elements].reverse() : []), [model]);
  const selectedIds = React.useMemo(() => sel.map((item) => item.id), [sel]);

  // Latest values for the long-lived document listeners below.
  const live = React.useRef({});
  live.current = { list, a };

  const reorderBetween = React.useCallback((sourceId, targetId, after) => {
    const { list: items, a: actions } = live.current;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(sourceId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    let dest = after ? (from < to ? to : to + 1) : (from < to ? to - 1 : to);
    dest = Math.max(0, Math.min(ids.length - 1, dest));
    if (dest !== from) actions.moveLayer(sourceId, dest);
  }, []);

  React.useEffect(() => {
    const clearDragClasses = () => {
      layerListRef.current?.querySelectorAll(".is-dragging, .is-drop-target").forEach((element) => {
        element.classList.remove("is-dragging", "is-drop-target");
      });
    };
    const clearDropTarget = () => layerListRef.current?.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
    const onPointerMove = (event) => {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.started && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
      drag.started = true;
      layerListRef.current?.querySelector(`[data-layer-card-id="${CSS.escape(drag.id)}"]`)?.classList.add("is-dragging");
      clearDropTarget();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-layer-card-id]");
      if (target && layerListRef.current?.contains(target) && target.getAttribute("data-layer-card-id") !== drag.id) target.classList.add("is-drop-target");
      event.preventDefault();
    };
    const onPointerUp = (event) => {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pointerDragRef.current = null;
      if (drag.started) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-layer-card-id]");
        if (target && layerListRef.current?.contains(target)) {
          const targetId = target.getAttribute("data-layer-card-id");
          if (targetId && targetId !== drag.id) {
            const bounds = target.getBoundingClientRect();
            reorderBetween(drag.id, targetId, event.clientY > bounds.top + bounds.height / 2);
          }
        }
        event.preventDefault();
      }
      clearDragClasses();
    };
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      clearDragClasses();
    };
  }, [reorderBetween]);

  const beginLayerPointerDrag = (event) => {
    // Desktop uses native drag-and-drop; this pointer path enables touch and pen reordering.
    if (event.pointerType === "mouse") return;
    if (!event.target.closest?.(".pe-layer-drag-handle")) return;
    const card = event.target.closest?.("[data-layer-card-id]");
    if (!card || card.getAttribute("draggable") === "false") return;
    pointerDragRef.current = {
      id: card.getAttribute("data-layer-card-id"),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    event.preventDefault();
  };

  const select = (id, additive) => a.select(additive ? (selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]) : [id]);

  if (!model || !list.length) return <div className="pe-lp-empty">{t("pptxEditor.noLayers")}</div>;
  return (
    <div ref={layerListRef} className="pe-layer-list" data-testid="pptx-layers" onPointerDown={beginLayerPointerDrag}>
      {list.map((el) => (
        <LayerRow
          key={el.id}
          el={el}
          model={model}
          urls={urls}
          labels={labels}
          selected={selectedIds.includes(el.id)}
          locked={locked.has(el.id)}
          onSelect={select}
          onHide={a.setHidden}
          onLock={(id) => a.toggleLock([id])}
          onReorder={reorderBetween}
          t={t}
        />
      ))}
    </div>
  );
}

/** Mobile layers sidebar: slides in from the start edge (same drawer as the SVG editor). */
export default function PptxLayersPanel({ open, onClose, pkg, model, sel, locked, a, t, labels }) {
  const count = model?.elements?.length || 0;
  return (
    <section className={`pe-lp ${open ? "is-open" : ""}`} aria-label={t("pptxEditor.tab.layers")} aria-hidden={!open} data-testid="pptx-layers-drawer">
      <div className="pe-lp-heading">
        <span><Layers3 size={16} /> <span className="pe-lp-heading-label">{t("pptxEditor.tab.layers")}</span></span>
        <div className="pe-lp-heading-actions">
          <small>{count}</small>
          <button type="button" className="pe-lp-close" onClick={onClose} aria-label={t("pptxEditor.close")} title={t("pptxEditor.close")} data-testid="pptx-layers-close"><X size={16} /></button>
        </div>
      </div>
      <div className="pe-lp-content">
        <PptxLayerList pkg={pkg} model={model} sel={sel} locked={locked} a={a} t={t} labels={labels} />
      </div>
    </section>
  );
}

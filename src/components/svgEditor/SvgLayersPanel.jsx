import React from "react";
import { Eye, EyeOff, Lock, Unlock, Layers3, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";

// Layer thumbnails embed their own copy of the artwork. Duplicate element ids
// (e.g. the background gradient "svg-editor-bg-gradient") make `url(#id)` resolve to the
// FIRST copy in the document, which on mobile lives inside a hidden panel
// (display:none), so gradients silently stopped rendering on the real canvas.
// Prefixing every id in the thumbnail keeps the canvas ids unique.
function scopeMarkupIds(markup, prefix) {
  if (!markup || markup.indexOf("id=") === -1) return markup;
  const ids = new Set();
  markup.replace(/\sid=("|')([^"']+)\1/g, (_, __, id) => { ids.add(id); return ""; });
  if (!ids.size) return markup;
  let out = markup;
  ids.forEach((id) => {
    const safe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = `${prefix}${id}`;
    out = out
      .replace(new RegExp(`(\\sid=)("|')${safe}\\2`, "g"), `$1$2${next}$2`)
      .replace(new RegExp(`url\\((["']?)#${safe}\\1\\)`, "g"), `url(#${next})`)
      .replace(new RegExp(`((?:xlink:)?href=)("|')#${safe}\\2`, "g"), `$1$2#${next}$2`);
  });
  return out;
}

function LayerRow({ node, depth, selectedIds, onSelect, onHide, onLock, onReorder, t }) {
  const selected = selectedIds.includes(node.id);
  const hidden = node.hidden;
  const locked = node.locked;
  const effectiveLock = locked || node.lockedByAncestor;
  const selectable = node.id !== "svg-root";
  const EyeIcon = hidden ? EyeOff : Eye;
  const LockIcon = effectiveLock ? Lock : Unlock;
  const thumbnailRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const preview = thumbnailRef.current?.querySelector("svg");
    if (!preview) return;
    const target = Array.from(preview.querySelectorAll("[data-editor-id]"))
      .find((element) => element.getAttribute("data-editor-id") === node.id);
    if (!target) return;
    try {
      const box = target.getBBox();
      const rootMatrix = preview.getScreenCTM();
      const targetMatrix = target.getScreenCTM();
      if (!rootMatrix || !targetMatrix || box.width <= 0 || box.height <= 0) return;
      const matrix = rootMatrix.inverse().multiply(targetMatrix);
      const points = [
        [box.x, box.y], [box.x + box.width, box.y],
        [box.x, box.y + box.height], [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => {
        const point = preview.createSVGPoint();
        point.x = x;
        point.y = y;
        return point.matrixTransform(matrix);
      });
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      const width = Math.max(...xs) - left;
      const height = Math.max(...ys) - top;
      const padding = Math.max(1, Math.max(width, height) * 0.14);
      preview.setAttribute("viewBox", `${left - padding} ${top - padding} ${width + padding * 2} ${height + padding * 2}`);
    } catch {
      // Keep the full-page thumbnail if a specialised SVG node cannot be measured.
    }
  }, [node.id, node.previewMarkup]);

  return (
    <>
    <div
      className={`svg-editor-layer-card ${selected ? "is-selected" : ""}`}
      data-layer-card-id={node.id}
      style={{ "--layer-depth": depth }}
      draggable={selectable && !effectiveLock}
      onDragStart={(event) => {
        if (!selectable || effectiveLock) { event.preventDefault(); return; }
        event.dataTransfer.setData("text/plain", node.id);
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("is-dragging");
      }}
      onDragEnd={(event) => event.currentTarget.classList.remove("is-dragging")}
      onDragOver={(event) => {
        if (!selectable) return;
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
        if (!sourceId || sourceId === node.id) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        onReorder(sourceId, node.id, event.clientY > bounds.top + bounds.height / 2);
      }}
    >
      <button
        type="button"
        className="svg-editor-layer-select"
        onClick={(event) => selectable && onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}
        aria-pressed={selected}
        title={node.label}
      >
        <span className="svg-editor-layer-drag-handle" aria-hidden="true"><GripVertical size={15} /></span>
        <span ref={thumbnailRef} className="svg-editor-layer-thumbnail" aria-hidden="true" dangerouslySetInnerHTML={{ __html: scopeMarkupIds(node.previewMarkup, `lp${String(node.id).replace(/[^a-zA-Z0-9_-]/g, "")}-`) }} />
        <span className="svg-editor-layer-copy"><strong>{node.label}</strong></span>
      </button>
      {selectable && (
        <span className="svg-editor-layer-actions">
          <button type="button" onClick={() => onHide(node.id)} aria-label={t(hidden ? "svgEditor.showElement" : "svgEditor.hideElement")} title={t(hidden ? "svgEditor.showElement" : "svgEditor.hideElement")}>
            <EyeIcon size={15} />
          </button>
          <button type="button" onClick={() => onLock(node.id)} disabled={node.lockedByAncestor} aria-label={t(effectiveLock ? "svgEditor.unlockElement" : "svgEditor.lockElement")} title={node.lockedByAncestor ? t("svgEditor.unlockParentFirst") : t(effectiveLock ? "svgEditor.unlockElement" : "svgEditor.lockElement")}>
            <LockIcon size={15} />
          </button>
        </span>
      )}
    </div>
    {node.children.length > 0 && (
      <div className="svg-editor-layer-children">
        {node.children.map((child) => (
          <LayerRow key={child.id} node={child} depth={depth + 1} selectedIds={selectedIds} onSelect={onSelect} onHide={onHide} onLock={onLock} onReorder={onReorder} t={t} />
        ))}
      </div>
    )}
    </>
  );
}

export default function SvgLayersPanel({ tree, selectedIds, onSelect, onHide, onLock, onReorder, t, collapsed = false, onToggleCollapsed }) {
  const layerListRef = React.useRef(null);
  const pointerDragRef = React.useRef(null);

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
            onReorder(drag.id, targetId, event.clientY > bounds.top + bounds.height / 2);
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
  }, [onReorder]);

  const beginLayerPointerDrag = (event) => {
    // Desktop uses native drag-and-drop; this pointer path enables touch and pen reordering.
    if (event.pointerType === "mouse") return;
    if (!event.target.closest?.(".svg-editor-layer-drag-handle")) return;
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

  return (
    <section className={`svg-editor-panel svg-editor-layers-panel ${collapsed ? "is-collapsed" : ""}`} aria-label={t("svgEditor.layersTitle")}>
      <div className="svg-editor-panel-heading">
        <span><Layers3 size={16} /> <span className="svg-editor-panel-heading-label">{t("svgEditor.layersTitle")}</span></span>
        <div className="svg-editor-panel-heading-actions">
          <small>{tree.reduce((sum, node) => sum + countNodes(node), 0)}</small>
          <button type="button" className="svg-editor-panel-toggle" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={t(collapsed ? "svgEditor.expandLayers" : "svgEditor.collapseLayers")} title={t(collapsed ? "svgEditor.expandLayers" : "svgEditor.collapseLayers")}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>
      <div className="svg-editor-panel-content">
        {!tree.length ? (
          <div className="svg-editor-panel-empty">{t("svgEditor.layersEmpty")}</div>
        ) : (
          <div ref={layerListRef} className="svg-editor-layer-list" onPointerDown={beginLayerPointerDrag}>
            {tree.map((node) => <LayerRow key={node.id} node={node} depth={0} selectedIds={selectedIds} onSelect={onSelect} onHide={onHide} onLock={onLock} onReorder={onReorder} t={t} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function countNodes(node) {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

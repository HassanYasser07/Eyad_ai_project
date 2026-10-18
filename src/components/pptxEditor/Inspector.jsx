import React from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  BringToFront, SendToBack,
  Group, Ungroup, Copy, Trash2, Lock, Unlock, FlipHorizontal2, FlipVertical2,
  Type, Square, Table2, Minus, Eye, EyeOff, GripVertical, Image as ImageIcon,
} from "lucide-react";
import { IconButton, NumberField, Section } from "./Controls.jsx";

// Local table/object vertical-alignment icons. Do not import these names from
// lucide-react: AlignCenterHorizontal and AlignEndHorizontal are not exports.
const AlignStartHorizontal = ({ size = 16, strokeWidth = 2, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 5H21" />
    <rect x="5" y="9" width="5" height="10" rx="1" />
    <rect x="14" y="9" width="5" height="6" rx="1" />
  </svg>
);
const AlignCenterHorizontal = ({ size = 16, strokeWidth = 2, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 12H21" />
    <rect x="5" y="7" width="5" height="10" rx="1" />
    <rect x="14" y="9" width="5" height="6" rx="1" />
  </svg>
);
const AlignEndHorizontal = ({ size = 16, strokeWidth = 2, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 19H21" />
    <rect x="5" y="9" width="5" height="10" rx="1" />
    <rect x="14" y="13" width="5" height="6" rx="1" />
  </svg>
);

const EMU_PT = 12700;
const NUDGE_EMU = 12700; // one PowerPoint point per precise nudge
const kindIcon = { text: Type, shape: Square, image: ImageIcon, table: Table2, group: Square, line: Minus };

export function elementLabel(el, t) {
  const txt = el?.text?.plain?.find((s) => s.trim());
  if (txt) return txt.slice(0, 40);
  if (el?.kind === "table") return t("pptxEditor.kind.table");
  return el?.name || t(`pptxEditor.kind.${el?.kind || "shape"}`) || el?.kind || "Object";
}

export default function Inspector({ tab = "arrange", sel = [], model, a, t, locked = new Set() }) {
  if (tab === "layers") return <LayersPanel model={model} sel={sel} a={a} t={t} locked={locked} />;
  return <ArrangePanel sel={sel} a={a} t={t} locked={locked} />;
}

function ArrangePanel({ sel, a, t, locked }) {
  const el = sel[0] || null;
  const multi = sel.length > 1;
  const ro = !el || sel.some((item) => item.readOnlyGeometry || locked.has(item.id));
  const hasEditable = sel.some((item) => !item.readOnlyGeometry && !locked.has(item.id));
  const editableCount = sel.filter((item) => !item.readOnlyGeometry && !locked.has(item.id)).length;
  return (
    <div className="pe-inspector" data-testid="pptx-arrange-panel">
      <Section title={t("pptxEditor.preciseMove")}>
        <div className="pe-nudge-grid" role="group" aria-label={t("pptxEditor.preciseMove")}>
          <span />
          <IconButton icon={ArrowUp} label={t("pptxEditor.nudgeUp")} onClick={() => a.nudge(0, -NUDGE_EMU)} disabled={ro} testId="pptx-nudge-up" />
          <span />
          <IconButton icon={ArrowLeft} label={t("pptxEditor.nudgeLeft")} onClick={() => a.nudge(-NUDGE_EMU, 0)} disabled={ro} testId="pptx-nudge-left" />
          <span className="pe-nudge-center">{el ? "1 pt" : "—"}</span>
          <IconButton icon={ArrowRight} label={t("pptxEditor.nudgeRight")} onClick={() => a.nudge(NUDGE_EMU, 0)} disabled={ro} testId="pptx-nudge-right" />
          <span />
          <IconButton icon={ArrowDown} label={t("pptxEditor.nudgeDown")} onClick={() => a.nudge(0, NUDGE_EMU)} disabled={ro} testId="pptx-nudge-down" />
          <span />
        </div>
        <p className="pe-note">{t("pptxEditor.nudgeHint")}</p>
      </Section>

      {el && !multi && <Section title={t("pptxEditor.section.position")}>
        <fieldset className={`pe-disabled-control ${ro ? "is-disabled" : ""}`} disabled={ro} aria-disabled={ro || undefined}>
          <div className="pe-grid2">
            <NumberField label="X" suffix="pt" value={el.x / EMU_PT} testId="pptx-x" onCommit={(v) => a.field({ x: v * EMU_PT })} />
            <NumberField label="Y" suffix="pt" value={el.y / EMU_PT} testId="pptx-y" onCommit={(v) => a.field({ y: v * EMU_PT })} />
            <NumberField label="W" suffix="pt" value={el.w / EMU_PT} min={1} testId="pptx-w" onCommit={(v) => a.field({ w: v * EMU_PT })} />
            <NumberField label="H" suffix="pt" value={el.h / EMU_PT} min={0} testId="pptx-h" onCommit={(v) => a.field({ h: v * EMU_PT })} />
          </div>
        </fieldset>
        <RotationDial value={el.rot || 0} disabled={ro} label={t("pptxEditor.rotation")} onCommit={(v) => a.field({ rot: v })} />
        <div className="pe-row pe-tools">
          <IconButton icon={FlipHorizontal2} label={t("pptxEditor.flipH")} active={el.flipH} onClick={() => a.field({ flipH: !el.flipH })} disabled={ro} />
          <IconButton icon={FlipVertical2} label={t("pptxEditor.flipV")} active={el.flipV} onClick={() => a.field({ flipV: !el.flipV })} disabled={ro} />
        </div>
      </Section>}

      <Section title={t("pptxEditor.section.arrange")}>
        {multi && <p className="pe-note">{t("pptxEditor.multiSelected", { n: sel.length })}</p>}
        <div className="pe-row pe-tools">
          <IconButton icon={AlignStartVertical} label={t("pptxEditor.align.left")} onClick={() => a.align("left")} disabled={!hasEditable} />
          <IconButton icon={AlignCenterVertical} label={t("pptxEditor.align.center")} onClick={() => a.align("center")} disabled={!hasEditable} />
          <IconButton icon={AlignEndVertical} label={t("pptxEditor.align.right")} onClick={() => a.align("right")} disabled={!hasEditable} />
          <IconButton icon={AlignStartHorizontal} label={t("pptxEditor.align.top")} onClick={() => a.align("top")} disabled={!hasEditable} />
          <IconButton icon={AlignCenterHorizontal} label={t("pptxEditor.align.middle")} onClick={() => a.align("middle")} disabled={!hasEditable} />
          <IconButton icon={AlignEndHorizontal} label={t("pptxEditor.align.bottom")} onClick={() => a.align("bottom")} disabled={!hasEditable} />
        </div>
        <div className="pe-row pe-tools">
          <IconButton icon={AlignCenterVertical} label={t("pptxEditor.distributeH")} text onClick={() => a.distribute("h")} disabled={sel.length < 3 || !hasEditable} />
          <IconButton icon={AlignCenterHorizontal} label={t("pptxEditor.distributeV")} text onClick={() => a.distribute("v")} disabled={sel.length < 3 || !hasEditable} />
        </div>
        <div className="pe-row pe-tools">
          <IconButton icon={Group} label={t("pptxEditor.group")} text onClick={a.group} disabled={editableCount < 2} testId="pptx-group" />
          <IconButton icon={Ungroup} label={t("pptxEditor.ungroup")} text onClick={a.ungroup} disabled={!(el?.kind === "group" && !multi && !locked.has(el.id) && !el.readOnlyGeometry)} testId="pptx-ungroup" />
        </div>
        <div className="pe-row pe-tools">
          <IconButton icon={Copy} label={t("pptxEditor.duplicate")} text onClick={a.duplicate} disabled={!hasEditable} testId="pptx-duplicate" />
          <IconButton icon={Trash2} label={t("pptxEditor.delete")} text danger onClick={a.remove} disabled={!hasEditable} testId="pptx-delete" />
        </div>
        <button type="button" className="pe-wide" onClick={a.selectBehind} disabled={!el}>{t("pptxEditor.selectBehind")}</button>
      </Section>
      {!el && <div className="pe-empty"><p>{t("pptxEditor.selectHint")}</p></div>}
    </div>
  );
}

function RotationDial({ value, onCommit, disabled, label }) {
  const [draft, setDraft] = React.useState(Math.round(((value % 360) + 360) % 360));
  const dragging = React.useRef(false);
  React.useEffect(() => setDraft(Math.round(((value % 360) + 360) % 360)), [value]);
  const angleFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.round((Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90 + 360) % 360);
  };
  const commit = (v) => { const n = (Math.round(v) + 360) % 360; setDraft(n); onCommit(n); };
  const update = (e) => setDraft(angleFromEvent(e));
  return <div className="pe-rotation-card">
    <div className="pe-rotation-head"><span>{label}</span><strong>{draft}°</strong></div>
    <div className={`pe-rotation-dial ${disabled ? "is-disabled" : ""}`} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-valuemin={0} aria-valuemax={359} aria-valuenow={draft}
      onPointerDown={(e) => { if (disabled) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (dragging.current) update(e); }}
      onPointerUp={(e) => { if (!dragging.current) return; dragging.current = false; commit(angleFromEvent(e)); }}
      onPointerCancel={() => { dragging.current = false; setDraft(Math.round(((value % 360) + 360) % 360)); }}
      onKeyDown={(e) => { if (disabled) return; const delta = e.shiftKey ? 15 : 1; if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); commit(draft + delta); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); commit(draft - delta); } else if (e.key === "Home") commit(0); }}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" className="pe-dial-track" /><circle cx="50" cy="50" r="29" className="pe-dial-inner" /><line x1="50" y1="50" x2="50" y2="16" className="pe-dial-hand" transform={`rotate(${draft} 50 50)`} /><circle cx="50" cy="16" r="5" className="pe-dial-knob" transform={`rotate(${draft} 50 50)`} /><circle cx="50" cy="50" r="3" className="pe-dial-center" /></svg>
    </div>
    <div className="pe-rotation-presets">{[0, 45, 90, 180, 270].map((n) => <button type="button" key={n} disabled={disabled} className={draft === n ? "is-active" : ""} onClick={() => commit(n)}>{n}°</button>)}</div>
  </div>;
}

function LayersPanel({ model, sel, a, t, locked }) {
  const [over, setOver] = React.useState(null);
  const touchDrag = React.useRef(null);
  if (!model) return null;
  const list = [...model.elements].reverse();
  const touchTargetIndex = (x, y) => {
    const target = document.elementFromPoint(x, y)?.closest("[data-layer-index]");
    const index = target ? Number(target.getAttribute("data-layer-index")) : NaN;
    return Number.isInteger(index) ? index : null;
  };
  const onGripPointerDown = (event, item, index) => {
    if (locked.has(item.id) || item.readOnlyGeometry || event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDrag.current = { id: item.id, pointerId: event.pointerId, targetIndex: index };
    setOver(index);
  };
  const onGripPointerMove = (event) => {
    const drag = touchDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const index = touchTargetIndex(event.clientX, event.clientY);
    if (index !== null) { drag.targetIndex = index; setOver(index); }
  };
  const onGripPointerUp = (event) => {
    const drag = touchDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    touchDrag.current = null;
    if (drag.id && drag.targetIndex !== null) a.moveLayer(drag.id, drag.targetIndex);
    setOver(null);
  };
  return <div className="pe-inspector" data-testid="pptx-layers-panel">
    <Section title={t("pptxEditor.section.layers")}>
      <div className="pe-layer-order-tools">
        <IconButton icon={BringToFront} text label={t("pptxEditor.toFront")} onClick={() => a.order("front")} disabled={!sel.some((item) => !locked.has(item.id) && !item.readOnlyGeometry)} testId="pptx-front" />
        <IconButton icon={SendToBack} text label={t("pptxEditor.toBack")} onClick={() => a.order("back")} disabled={!sel.some((item) => !locked.has(item.id) && !item.readOnlyGeometry)} testId="pptx-back" />
        <IconButton icon={ArrowUp} text label={t("pptxEditor.forward")} onClick={() => a.order("forward")} disabled={!sel.some((item) => !locked.has(item.id) && !item.readOnlyGeometry)} testId="pptx-forward" />
        <IconButton icon={ArrowDown} text label={t("pptxEditor.backward")} onClick={() => a.order("backward")} disabled={!sel.some((item) => !locked.has(item.id) && !item.readOnlyGeometry)} testId="pptx-backward" />
      </div>
      <p className="pe-note">{t("pptxEditor.layerHint")}</p>
      <ul className="pe-layers" data-testid="pptx-layers">
        {list.map((e, index) => {
          const I = kindIcon[e.kind] || Square;
          const isLocked = locked.has(e.id);
          const selected = sel.some((item) => item.id === e.id);
          return <li key={e.id} data-layer-index={index} data-dragging={touchDrag.current?.id === e.id ? "true" : undefined} className={`pe-layer-card ${selected ? "is-selected" : ""} ${e.hidden ? "is-hidden" : ""} ${isLocked ? "is-locked" : ""} ${over === index ? "is-over" : ""}`} draggable={!isLocked && !e.readOnlyGeometry}
            tabIndex={0} aria-label={`${t("pptxEditor.selectLayer")}: ${elementLabel(e, t)}`}
            onClick={(event) => { if (event.target.closest("button")) return; a.select([e.id]); }}
            onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); a.select([e.id]); } }}
            onDragStart={(event) => { if (isLocked || e.readOnlyGeometry) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", e.id); }}
            onDragOver={(event) => { event.preventDefault(); setOver(index); }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); if (id && id !== e.id) a.moveLayer(id, index); setOver(null); }}
            onDragEnd={() => setOver(null)}>
            <button type="button" className="pe-layer-grip-btn" disabled={isLocked || e.readOnlyGeometry} aria-label={t("pptxEditor.dragLayer")} title={t("pptxEditor.dragLayer")} onPointerDown={(event) => onGripPointerDown(event, e, index)} onPointerMove={onGripPointerMove} onPointerUp={onGripPointerUp} onPointerCancel={onGripPointerUp}><GripVertical size={16} aria-hidden="true" /></button>
            <button type="button" className={`pe-layer-select ${selected ? "is-active" : ""}`} onClick={() => a.select([e.id])} aria-label={`${t("pptxEditor.selectLayer")}: ${elementLabel(e, t)}`}>
              <span className="pe-layer-icon"><I size={16} aria-hidden="true" /></span>
              <span className="pe-layer-name">{elementLabel(e, t)}</span>
              <small>{t(`pptxEditor.kind.${e.kind}`)}</small>
            </button>
            <div className="pe-layer-actions">
              <IconButton icon={e.hidden ? EyeOff : Eye} label={e.hidden ? t("pptxEditor.showLayer") : t("pptxEditor.hideLayer")} active={e.hidden} onClick={() => a.setHidden(e.id, !e.hidden)} size={16} />
              <IconButton icon={isLocked ? Lock : Unlock} label={isLocked ? t("pptxEditor.unlock") : t("pptxEditor.lock")} active={isLocked} onClick={() => a.toggleLock([e.id])} size={16} />
            </div>
          </li>;
        })}
      </ul>
      {!list.length && <p className="pe-note">{t("pptxEditor.noLayers")}</p>}
    </Section>
  </div>;
}

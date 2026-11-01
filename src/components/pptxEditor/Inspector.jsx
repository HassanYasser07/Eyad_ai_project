import React from "react";
import {
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  BringToFront, SendToBack, ArrowUp, ArrowDown,
  Group, Ungroup, Copy, Trash2, Lock, Unlock, FlipHorizontal2, FlipVertical2,
  Type, Square, Table2, Minus, Eye, EyeOff, GripVertical, Image as ImageIcon, RotateCcw, RotateCw, MousePointer2,
} from "lucide-react";
import {
  ActionGrid, QuickAction, SubCard, PropertySection, EmptyCard, NudgePad, RotationHalfWheel, RangeControl,
  NumberField, Segmented, LayerCard, KitIconButton, ArrangeIcon, LayersIcon, SizeIcon, PropertiesIcon,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, normalizeAngle,
} from "@/components/editorKit";

const EMU_PT = 12700;
const kindIcon = { text: Type, shape: Square, image: ImageIcon, table: Table2, group: Square, line: Minus };

export function elementLabel(el, t) {
  const txt = el?.text?.plain?.find((s) => s.trim());
  if (txt) return txt.slice(0, 40);
  if (el?.kind === "table") return t("pptxEditor.kind.table");
  return el?.name || t(`pptxEditor.kind.${el?.kind || "shape"}`) || el?.kind || "Object";
}

export default function Inspector({ tab = "arrange", sel = [], model, a, t, locked = new Set() }) {
  if (tab === "layers") return <LayersPanel model={model} sel={sel} a={a} t={t} locked={locked} />;
  return <ArrangePanel sel={sel} model={model} a={a} t={t} locked={locked} />;
}

/** Stored rotation is 0–359°; the half-wheel works in −180…+180°. */
const toStoredRotation = (v) => ((Math.round(v) % 360) + 360) % 360;

function ArrangePanel({ sel, model, a, t, locked }) {
  const [step, setStep] = React.useState(1);
  const el = sel[0] || null;
  const multi = sel.length > 1;
  const ro = !el || sel.some((item) => item.readOnlyGeometry || locked.has(item.id));
  const hasEditable = sel.some((item) => !item.readOnlyGeometry && !locked.has(item.id));
  const editableCount = sel.filter((item) => !item.readOnlyGeometry && !locked.has(item.id)).length;
  const slideW = model?.size?.w ? model.size.w / EMU_PT : 960;
  const slideH = model?.size?.h ? model.size.h / EMU_PT : 540;
  const rotation = normalizeAngle(el?.rot || 0);
  const commitRotation = (v) => a.field({ rot: toStoredRotation(v) });
  const liveRotation = (v) => a.live.field({ rot: toStoredRotation(v) });
  const sizeMax = (value, slide) => Math.max(Math.round(slide), Math.ceil((value || 0) * 2));
  const noneEditable = !hasEditable;

  const alignItem = (key, icon, mode) => ({ key, icon, label: t(`pptxEditor.align.${mode}`), onClick: () => a.align(mode), disabled: noneEditable });

  return (
    <div className="pe-inspector" data-testid="pptx-arrange-panel">
      {!el && <EmptyCard icon={MousePointer2} title={t("pptxEditor.nothingSelected")}>{t("pptxEditor.selectHint")}</EmptyCard>}

      <PropertySection icon={ArrangeIcon} title={t("pptxEditor.section.arrange")}>
        {multi && <span className="ek-note-chip">{t("pptxEditor.multiSelected", { n: sel.length })}</span>}
        <NudgePad
          title={t("pptxEditor.preciseMove")}
          stepLabel={t("pptxEditor.moveStep")}
          step={step}
          onStepChange={setStep}
          unit="pt"
          disabled={ro}
          hint={t("pptxEditor.nudgeHint")}
          labels={{ up: t("pptxEditor.nudgeUp"), down: t("pptxEditor.nudgeDown"), left: t("pptxEditor.nudgeLeft"), right: t("pptxEditor.nudgeRight") }}
          testIds={{ up: "pptx-nudge-up", down: "pptx-nudge-down", left: "pptx-nudge-left", right: "pptx-nudge-right" }}
          onNudge={(dx, dy) => a.nudge(Math.round(dx * EMU_PT), Math.round(dy * EMU_PT))}
        />
        <SubCard className="ek-actions-card">
          <ActionGrid cols={3} label={t("pptxEditor.section.actions")}>
            <QuickAction icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} disabled={!hasEditable} testId="pptx-duplicate" />
            <QuickAction icon={Group} label={t("pptxEditor.group")} onClick={a.group} disabled={editableCount < 2} testId="pptx-group" />
            <QuickAction icon={Ungroup} label={t("pptxEditor.ungroup")} onClick={a.ungroup} disabled={!(el?.kind === "group" && !multi && !locked.has(el.id) && !el.readOnlyGeometry)} testId="pptx-ungroup" />
            <QuickAction icon={FlipHorizontal2} label={t("pptxEditor.flipH")} active={!!el?.flipH && !multi} onClick={() => (multi ? a.flipH() : a.field({ flipH: !el.flipH }))} disabled={ro} />
            <QuickAction icon={FlipVertical2} label={t("pptxEditor.flipV")} active={!!el?.flipV && !multi} onClick={() => (multi ? a.flipV() : a.field({ flipV: !el.flipV }))} disabled={ro} />
            <QuickAction icon={Trash2} label={t("pptxEditor.delete")} danger onClick={a.remove} disabled={!hasEditable} testId="pptx-delete" />
          </ActionGrid>
        </SubCard>
        <SubCard title={t("pptxEditor.section.align")}>
          <div className="pe-align-rows">
            <Segmented label={t("pptxEditor.section.align")} items={[
              alignItem("l", AlignStartVertical, "left"), alignItem("c", AlignCenterVertical, "center"), alignItem("r", AlignEndVertical, "right"),
            ]} />
            <Segmented label={t("pptxEditor.section.align")} items={[
              alignItem("t", AlignStartHorizontal, "top"), alignItem("m", AlignCenterHorizontal, "middle"), alignItem("b", AlignEndHorizontal, "bottom"),
            ]} />
          </div>
          <ActionGrid cols={2}>
            <QuickAction icon={AlignCenterVertical} label={t("pptxEditor.distributeH")} onClick={() => a.distribute("h")} disabled={sel.length < 3 || !hasEditable} />
            <QuickAction icon={AlignCenterHorizontal} label={t("pptxEditor.distributeV")} onClick={() => a.distribute("v")} disabled={sel.length < 3 || !hasEditable} />
            <QuickAction icon={MousePointer2} label={t("pptxEditor.selectBehind")} onClick={a.selectBehind} disabled={!el} wide />
          </ActionGrid>
        </SubCard>
      </PropertySection>

      {el && !multi && (
        <PropertySection icon={SizeIcon} title={t("pptxEditor.section.position")}>
          <fieldset className={`pe-disabled-control ${ro ? "is-disabled" : ""}`} disabled={ro} aria-disabled={ro || undefined}>
            <SubCard>
              <div className="pe-grid2">
                <NumberField label="X" suffix="pt" value={el.x / EMU_PT} testId="pptx-x" onLive={(v) => a.live.field({ x: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ x: v * EMU_PT })} />
                <NumberField label="Y" suffix="pt" value={el.y / EMU_PT} testId="pptx-y" onLive={(v) => a.live.field({ y: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ y: v * EMU_PT })} />
              </div>
            </SubCard>
            <SubCard title={t("pptxEditor.section.size")}>
              <RangeControl label={t("pptxEditor.scale")} value={100} min={10} max={300} step={1} suffix="%" integer editable snapBack disabled={ro} onLive={(pct) => a.live.scale(pct / 100)} onLiveCancel={a.live.cancel} onCommit={(pct) => a.scale?.(pct / 100)} />
              <RangeControl label={t("pptxEditor.width")} value={el.w / EMU_PT} min={1} max={sizeMax(el.w / EMU_PT, slideW)} step={1} decimals={1} suffix="pt" editable disabled={ro} inputTestId="pptx-w" onLive={(v) => a.live.field({ w: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ w: v * EMU_PT })} />
              <RangeControl label={t("pptxEditor.height")} value={el.h / EMU_PT} min={0} max={sizeMax(el.h / EMU_PT, slideH)} step={1} decimals={1} suffix="pt" editable disabled={ro} inputTestId="pptx-h" onLive={(v) => a.live.field({ h: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ h: v * EMU_PT })} />
            </SubCard>
          </fieldset>
        </PropertySection>
      )}

      {el && !multi && (
        <PropertySection icon={RotateCw} title={t("pptxEditor.section.rotation")}>
          <SubCard className="ek-rotation-card">
            <RotationHalfWheel value={rotation} disabled={ro} label={t("pptxEditor.rotation")} onCommit={commitRotation} onLive={liveRotation} />
            <div className="ek-rotation-fields">
              <NumberField label={t("pptxEditor.rotation")} value={rotation} min={-180} max={180} step={1} decimals={0} suffix="°" disabled={ro} onLive={liveRotation} onLiveCancel={a.live.cancel} onCommit={commitRotation} />
              <div className="ek-inline-actions">
                <QuickAction icon={RotateCcw} label={t("pptxEditor.resetRotation")} onClick={() => a.field({ rot: 0 })} disabled={ro || rotation === 0} />
                <QuickAction icon={RotateCw} label="+90°" onClick={() => a.rotate(90)} disabled={ro} />
                <QuickAction icon={RotateCcw} label="−90°" onClick={() => a.rotate(-90)} disabled={ro} />
              </div>
            </div>
          </SubCard>
        </PropertySection>
      )}
    </div>
  );
}

function LayersPanel({ model, sel, a, t, locked }) {
  const [over, setOver] = React.useState(null);
  const touchDrag = React.useRef(null);
  if (!model) return null;
  const list = [...model.elements].reverse();
  const canOrder = sel.some((item) => !locked.has(item.id) && !item.readOnlyGeometry);
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
  return (
    <div className="pe-inspector" data-testid="pptx-layers-panel">
      <PropertySection icon={LayersIcon} title={t("pptxEditor.section.layers")}>
        <SubCard title={t("pptxEditor.section.order")}>
          <ActionGrid cols={2}>
            <QuickAction icon={BringToFront} label={t("pptxEditor.toFront")} onClick={() => a.order("front")} disabled={!canOrder} testId="pptx-front" />
            <QuickAction icon={SendToBack} label={t("pptxEditor.toBack")} onClick={() => a.order("back")} disabled={!canOrder} testId="pptx-back" />
            <QuickAction icon={ArrowUp} label={t("pptxEditor.forward")} onClick={() => a.order("forward")} disabled={!canOrder} testId="pptx-forward" />
            <QuickAction icon={ArrowDown} label={t("pptxEditor.backward")} onClick={() => a.order("backward")} disabled={!canOrder} testId="pptx-backward" />
          </ActionGrid>
        </SubCard>
        <p className="ek-note">{t("pptxEditor.layerHint")}</p>
        <ul className="ek-layer-list pe-layers" data-testid="pptx-layers">
          {list.map((e, index) => {
            const I = kindIcon[e.kind] || Square;
            const isLocked = locked.has(e.id);
            const noDrag = isLocked || e.readOnlyGeometry;
            const selected = sel.some((item) => item.id === e.id);
            const label = `${t("pptxEditor.selectLayer")}: ${elementLabel(e, t)}`;
            return (
              <LayerCard
                key={e.id}
                dataLayerIndex={index}
                dragAttr={touchDrag.current?.id === e.id ? "true" : undefined}
                selected={selected}
                hidden={e.hidden}
                locked={isLocked}
                over={over === index}
                draggable={!noDrag}
                ariaLabel={label}
                title={elementLabel(e, t)}
                subtitle={t(`pptxEditor.kind.${e.kind}`)}
                thumbKind={e.kind}
                thumb={<I size={17} strokeWidth={1.7} aria-hidden="true" />}
                onSelect={() => a.select([e.id])}
                onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); a.select([e.id]); } }}
                onDragStart={(event) => { if (noDrag) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", e.id); }}
                onDragOver={(event) => { event.preventDefault(); setOver(index); }}
                onDragLeave={() => setOver(null)}
                onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); if (id && id !== e.id) a.moveLayer(id, index); setOver(null); }}
                onDragEnd={() => setOver(null)}
                grip={
                  <button type="button" className="ek-layer-grip" disabled={noDrag} aria-label={t("pptxEditor.dragLayer")} title={t("pptxEditor.dragLayer")}
                    onPointerDown={(event) => onGripPointerDown(event, e, index)} onPointerMove={onGripPointerMove} onPointerUp={onGripPointerUp} onPointerCancel={onGripPointerUp}>
                    <GripVertical size={16} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                }
                actions={
                  <>
                    <KitIconButton className="pe-layer-btn" icon={e.hidden ? EyeOff : Eye} label={e.hidden ? t("pptxEditor.showLayer") : t("pptxEditor.hideLayer")} active={e.hidden} onClick={() => a.setHidden(e.id, !e.hidden)} size={16} />
                    <KitIconButton className="pe-layer-btn" icon={isLocked ? Lock : Unlock} label={isLocked ? t("pptxEditor.unlock") : t("pptxEditor.lock")} active={isLocked} onClick={() => a.toggleLock([e.id])} size={16} />
                  </>
                }
              />
            );
          })}
        </ul>
        {!list.length && <EmptyCard icon={PropertiesIcon}>{t("pptxEditor.noLayers")}</EmptyCard>}
      </PropertySection>
    </div>
  );
}

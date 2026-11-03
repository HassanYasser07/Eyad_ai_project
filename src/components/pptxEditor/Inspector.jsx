import React from "react";
import {
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Group, Ungroup, Copy, Trash2, FlipHorizontal2, FlipVertical2,
  Scissors, ClipboardCopy, ClipboardPaste, RotateCcw, RotateCw, MousePointer2, SlidersHorizontal, Maximize2, Pencil,
} from "lucide-react";
import {
  ActionGrid, QuickAction, SubCard, PropertySection, EmptyCard, NudgePad, RotationHalfWheel, RangeControl,
  NumberField, Segmented,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, normalizeAngle,
} from "@/components/editorKit";
import { PptxLayerList, elementLabel } from "./PptxLayersPanel.jsx";

const EMU_PT = 12700;
export { elementLabel };

/**
 * Properties panel of the presentation editor. It is laid out exactly like the SVG editor's panel:
 *
 *   ARRANGE  precise move + (duplicate / group-ungroup / flip / delete) stacked in one column, then rotation
 *            (+ the presentation-only extras: align / distribute / select behind)
 *   SIZE     scale, width + height (+ the presentation-only exact position X / Y)
 *
 * `section` decides what is rendered: "all" (desktop sidebar), "arrange" or "size" (the two phone sheets,
 * which mirror the SVG editor's "Arrange" and "Size" tabs).
 */
export default function Inspector({ tab = "arrange", section = "all", sel = [], model, a, t, locked = new Set(), pkg, labels, clip }) {
  if (tab === "layers") return <div className="pe-inspector pe-inspector-layers" data-testid="pptx-layers-panel"><PptxLayerList pkg={pkg} model={model} sel={sel} locked={locked} a={a} t={t} labels={labels} /></div>;
  return <ArrangePanel section={section} sel={sel} model={model} a={a} t={t} locked={locked} clip={clip} />;
}

/** Stored rotation is 0–359°; the half-wheel works in −180…+180°. */
const toStoredRotation = (v) => ((Math.round(v) % 360) + 360) % 360;

/** Cut / Copy / Paste. Phone sheet: three buttons stacked in a column; desktop sidebar: one row like the other action cards. */
function ClipboardCard({ clip, t, stacked, onEditText, editDisabled }) {
  if (!clip) return null;
  return (
    <SubCard className={`pe-clip-card ${stacked ? "is-stacked" : ""}`} title={stacked ? undefined : t("pptxEditor.ribbon.group.clipboard")}>
      <ActionGrid cols={3} label={t("pptxEditor.ribbon.group.clipboard")} className="pe-clip-grid">
        {onEditText && (
          <button type="button" className="ek-action is-accent" onClick={onEditText} disabled={editDisabled} data-testid="pptx-edit-text">
            <Pencil size={14} strokeWidth={1.7} aria-hidden="true" /><span>{t("pptxEditor.editText")}</span>
          </button>
        )}
        <QuickAction icon={Scissors} label={t("pptxEditor.cut")} onClick={clip.cut} disabled={!clip.hasSelection} testId="pptx-clip-cut" />
        <QuickAction icon={ClipboardCopy} label={t("pptxEditor.copy")} onClick={clip.copy} disabled={!clip.hasSelection} testId="pptx-clip-copy" />
        <QuickAction icon={ClipboardPaste} label={t("pptxEditor.paste")} onClick={clip.paste} disabled={!clip.canPaste} testId="pptx-clip-paste" />
      </ActionGrid>
    </SubCard>
  );
}

function ArrangePanel({ section, sel, model, a, t, locked, clip }) {
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
  const showArrange = section !== "size";
  const showSize = section !== "arrange";
  const isGroup = el?.kind === "group" && !multi;
  const canUngroup = isGroup && !locked.has(el.id) && !el.readOnlyGeometry;
  // "Edit text" is the first card of the phone Arrange sheet (same as the SVG editor); it needs one text-bearing item.
  const canEditText = section === "arrange" && !!el && !multi && el.kind !== "table" && (el.kind === "text" || el.kind === "shape" || !!el.text);
  const testId = section === "size" ? "pptx-size-panel" : "pptx-arrange-panel";

  const alignItem = (key, icon, mode) => ({ key, icon, label: t(`pptxEditor.align.${mode}`), onClick: () => a.align(mode), disabled: noneEditable });

  // Nothing selected: one soft card, same as the SVG editor (the controls need a target).
  if (!el) {
    return (
      <div className={`pe-inspector pe-inspector-${section}`} data-testid={testId}>
        {showArrange && <ClipboardCard clip={clip} t={t} stacked={section === "arrange"} />}
        <EmptyCard className="pe-arr-empty" icon={MousePointer2} title={t("pptxEditor.nothingSelected")}>{t("pptxEditor.selectHint")}</EmptyCard>
      </div>
    );
  }

  return (
    <div className={`pe-inspector pe-inspector-${section}`} data-testid={testId}>
      {showArrange && (
        <PropertySection icon={SlidersHorizontal} title={t("pptxEditor.section.arrange")} className="pe-section-arrange" testId="pptx-section-arrange">
          <ClipboardCard clip={clip} t={t} stacked={section === "arrange"} onEditText={canEditText ? a.editText : undefined} editDisabled={ro} />

          {multi && <span className="ek-note-chip">{t("pptxEditor.multiSelected", { n: sel.length })}</span>}

          {/* precise move, then (directly underneath) duplicate / group / flip / delete */}
          <div className="ek-arrange-stack">
            <NudgePad
              title={t("pptxEditor.preciseMove")}
              stepLabel={t("pptxEditor.moveStep")}
              step={step}
              onStepChange={setStep}
              unit="pt"
              className="pe-arr-nudge"
              disabled={ro}
              labels={{ up: t("pptxEditor.nudgeUp"), down: t("pptxEditor.nudgeDown"), left: t("pptxEditor.nudgeLeft"), right: t("pptxEditor.nudgeRight") }}
              testIds={{ up: "pptx-nudge-up", down: "pptx-nudge-down", left: "pptx-nudge-left", right: "pptx-nudge-right" }}
              onNudge={(dx, dy) => a.nudge(Math.round(dx * EMU_PT), Math.round(dy * EMU_PT))}
            />
            <SubCard className="ek-actions-card pe-arr-actions">
              <ActionGrid cols={3} label={t("pptxEditor.section.actions")}>
                <QuickAction icon={Copy} label={t("pptxEditor.duplicate")} onClick={a.duplicate} disabled={!hasEditable} testId="pptx-duplicate" />
                {isGroup
                  ? <QuickAction icon={Ungroup} label={t("pptxEditor.ungroup")} onClick={a.ungroup} disabled={!canUngroup} testId="pptx-ungroup" />
                  : <QuickAction icon={Group} label={t("pptxEditor.group")} onClick={a.group} disabled={editableCount < 2} testId="pptx-group" />}
                <QuickAction icon={FlipHorizontal2} label={t("pptxEditor.flipH")} active={!!el.flipH && !multi} onClick={() => (multi ? a.flipH() : a.field({ flipH: !el.flipH }))} disabled={ro} testId="pptx-flip-h" />
                <QuickAction icon={FlipVertical2} label={t("pptxEditor.flipV")} active={!!el.flipV && !multi} onClick={() => (multi ? a.flipV() : a.field({ flipV: !el.flipV }))} disabled={ro} testId="pptx-flip-v" />
                <QuickAction icon={Trash2} label={t("pptxEditor.delete")} danger onClick={a.remove} disabled={!hasEditable} testId="pptx-delete" />
              </ActionGrid>
            </SubCard>
          </div>

          {!multi && (
            <SubCard title={t("pptxEditor.section.rotation")} icon={RotateCw} className="ek-rotation-card pe-arr-rot">
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
          )}

          {/* presentation-only extras, in the same card style */}
          <SubCard title={t("pptxEditor.section.align")} className="pe-arr-align">
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
      )}

      {/* SIZE — scale, then width + height, then (presentation-only) the exact position */}
      {showSize && !multi && (
        <PropertySection icon={Maximize2} title={t("pptxEditor.section.size")} className="pe-section-size" testId="pptx-section-size">
          <SubCard className="ek-scale-card pe-arr-scale">
            <RangeControl key={`scale-${el.id}`} label={t("pptxEditor.scale")} value={100} min={10} max={300} step={1} suffix="%" integer editable snapBack disabled={ro} onLive={(pct) => a.live.scale(pct / 100)} onLiveCancel={a.live.cancel} onCommit={(pct) => a.scale?.(pct / 100)} />
          </SubCard>
          <SubCard className="ek-size-card pe-arr-size">
            <RangeControl label={t("pptxEditor.width")} value={el.w / EMU_PT} min={1} max={sizeMax(el.w / EMU_PT, slideW)} step={1} integer suffix="pt" editable disabled={ro} inputTestId="pptx-w" onLive={(v) => a.live.field({ w: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ w: v * EMU_PT })} />
            <RangeControl label={t("pptxEditor.height")} value={el.h / EMU_PT} min={0} max={sizeMax(el.h / EMU_PT, slideH)} step={1} integer suffix="pt" editable disabled={ro} inputTestId="pptx-h" onLive={(v) => a.live.field({ h: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ h: v * EMU_PT })} />
          </SubCard>
          <SubCard title={t("pptxEditor.section.position")} className="pe-arr-xy">
            <div className="pe-grid2">
              <NumberField label="X" suffix="pt" value={el.x / EMU_PT} disabled={ro} testId="pptx-x" onLive={(v) => a.live.field({ x: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ x: v * EMU_PT })} />
              <NumberField label="Y" suffix="pt" value={el.y / EMU_PT} disabled={ro} testId="pptx-y" onLive={(v) => a.live.field({ y: v * EMU_PT })} onLiveCancel={a.live.cancel} onCommit={(v) => a.field({ y: v * EMU_PT })} />
            </div>
          </SubCard>
        </PropertySection>
      )}
      {showSize && multi && (
        <EmptyCard className="pe-arr-empty" icon={MousePointer2} title={t("pptxEditor.multiSelected", { n: sel.length })}>{t("pptxEditor.sizeSingleHint")}</EmptyCard>
      )}
    </div>
  );
}

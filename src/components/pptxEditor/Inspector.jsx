import React from "react";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, BringToFront, SendToBack, ArrowUp, ArrowDown,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  Group, Ungroup, Copy, Trash2, Lock, Unlock, FlipHorizontal2, FlipVertical2, ImagePlus, Layers, Plus, Minus, Type, Square, Image as ImageIcon, Table2, MousePointerClick,
} from "lucide-react";
import { IconButton, ColorField, NumberField, SliderField, Section } from "./Controls.jsx";

const FONTS = ["Calibri", "Arial", "Verdana", "Georgia", "Times New Roman", "Courier New", "Plus Jakarta Sans", "Inter", "Roboto", "Montserrat", "Poppins", "Cairo", "Tajawal", "Almarai"];
const EMU_PT = 12700;
const kindIcon = { text: Type, shape: Square, image: ImageIcon, table: Table2, group: Layers, line: Minus };

const firstStyle = (el) => el?.text?.paragraphs?.find((p) => p.runs.length)?.runs[0]?.style || el?.text?.paragraphs?.[0]?.end || null;
export function elementLabel(el, t) {
  const txt = el.text?.plain?.find((s) => s.trim());
  if (txt) return txt.slice(0, 40);
  if (el.kind === "table") return t("pptxEditor.kind.table");
  return el.name || t(`pptxEditor.kind.${el.kind}`) || el.kind;
}

export default function Inspector({ tab = "all", sel, model, a, t, locked }) {
  const el = sel[0] || null;
  const multi = sel.length > 1;
  const themeColors = model ? ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dk2", "lt2"].map((k) => model.theme.colors[k]) : [];
  const st = firstStyle(el);
  const canText = !!el && !multi && (el.text || el.kind === "table");
  const canFill = !!el && sel.every((e) => ["shape", "text"].includes(e.kind) && e.geom?.kind !== "line");
  const canLine = !!el && sel.every((e) => ["shape", "text", "line", "image"].includes(e.kind));
  const canOpacity = !!el && sel.every((e) => ["shape", "text", "image"].includes(e.kind));
  const ro = !!el && sel.some((e) => e.readOnlyGeometry);
  const isLocked = !!el && sel.some((e) => locked.has(e.id));
  const show = (name) => tab === "all" || tab === name;

  if (!el) {
    return (
      <div className="pe-empty" data-testid="pptx-inspector-empty">
        <MousePointerClick size={28} aria-hidden="true" />
        <p>{t("pptxEditor.selectHint")}</p>
        {show("layers") && <Layers_ model={model} sel={sel} a={a} t={t} />}
      </div>
    );
  }
  return (
    <div className="pe-inspector" data-testid="pptx-inspector">
      {multi && <p className="pe-note">{t("pptxEditor.multiSelected", { n: sel.length })}</p>}

      {show("format") && (canFill || canLine || canOpacity) && (
        <Section title={t("pptxEditor.section.appearance")}>
          {canFill && (
            <div className="pe-row">
              <ColorField label={t("pptxEditor.fill")} value={el.fill?.type === "solid" ? el.fill.hex : null} themeColors={themeColors} noneLabel={t("pptxEditor.noFill")} testId="pptx-fill" onChange={(hex) => a.shape({ fill: { hex } })} onNone={() => a.shape({ fill: { none: true } })} />
            </div>
          )}
          {canLine && (
            <div className="pe-row">
              <ColorField label={t("pptxEditor.line")} value={el.line && !el.line.none ? el.line.hex : null} themeColors={themeColors} noneLabel={t("pptxEditor.noLine")} testId="pptx-line" onChange={(hex) => a.shape({ line: { hex, w: el.line?.w || 12700 } })} onNone={() => a.shape({ line: { none: true } })} />
              <NumberField label={t("pptxEditor.width")} suffix="pt" value={(el.line?.w ?? 12700) / EMU_PT} min={0} max={50} step={0.5} onCommit={(v) => a.shape({ line: v === 0 ? { none: true } : { w: v * EMU_PT, hex: el.line?.hex || "000000" } })} />
            </div>
          )}
          {canOpacity && <SliderField label={t("pptxEditor.opacity")} value={Math.round(((el.kind === "image" ? el.opacity : el.fill?.alpha) ?? 1) * 100)} testId="pptx-opacity" onCommit={(v) => a.opacity(v / 100)} />}
        </Section>
      )}

      {show("text") && canText && (
        <Section title={t("pptxEditor.section.text")}>
          {el.kind !== "table" && <button type="button" className="pe-wide" onClick={a.editText} data-testid="pptx-edit-text"><Type size={16} aria-hidden="true" />{t("pptxEditor.editText")}</button>}
          <div className="pe-row">
            <select className="pe-select" aria-label={t("pptxEditor.font")} value={FONTS.includes(st?.font) ? st.font : ""} onChange={(e) => a.text({ font: e.target.value })} data-testid="pptx-font">
              {!FONTS.includes(st?.font) && <option value="">{st?.font || "—"}</option>}
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <NumberField label={t("pptxEditor.size")} suffix="pt" value={st?.size ?? 18} min={1} max={400} step={1} decimals={0} testId="pptx-size" onCommit={(v) => a.text({ size: v })} />
          </div>
          <div className="pe-row pe-tools">
            <IconButton icon={Bold} label={t("pptxEditor.bold")} active={!!st?.bold} onClick={() => a.text({ bold: !st?.bold })} testId="pptx-bold" />
            <IconButton icon={Italic} label={t("pptxEditor.italic")} active={!!st?.italic} onClick={() => a.text({ italic: !st?.italic })} testId="pptx-italic" />
            <IconButton icon={Underline} label={t("pptxEditor.underline")} active={!!st?.underline} onClick={() => a.text({ underline: !st?.underline })} />
            <ColorField label={t("pptxEditor.textColor")} value={st?.color?.hex} themeColors={themeColors} testId="pptx-textcolor" onChange={(hex) => a.text({ color: hex })} />
          </div>
          <div className="pe-row pe-tools">
            {[["l", AlignLeft, "alignLeft"], ["ctr", AlignCenter, "alignCenter"], ["r", AlignRight, "alignRight"], ["just", AlignJustify, "alignJustify"]].map(([v, I, k]) => (
              <IconButton key={v} icon={I} label={t(`pptxEditor.${k}`)} active={el.text?.paragraphs?.[0]?.algn === v} onClick={() => a.text({ align: v })} testId={`pptx-align-${v}`} />
            ))}
            <IconButton icon={List} label={t("pptxEditor.bullets")} active={el.text?.paragraphs?.[0]?.bullet?.kind !== "none" && !!el.text} onClick={() => a.text({ bullet: el.text?.paragraphs?.[0]?.bullet?.kind === "none" })} />
          </div>
          {el.kind !== "table" && (
            <div className="pe-row">
              <label className="pe-sel"><span>{t("pptxEditor.lineSpacing")}</span>
                <select className="pe-select" value="" onChange={(e) => e.target.value && a.text({ lineSpacing: Number(e.target.value) })}>
                  <option value="">—</option>{[1, 1.15, 1.5, 2].map((v) => <option key={v} value={v}>{v}</option>)}
                </select></label>
              <label className="pe-sel"><span>{t("pptxEditor.anchor")}</span>
                <select className="pe-select" value={el.text?.body?.anchor || "t"} onChange={(e) => a.text({ anchor: e.target.value })}>
                  <option value="t">{t("pptxEditor.top")}</option><option value="ctr">{t("pptxEditor.middle")}</option><option value="b">{t("pptxEditor.bottom")}</option>
                </select></label>
              <label className="pe-sel"><span>{t("pptxEditor.fit")}</span>
                <select className="pe-select" value={el.text?.body?.autofit?.type || "none"} onChange={(e) => a.text({ autofit: e.target.value })}>
                  <option value="none">{t("pptxEditor.fitNone")}</option><option value="shrink">{t("pptxEditor.fitShrink")}</option><option value="resize">{t("pptxEditor.fitResize")}</option>
                </select></label>
            </div>
          )}
        </Section>
      )}

      {show("format") && el.kind === "table" && !multi && <TableEditor el={el} a={a} t={t} />}

      {show("format") && el.kind === "image" && !multi && (
        <Section title={t("pptxEditor.section.image")}>
          <button type="button" className="pe-wide" onClick={a.replaceImage} data-testid="pptx-replace-image"><ImagePlus size={16} aria-hidden="true" />{t("pptxEditor.replaceImage")}</button>
          <label className="pe-alt"><span>{t("pptxEditor.altText")}</span><input className="pe-input" defaultValue={el.alt} key={el.id + el.alt} onBlur={(e) => e.target.value !== el.alt && a.alt(e.target.value)} /></label>
        </Section>
      )}

      {show("arrange") && !multi && (
        <Section title={t("pptxEditor.section.position")}>
          <div className="pe-grid2">
            <NumberField label="X" suffix="pt" value={el.x / EMU_PT} testId="pptx-x" onCommit={(v) => a.field({ x: v * EMU_PT })} />
            <NumberField label="Y" suffix="pt" value={el.y / EMU_PT} testId="pptx-y" onCommit={(v) => a.field({ y: v * EMU_PT })} />
            <NumberField label="W" suffix="pt" value={el.w / EMU_PT} min={1} testId="pptx-w" onCommit={(v) => a.field({ w: v * EMU_PT })} />
            <NumberField label="H" suffix="pt" value={el.h / EMU_PT} min={0} testId="pptx-h" onCommit={(v) => a.field({ h: v * EMU_PT })} />
            <NumberField label={t("pptxEditor.rotation")} suffix="°" value={el.rot} min={0} max={360} decimals={0} testId="pptx-rot" onCommit={(v) => a.field({ rot: v })} />
            <div className="pe-row pe-tools">
              <IconButton icon={FlipHorizontal2} label={t("pptxEditor.flipH")} active={el.flipH} onClick={() => a.field({ flipH: !el.flipH })} disabled={ro} />
              <IconButton icon={FlipVertical2} label={t("pptxEditor.flipV")} active={el.flipV} onClick={() => a.field({ flipV: !el.flipV })} disabled={ro} />
            </div>
          </div>
        </Section>
      )}

      {show("arrange") && (
        <Section title={t("pptxEditor.section.arrange")}>
          <div className="pe-row pe-tools">
            <IconButton icon={BringToFront} label={t("pptxEditor.toFront")} onClick={() => a.order("front")} testId="pptx-front" />
            <IconButton icon={ArrowUp} label={t("pptxEditor.forward")} onClick={() => a.order("forward")} testId="pptx-forward" />
            <IconButton icon={ArrowDown} label={t("pptxEditor.backward")} onClick={() => a.order("backward")} testId="pptx-backward" />
            <IconButton icon={SendToBack} label={t("pptxEditor.toBack")} onClick={() => a.order("back")} testId="pptx-back" />
          </div>
          <div className="pe-row pe-tools">
            {[["left", AlignStartVertical], ["center", AlignCenterVertical], ["right", AlignEndVertical], ["top", AlignStartHorizontal], ["middle", AlignCenterHorizontal], ["bottom", AlignEndHorizontal]].map(([m, I]) => (
              <IconButton key={m} icon={I} label={t(`pptxEditor.align.${m}`)} onClick={() => a.align(m)} testId={`pptx-al-${m}`} />
            ))}
          </div>
          <div className="pe-row pe-tools">
            <IconButton icon={AlignCenterVertical} label={t("pptxEditor.distributeH")} text onClick={() => a.distribute("h")} disabled={sel.length < 3} />
            <IconButton icon={AlignCenterHorizontal} label={t("pptxEditor.distributeV")} text onClick={() => a.distribute("v")} disabled={sel.length < 3} />
          </div>
          <div className="pe-row pe-tools">
            <IconButton icon={Group} label={t("pptxEditor.group")} text onClick={a.group} disabled={sel.length < 2} testId="pptx-group" />
            <IconButton icon={Ungroup} label={t("pptxEditor.ungroup")} text onClick={a.ungroup} disabled={!(el.kind === "group" && !multi)} testId="pptx-ungroup" />
          </div>
          <div className="pe-row pe-tools">
            <IconButton icon={Copy} label={t("pptxEditor.duplicate")} text onClick={a.duplicate} testId="pptx-duplicate" />
            <IconButton icon={isLocked ? Unlock : Lock} label={isLocked ? t("pptxEditor.unlock") : t("pptxEditor.lock")} text onClick={a.toggleLock} active={isLocked} testId="pptx-lock" />
            <IconButton icon={Trash2} label={t("pptxEditor.delete")} text danger onClick={a.remove} testId="pptx-delete" />
          </div>
          <button type="button" className="pe-wide" onClick={a.selectBehind} data-testid="pptx-select-behind"><Layers size={16} aria-hidden="true" />{t("pptxEditor.selectBehind")}</button>
        </Section>
      )}
      {show("layers") && <Layers_ model={model} sel={sel} a={a} t={t} />}
    </div>
  );
}

function Layers_({ model, sel, a, t }) {
  if (!model) return null;
  const list = [...model.elements].reverse();
  return (
    <Section title={t("pptxEditor.section.layers")}>
      <ul className="pe-layers" data-testid="pptx-layers">
        {list.map((e) => {
          const I = kindIcon[e.kind] || Square;
          return (
            <li key={e.id}>
              <button type="button" className={sel.some((s) => s.id === e.id) ? "is-active" : ""} onClick={() => a.select([e.id])} disabled={e.hidden}>
                <I size={15} aria-hidden="true" /><span>{elementLabel(e, t)}</span>{e.hidden && <em>{t("pptxEditor.hidden")}</em>}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function TableEditor({ el, a, t }) {
  const tb = el.table;
  if (!tb) return null;
  return (
    <Section title={t("pptxEditor.section.table")}>
      <div className="pe-table-wrap" data-testid="pptx-table-editor">
        <table>
          <tbody>
            {tb.rows.map((r, ri) => (
              <tr key={ri}>
                {r.cells.map((c, ci) => (
                  <td key={ci}>
                    <input className="pe-input" defaultValue={c.text?.plain?.join("\n") || ""} key={`${el.id}-${ri}-${ci}-${c.text?.plain?.join("|")}`} aria-label={`${ri + 1},${ci + 1}`}
                      disabled={c.hMerge || c.vMerge}
                      onBlur={(e) => { const v = e.target.value; if (v !== (c.text?.plain?.join("\n") || "")) a.cell(ri, ci, v.split("\n")); }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tb.hasMerge && <p className="pe-note">{t("pptxEditor.tableMerged")}</p>}
      <div className="pe-row pe-tools">
        <IconButton icon={Plus} label={t("pptxEditor.addRow")} text disabled={tb.hasMerge} onClick={() => a.tableRows("add", tb.rows.length - 1)} testId="pptx-add-row" />
        <IconButton icon={Minus} label={t("pptxEditor.delRow")} text disabled={tb.hasMerge || tb.rows.length < 2} onClick={() => a.tableRows("delete", tb.rows.length - 1)} />
      </div>
      <div className="pe-row pe-tools">
        <IconButton icon={Plus} label={t("pptxEditor.addCol")} text disabled={tb.hasMerge} onClick={() => a.tableCols("add", tb.cols.length - 1)} />
        <IconButton icon={Minus} label={t("pptxEditor.delCol")} text disabled={tb.hasMerge || tb.cols.length < 2} onClick={() => a.tableCols("delete", tb.cols.length - 1)} />
      </div>
    </Section>
  );
}

import React from "react";
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, Type, MoveHorizontal,
  Blend, Baseline, Highlighter, PaintBucket, Square, Table2, Paintbrush,
} from "lucide-react";
import {
  RangeControl, Segmented, SelectField, SwitchRow, ColorPickerCard, ColorSwatches, COLOR_PRESETS,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, hexToCss, cssToHex,
} from "@/components/editorKit";
import { PPTX_FONTS, fontSelectOptions } from "./fonts.js";
import typographyArt from "@/components/svgEditor/icons/typography.svg";
import colorsArt from "@/components/svgEditor/icons/colors.svg";
import appearanceArt from "@/components/svgEditor/icons/appearance.svg";
import paragraphArt from "./icons/paragraph.svg";
import actionsArt from "./icons/actions.svg";
import tableScopeArt from "./icons/tableSelectionScope.svg";
import tableDesignArt from "./icons/tableDesign.svg";
import tableArt from "./icons/table.svg";

/*
 * Text + table formatting panels for the presentation editor.
 *
 * They reproduce the SVG editor's "Typography / Colors / Appearance" context bar: titled group cards,
 * two-row stacks, wave sliders with a typed value, segmented icon buttons and a quick colour palette.
 * The same cards are used in the desktop ribbon and in the phone bottom sheet (a swipeable card strip),
 * and the text box and the table cell share one implementation, so both always offer the same options.
 *
 * Every handler receives the same prop objects that `setTextProps` / `setTableRangeTextProps` understand:
 *   { size, bold, italic, underline, strike, font, color, highlight, opacity, spacing, baseline, outline,
 *     align, anchor, bullet, lineSpacing }
 * `onLive(props)` previews a value while a slider / colour is being dragged (no document write),
 * `onText(props)` commits it (one undo step).
 */

// Same fonts as the SVG editor (see ./fonts.js); the stored value is the plain family name.
export const FONTS = PPTX_FONTS;

const iconProps = (size, strokeWidth) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" });
function SuperscriptIcon({ size = 16, strokeWidth = 1.7 }) {
  return <svg {...iconProps(size, strokeWidth)}><path d="m4 19 8-8" /><path d="m12 19-8-8" /><path d="M16 9.5c0-1.1.9-1.8 2-1.8s2 .7 2 1.8c0 1.4-4 2.2-4 4.2h4" /></svg>;
}
function SubscriptIcon({ size = 16, strokeWidth = 1.7 }) {
  return <svg {...iconProps(size, strokeWidth)}><path d="m4 5 8 8" /><path d="m12 5-8 8" /><path d="M16 15.5c0-1.1.9-1.8 2-1.8s2 .7 2 1.8c0 1.4-4 2.2-4 4.2h4" /></svg>;
}

/** Titled card. `art` is one of the SVG editor's illustrations, otherwise `icon` sits in a soft badge. */
export function TpGroup({ id, title, art, icon: Icon, children, className = "", idle = false }) {
  return (
    <div className={`pe-tp-group ${idle ? "is-idle" : ""} ${className}`.trim()} data-group={id}>
      <span className="pe-tp-title" title={title}>
        {art ? <img className="pe-tp-title-art" src={art} alt="" draggable="false" /> : <span className="pe-tp-title-icon">{Icon && <Icon size={19} strokeWidth={1.7} aria-hidden="true" />}</span>}
        <em>{title}</em>
      </span>
      {children}
    </div>
  );
}
export const TpStack = ({ children, className = "" }) => <div className={`pe-tp-stack ${className}`.trim()}>{children}</div>;
export const TpRow = ({ children, className = "" }) => <div className={`pe-tp-row ${className}`.trim()}>{children}</div>;

/** Icon-over-label action button used by the "Actions" / "Table" cards. */
export function TpAction({ icon: Icon, label, title, onClick, disabled = false, danger = false, active, testId }) {
  return (
    <button type="button" className={`pe-tp-action ${danger ? "is-danger" : ""} ${active ? "is-active" : ""}`.trim()} onClick={onClick} disabled={disabled}
      title={title || label} aria-label={title || label} aria-pressed={active === undefined ? undefined : !!active} data-testid={testId}>
      {Icon && <Icon size={17} strokeWidth={1.7} aria-hidden="true" />}<span>{label}</span>
    </button>
  );
}
export function TpActionGrid({ children, cols = 3 }) {
  return <div className="pe-tp-actions" style={{ "--tp-cols": cols }} role="group">{children}</div>;
}

const dedupe = (list) => { const seen = new Set(); return list.filter((c) => { const k = String(c).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };

/**
 * Typography · Paragraph · Colors · Appearance cards.
 *   mode "text"  – a text box / shape with text (adds bullets and the Actions card).
 *   mode "table" – the picked table cell / row / column / whole table (adds the cell-fill colour target).
 */
export function TextFormatGroups({
  t, mode = "text", disabled = false, style, paragraph, anchor, bulletsOn = false, themeColors = [],
  fill, fillDisabled = false, onText, onLive, onLiveCancel, onFill, onLiveFill, actions, actionsIcon, testIds = {},
}) {
  const [target, setTarget] = React.useState("text");
  const off = disabled;
  const st = style || {};
  const textHex = String(st.color?.hex || "000000").replace(/^#/, "").toUpperCase();
  const opacityPct = Math.round((st.color?.alpha ?? 1) * 100);
  const size = Number(st.size) || (mode === "table" ? 14 : 18);
  const spacing = Number(st.spacing) || 0;
  const baseline = Number(st.baseline) || 0;
  const outline = st.outline || null;
  const algn = paragraph?.algn || "l";
  const lineSpacingPct = Math.round((paragraph?.lnSpc?.pct ?? 1) * 100);
  const font = st.font || "Arial";
  const fontOptions = fontSelectOptions(font, t);
  const live = (props) => onLive?.(props);
  const live1 = onLive ? live : undefined;

  const toggle = (key, icon, label, testId) => ({ key, icon, label, testId, disabled: off, active: !!st[key], onClick: () => onText({ [key]: !st[key] }) });
  const alignItems = [["l", AlignLeft, "alignLeft"], ["ctr", AlignCenter, "alignCenter"], ["r", AlignRight, "alignRight"], ["just", AlignJustify, "alignJustify"]]
    .map(([value, Icon, key]) => ({ key: value, icon: Icon, label: t(`pptxEditor.${key}`), disabled: off, active: algn === value, onClick: () => onText({ align: value }) }));
  const anchorItems = [["t", AlignStartHorizontal, "top"], ["ctr", AlignCenterHorizontal, "middle"], ["b", AlignEndHorizontal, "bottom"]]
    .map(([value, Icon, key]) => ({ key: value, icon: Icon, label: t(`pptxEditor.${key}`), disabled: off, active: anchor === value, onClick: () => onText({ anchor: value }) }));

  // ----- colour targets (text / highlight / outline / cell fill) -----
  const outlineWidth = outline?.w || 0;
  const targets = [
    { key: "text", icon: Baseline, label: t("pptxEditor.textColor"), value: `#${textHex.toLowerCase()}`, none: null,
      commit: (hex) => onText({ color: hex }), preview: (hex) => live({ color: hex }) },
    { key: "highlight", icon: Highlighter, label: t("pptxEditor.highlight"), value: st.highlight?.hex ? hexToCss(st.highlight.hex) : "none", none: t("pptxEditor.noHighlight"),
      commit: (hex) => onText({ highlight: hex }), preview: (hex) => live({ highlight: hex }), clear: () => onText({ highlight: null }) },
    { key: "outline", icon: Square, label: t("pptxEditor.tp.outline"), value: outline ? hexToCss(outline.hex) : "none", none: t("pptxEditor.noFill"),
      commit: (hex) => onText({ outline: { w: outlineWidth || 1, hex } }), preview: (hex) => live({ outline: { w: outlineWidth || 1, hex } }), clear: () => onText({ outline: null }) },
    ...(mode === "table" ? [{ key: "fill", icon: PaintBucket, label: t("pptxEditor.tableCellFill"), value: fill?.type === "solid" ? hexToCss(fill.hex) : "none", none: t("pptxEditor.noFill"), disabled: fillDisabled,
      commit: (hex) => onFill?.(hex), preview: (hex) => onLiveFill?.(hex), clear: () => onFill?.(null) }] : []),
  ];
  const active = targets.find((x) => x.key === target) || targets[0];
  const pickColor = (item, value) => {
    if (!value || /^(none|transparent)$/i.test(String(value))) { item.clear?.(); return; }
    item.commit(cssToHex(value));
  };
  const palette = dedupe([...themeColors.filter(Boolean).map((c) => hexToCss(c)), ...COLOR_PRESETS]);
  const colorT = (key) => (key === "svgEditor.chooseColor" ? t("pptxEditor.customColor") : key === "svgEditor.originalColor" ? active.none : undefined);
  const targetRow = (item) => (
    <div key={item.key} role="radio" aria-checked={target === item.key} className={`pe-tp-target ${target === item.key ? "is-active" : ""}`}
      onPointerDownCapture={() => { if (!off && !item.disabled) setTarget(item.key); }} onFocusCapture={() => { if (!off && !item.disabled) setTarget(item.key); }}>
      <span className="pe-tp-target-label"><item.icon size={11} aria-hidden="true" />{item.label}</span>
      <ColorPickerCard variant="chip" label={item.label} value={item.value} disabled={off || item.disabled} t={colorT}
        onChange={(css) => pickColor(item, css)} onLive={(css) => { if (/^#[0-9a-f]{6}$/i.test(String(css))) item.preview(cssToHex(css)); }} />
    </div>
  );
  const firstStack = targets.slice(0, 2), secondStack = targets.slice(2);

  const sizeMax = Math.max(120, Math.min(800, Math.ceil(size * 2)));
  const spacingMax = Math.max(20, Math.min(100, Math.ceil(Math.abs(spacing) * 2)));
  const outlineMax = Math.max(10, Math.min(40, Math.ceil(outlineWidth * 2)));
  const outlineValue = (v) => (v > 0 ? { w: v, hex: outline?.hex || "000000" } : null);
  const opacityCommit = (v) => onText({ opacity: Math.max(0, Math.min(100, v)) / 100, color: textHex });

  return (
    <div className="pe-tp" data-testid={testIds.root}>
      {/* ACTIONS — first card, on the phone strip and in the desktop ribbon */}
      {actions?.length > 0 && (
        <TpGroup id="actions" title={t("pptxEditor.tp.actions")} art={actionsArt}>
          <TpActionGrid cols={Math.min(3, Math.ceil(actions.length / 2))}>
            {actions.map((a) => <TpAction key={a.key} {...a} />)}
          </TpActionGrid>
        </TpGroup>
      )}

      {/* TYPOGRAPHY — [ font · B I U S ]  [ size · letter spacing ] (same grouping as the SVG editor bar) */}
      <TpGroup idle={off} id="typography" title={t("pptxEditor.tp.typography")} art={typographyArt}>
        <TpStack>
          <TpRow>
            <SelectField bare compact className="pe-tp-font" label={t("pptxEditor.font")} value={font} disabled={off} testId={testIds.font}
              options={fontOptions} onChange={(next) => onText({ font: next })} />
          </TpRow>
          <TpRow>
            <Segmented label={t("pptxEditor.font")} items={[
              toggle("bold", Bold, t("pptxEditor.bold"), testIds.bold),
              toggle("italic", Italic, t("pptxEditor.italic"), testIds.italic),
              toggle("underline", Underline, t("pptxEditor.underline")),
              toggle("strike", Strikethrough, t("pptxEditor.strike")),
            ]} />
          </TpRow>
        </TpStack>
        <TpStack>
          <TpRow>
            <RangeControl compact editable icon={Type} label={t("pptxEditor.size")} value={size} min={1} max={sizeMax} step={1} decimals={1} suffix=" pt" disabled={off} inputTestId={testIds.size}
              onCommit={(v) => onText({ size: Math.max(1, Math.min(400, v)) })} onLive={live1 && ((v) => live({ size: Math.max(1, Math.min(400, v)) }))} onLiveCancel={onLiveCancel} />
          </TpRow>
          <TpRow>
            <RangeControl compact editable icon={MoveHorizontal} label={t("pptxEditor.tp.letterSpacing")} value={spacing} min={-10} max={spacingMax} step={0.5} decimals={1} suffix=" pt" disabled={off}
              onCommit={(v) => onText({ spacing: v })} onLive={live1 && ((v) => live({ spacing: v }))} onLiveCancel={onLiveCancel} />
          </TpRow>
        </TpStack>
      </TpGroup>

      {/* PARAGRAPH — [ align · vertical anchor · bullets ]  [ line height · super / subscript ] */}
      <TpGroup idle={off} id="paragraph" title={t("pptxEditor.ribbon.group.paragraph")} art={paragraphArt}>
        <TpStack>
          <TpRow><Segmented label={t("pptxEditor.alignLeft")} items={alignItems} /></TpRow>
          <TpRow>
            <Segmented label={t("pptxEditor.anchor")} items={anchorItems} />
            {mode === "text" && <Segmented label={t("pptxEditor.bullets")} items={[{ key: "bullets", icon: List, label: t("pptxEditor.bullets"), disabled: off, active: bulletsOn, onClick: () => onText({ bullet: !bulletsOn }) }]} />}
          </TpRow>
        </TpStack>
        <TpStack>
          <TpRow>
            <RangeControl compact editable integer icon={AlignJustify} label={t("pptxEditor.tp.lineHeight")} value={lineSpacingPct} min={50} max={Math.max(300, lineSpacingPct)} step={5} suffix="%" disabled={off}
              onCommit={(v) => onText({ lineSpacing: Math.max(0.5, v / 100) })} onLive={live1 && ((v) => live({ lineSpacing: Math.max(0.5, v / 100) }))} onLiveCancel={onLiveCancel} />
          </TpRow>
          <TpRow>
            <Segmented label={t("pptxEditor.tp.baseline")} items={[
              { key: "sup", icon: SuperscriptIcon, label: t("pptxEditor.tp.superscript"), disabled: off, active: baseline > 0, onClick: () => onText({ baseline: baseline > 0 ? 0 : 30000 }) },
              { key: "sub", icon: SubscriptIcon, label: t("pptxEditor.tp.subscript"), disabled: off, active: baseline < 0, onClick: () => onText({ baseline: baseline < 0 ? 0 : -25000 }) },
            ]} />
          </TpRow>
        </TpStack>
      </TpGroup>

      {/* COLORS — target chips + quick palette (theme colours first) */}
      <TpGroup idle={off} id="colors" title={t("pptxEditor.tp.colors")} art={colorsArt}>
        <TpStack className="pe-tp-targets"><div role="radiogroup" aria-label={t("pptxEditor.tp.colors")} className="pe-tp-targets-list">{firstStack.map(targetRow)}</div></TpStack>
        {secondStack.length > 0 && <TpStack className="pe-tp-targets"><div role="radiogroup" aria-label={t("pptxEditor.tp.colors")} className="pe-tp-targets-list">{secondStack.map(targetRow)}</div></TpStack>}
        <ColorSwatches className="pe-tp-swatches" original={active.none ? { raw: "none", value: "none" } : null} current={{ value: active.value }}
          onPick={(value) => pickColor(active, value)} disabled={off || active.disabled} targetLabel={active.label} palette={palette} t={colorT} />
      </TpGroup>

      {/* APPEARANCE — opacity (+ quick pills) · outline width */}
      <TpGroup idle={off} id="appearance" title={t("pptxEditor.tp.appearance")} art={appearanceArt}>
        <TpStack>
          <TpRow>
            <RangeControl compact editable integer icon={Blend} label={t("pptxEditor.opacity")} value={opacityPct} min={0} max={100} step={1} suffix="%" disabled={off}
              onCommit={opacityCommit} onLive={live1 && ((v) => live({ opacity: Math.max(0, Math.min(100, v)) / 100, color: textHex }))} onLiveCancel={onLiveCancel} />
            <div className="pe-tp-pills" role="group" aria-label={t("pptxEditor.opacity")}>
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} type="button" className={`pe-tp-pill ${opacityPct === pct ? "is-active" : ""}`} onClick={() => opacityCommit(pct)} disabled={off} aria-pressed={opacityPct === pct}>{pct}</button>
              ))}
            </div>
          </TpRow>
          <TpRow>
            <RangeControl compact editable icon={Paintbrush} label={t("pptxEditor.tp.outlineWidth")} value={outlineWidth} min={0} max={outlineMax} step={0.5} decimals={1} suffix=" pt" disabled={off}
              onCommit={(v) => onText({ outline: outlineValue(v) })} onLive={live1 && ((v) => live({ outline: outlineValue(v) }))} onLiveCancel={onLiveCancel} />
          </TpRow>
        </TpStack>
      </TpGroup>

    </div>
  );
}

/** Table structure card: insert table, add / delete the focused row and column. */
export function TableStructureGroup({ t, actions }) {
  return (
    <TpGroup id="table" title={t("pptxEditor.ribbon.group.tables")} art={tableArt}>
      <TpActionGrid cols={3}>{actions.map((a) => <TpAction key={a.key} {...a} />)}</TpActionGrid>
    </TpGroup>
  );
}

/** "Apply formatting to" card: cell / row / column / whole table + the focused cell read-out. */
export function TableScopeGroup({ t, scope, onScope, disabled, hint, testId }) {
  const options = ["cell", "row", "column", "table"].map((value) => ({ value, label: t(`pptxEditor.tableScope.${value}`) }));
  return (
    <TpGroup id="scope" title={t("pptxEditor.tableSelectionScope")} art={tableScopeArt}>
      <TpStack>
        <TpRow><SelectField bare compact className="pe-tp-font" label={t("pptxEditor.tableApplyTo")} value={scope} options={options} disabled={disabled} onChange={onScope} testId={testId} /></TpRow>
        <TpRow><span className="pe-tp-hint">{hint}</span></TpRow>
      </TpStack>
    </TpGroup>
  );
}

/** Table design card: header row, banding, first / last row & column switches. */
export function TableDesignGroup({ t, table, disabled, onOptions }) {
  const items = [
    ["firstRow", "pptxEditor.tableHeaderRow"], ["bandRow", "pptxEditor.tableBandedRows"], ["firstCol", "pptxEditor.tableFirstColumn"],
    ["lastCol", "pptxEditor.tableLastColumn"], ["lastRow", "pptxEditor.tableLastRow"], ["bandCol", "pptxEditor.tableBandedColumns"],
  ];
  return (
    <TpGroup id="design" title={t("pptxEditor.ribbon.group.tableDesign")} art={tableDesignArt}>
      <div className="pe-tp-switches">
        {items.map(([key, label]) => <SwitchRow key={key} label={t(label)} checked={!!table?.[key]} disabled={disabled} onCheckedChange={(checked) => onOptions({ [key]: checked })} />)}
      </div>
    </TpGroup>
  );
}


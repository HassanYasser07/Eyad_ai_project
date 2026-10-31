import React from "react";
import { AlignCenterVertical, AlignEndVertical, AlignStartVertical, Bold, Italic, Minus, Plus, Strikethrough, Underline, Baseline, Highlighter, PaintBucket } from "lucide-react";
import { ColorField } from "./Controls.jsx";

const FONTS = ["Arial", "Calibri", "Verdana", "Georgia", "Times New Roman", "Courier New", "Inter", "Roboto", "Montserrat", "Poppins", "Cairo", "Tajawal", "Almarai"];

/**
 * Text formatting controls for the floating selection bar. Used for a picked table cell (pass `onFill`
 * to also get the cell-fill colour) and for any selected text box / shape with text (omit `onFill`).
 * The parent decides when it is visible and what `onText` applies to.
 *
 * Clicking a control blurs an in-progress cell edit first, which commits the typed text
 * (same path the ribbon uses), then the format is applied to the saved cell text.
 */
export default function CellToolbar({ style, fill, themeColors, onText, onFill, t }) {
  const size = Math.round(style?.size ?? 14);
  const [sizeText, setSizeText] = React.useState(String(size));
  React.useEffect(() => setSizeText(String(size)), [size]);
  const commitSize = (raw) => {
    const n = Math.round(Number(String(raw).replace(",", ".")));
    if (!Number.isFinite(n)) { setSizeText(String(size)); return; }
    const next = Math.min(400, Math.max(1, n));
    setSizeText(String(next));
    if (next !== size) onText({ size: next });
  };
  const toggle = (icon, key, label) => {
    const Icon = icon;
    const active = !!style?.[key];
    return (
      <button type="button" className={`pptx-cell-btn ${active ? "is-active" : ""}`} title={label} aria-label={label} aria-pressed={active}
        onClick={() => onText({ [key]: !active })}><Icon size={16} aria-hidden="true" /></button>
    );
  };
  return (
    <>
      <select className="pptx-cell-font" value={FONTS.includes(style?.font) ? style.font : "Arial"} aria-label={t("pptxEditor.font")} title={t("pptxEditor.font")}
        onChange={(e) => onText({ font: e.target.value })}>
        {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <span className="pptx-cell-size">
        <button type="button" className="pptx-cell-btn" title={`${t("pptxEditor.size")} −`} aria-label={`${t("pptxEditor.size")} −`} onClick={() => commitSize(size - 1)}><Minus size={14} aria-hidden="true" /></button>
        <input inputMode="numeric" value={sizeText} aria-label={t("pptxEditor.size")} title={t("pptxEditor.size")}
          onChange={(e) => setSizeText(e.target.value)} onBlur={(e) => commitSize(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); commitSize(size + (e.key === "ArrowUp" ? 1 : -1)); }
          }} />
        <button type="button" className="pptx-cell-btn" title={`${t("pptxEditor.size")} +`} aria-label={`${t("pptxEditor.size")} +`} onClick={() => commitSize(size + 1)}><Plus size={14} aria-hidden="true" /></button>
      </span>
      <i className="pptx-cell-sep" aria-hidden="true" />
      {toggle(Bold, "bold", t("pptxEditor.bold"))}
      {toggle(Italic, "italic", t("pptxEditor.italic"))}
      {toggle(Underline, "underline", t("pptxEditor.underline"))}
      {toggle(Strikethrough, "strike", t("pptxEditor.strike"))}
      <i className="pptx-cell-sep" aria-hidden="true" />
      <span className="pptx-cell-color"><Baseline size={15} aria-hidden="true" />
        <ColorField label={t("pptxEditor.textColor")} value={style?.color?.hex || null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")} onChange={(hex) => onText({ color: hex })} />
      </span>
      <span className="pptx-cell-color"><Highlighter size={15} aria-hidden="true" />
        <ColorField label={t("pptxEditor.highlight")} value={style?.highlight?.hex || null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")}
          onChange={(hex) => onText({ highlight: hex })} onNone={() => onText({ highlight: null })} noneLabel={t("pptxEditor.noHighlight")} />
      </span>
      {onFill && <span className="pptx-cell-color"><PaintBucket size={15} aria-hidden="true" />
        <ColorField label={t("pptxEditor.tableCellFill")} value={fill?.type === "solid" ? fill.hex : null} themeColors={themeColors} customColorLabel={t("pptxEditor.customColor")}
          onChange={(hex) => onFill(hex)} onNone={() => onFill(null)} noneLabel={t("pptxEditor.noFill")} />
      </span>}
      <i className="pptx-cell-sep" aria-hidden="true" />
      {[["l", AlignStartVertical, "alignLeft"], ["ctr", AlignCenterVertical, "alignCenter"], ["r", AlignEndVertical, "alignRight"]].map(([value, Icon, key]) => (
        <button key={value} type="button" className="pptx-cell-btn" title={t(`pptxEditor.${key}`)} aria-label={t(`pptxEditor.${key}`)} onClick={() => onText({ align: value })}>
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </>
  );
}

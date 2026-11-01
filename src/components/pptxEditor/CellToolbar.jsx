import React from "react";
import { AlignCenterVertical, AlignEndVertical, AlignStartVertical, Bold, Italic, Strikethrough, Underline, Baseline, Highlighter, PaintBucket } from "lucide-react";
import { ColorField } from "./Controls.jsx";
import { Stepper, SelectField, Segmented, Divider } from "@/components/editorKit";

const FONTS = ["Arial", "Calibri", "Verdana", "Georgia", "Times New Roman", "Courier New", "Inter", "Roboto", "Montserrat", "Poppins", "Cairo", "Tajawal", "Almarai"];

/**
 * Text formatting controls for the floating selection bar. Used for a picked table cell (pass `onFill`
 * to also get the cell-fill colour) and for any selected text box / shape with text (omit `onFill`).
 * The parent decides when it is visible and what `onText` applies to.
 *
 * Clicking a control blurs an in-progress cell edit first, which commits the typed text
 * (same path the ribbon uses), then the format is applied to the saved cell text.
 * Font names are written into the .pptx, so the stored values are plain family names (see FONTS).
 */
export default function CellToolbar({ style, fill, themeColors, onText, onFill, onLiveText, onLiveFill, t }) {
  const size = Math.round(style?.size ?? 14);
  const toggle = (icon, key, label) => ({ key, icon, label, active: !!style?.[key], onClick: () => onText({ [key]: !style?.[key] }) });
  const colorProps = { themeColors, customColorLabel: t("pptxEditor.customColor"), themeLabel: t("pptxEditor.themeColors") };
  return (
    <>
      <SelectField bare compact className="pptx-cell-font" label={t("pptxEditor.font")} value={FONTS.includes(style?.font) ? style.font : "Arial"}
        options={FONTS.map((f) => ({ value: f, label: f }))} onChange={(font) => onText({ font })} />
      <Stepper label={t("pptxEditor.size")} value={size} min={1} max={400} step={1} decimals={0} onCommit={(next) => onText({ size: next })} />
      <Divider />
      <Segmented label={t("pptxEditor.font")} items={[
        toggle(Bold, "bold", t("pptxEditor.bold")),
        toggle(Italic, "italic", t("pptxEditor.italic")),
        toggle(Underline, "underline", t("pptxEditor.underline")),
        toggle(Strikethrough, "strike", t("pptxEditor.strike")),
      ]} />
      <Divider />
      <ColorField icon={Baseline} label={t("pptxEditor.textColor")} value={style?.color?.hex || null} {...colorProps} onLive={onLiveText && ((hex) => onLiveText({ color: hex }))} onChange={(hex) => onText({ color: hex })} />
      <ColorField icon={Highlighter} label={t("pptxEditor.highlight")} value={style?.highlight?.hex || null} {...colorProps} onLive={onLiveText && ((hex) => onLiveText({ highlight: hex }))}
        onChange={(hex) => onText({ highlight: hex })} onNone={() => onText({ highlight: null })} noneLabel={t("pptxEditor.noHighlight")} />
      {onFill && <ColorField icon={PaintBucket} label={t("pptxEditor.tableCellFill")} value={fill?.type === "solid" ? fill.hex : null} {...colorProps} onLive={onLiveFill}
        onChange={(hex) => onFill(hex)} onNone={() => onFill(null)} noneLabel={t("pptxEditor.noFill")} />}
      <Divider />
      <Segmented label={t("pptxEditor.alignLeft")} items={[["l", AlignStartVertical, "alignLeft"], ["ctr", AlignCenterVertical, "alignCenter"], ["r", AlignEndVertical, "alignRight"]]
        .map(([value, Icon, key]) => ({ key: value, icon: Icon, label: t(`pptxEditor.${key}`), onClick: () => onText({ align: value }) }))} />
    </>
  );
}

import React from "react";
import { Pipette } from "lucide-react";
import { normalizeColor } from "./utils.js";

export function ColorPickerCard({ label, value, onChange, onLive, disabled = false, t, variant = "card" }) {
  const normalized = normalizeColor(value);
  const rawValue = String(value || "").trim();
  const hasSolidHexValue = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(rawValue);
  const isNone = /^(none|transparent)$/i.test(rawValue);
  const shownValue = isNone ? "NONE" : normalized.toUpperCase();
  const [draft, setDraft] = React.useState(shownValue);
  const pickerRef = React.useRef(null);
  const liveDirty = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => setDraft(shownValue), [shownValue]);
  const finishLive = React.useCallback(() => {
    const pending = liveDirty.current;
    liveDirty.current = null;
    if (pending) onChangeRef.current(pending);
  }, []);
  React.useEffect(() => {
    const input = pickerRef.current;
    if (!input) return undefined;
    input.addEventListener("change", finishLive);
    return () => input.removeEventListener("change", finishLive);
  }, [finishLive]);
  const preview = (next) => {
    if (onLive) { liveDirty.current = next; onLive(next); } else onChange(next);
  };
  const commitHex = () => {
    if (isNone && draft.trim().toUpperCase() === "NONE" && !liveDirty.current) return;
    const candidate = draft.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(candidate)) {
      const next = `#${candidate.toUpperCase()}`;
      setDraft(next);
      if (liveDirty.current) { liveDirty.current = null; onChange(next); }
      else if (!hasSolidHexValue || next.toLowerCase() !== normalized.toLowerCase()) onChange(next);
    } else {
      if (liveDirty.current) { liveDirty.current = null; onChange(normalized.toUpperCase()); }
      setDraft(shownValue);
    }
  };
  return (
    <div className={`ek-color-picker-card ${variant === "chip" ? "is-chip" : ""}`}>
      <span className={`ek-large-color-swatch ${isNone ? "is-none" : ""}`} style={isNone ? undefined : { background: normalized }}>
        <input ref={pickerRef} className="ek-native-color-picker" aria-label={label} title={label} type="color" value={normalized} onChange={(event) => { setDraft(event.target.value.toUpperCase()); preview(event.target.value); }} onBlur={finishLive} disabled={disabled} />
      </span>
      <span className="ek-color-value-copy">
        <strong>{label}</strong>
        <input className="ek-color-hex-field" aria-label={`${label} HEX`} value={draft} maxLength={7} spellCheck={false} disabled={disabled} onChange={(event) => { const text = event.target.value.toUpperCase(); setDraft(text); const candidate = text.trim().replace(/^#/, ""); if (onLive && /^[0-9A-F]{6}$/.test(candidate)) { const next = `#${candidate}`; liveDirty.current = next; onLive(next); } }} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitHex(); event.currentTarget.blur(); } }} />
      </span>
      <button type="button" className="ek-color-picker-edit" onClick={() => pickerRef.current?.click()} disabled={disabled} aria-label={t?.("svgEditor.chooseColor") || "Choose any color"} title={t?.("svgEditor.chooseColor") || "Choose any color"}>
        <Pipette size={13} aria-hidden="true" />
        <span>{t?.("svgEditor.chooseColor") || "Choose any color"}</span>
      </button>
    </div>
  );
}

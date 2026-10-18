import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

export function IconButton({ icon: Icon, label, onClick, active, disabled, danger, text, size = 18, testId }) {
  return (
    <button type="button" className={`pe-btn ${active ? "is-active" : ""} ${danger ? "is-danger" : ""} ${text ? "has-text" : ""}`} onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} data-testid={testId}>
      {Icon && <Icon size={size} aria-hidden="true" />}
      {text && <span>{label}</span>}
    </button>
  );
}

const PRESETS = ["000000", "FFFFFF", "475569", "94A3B8", "DC2626", "EA580C", "F59E0B", "16A34A", "0D9488", "2563EB", "7C3AED", "DB2777"];
const HEX = /^[0-9A-Fa-f]{6}$/;

export function ColorField({ label, value, onChange, onNone, themeColors = [], noneLabel, testId }) {
  const [open, setOpen] = React.useState(false);
  const [hex, setHex] = React.useState(value || "");
  React.useEffect(() => setHex(value || ""), [value]);
  const palette = [...new Set([...themeColors, ...PRESETS].map((c) => c.toUpperCase()))];
  const pick = (c) => { onChange(c); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="pe-color" aria-label={label} title={label} data-testid={testId}>
          <span className="pe-swatch" style={{ background: value ? `#${value}` : "transparent" }} data-none={!value} />
          <span className="pe-color-label">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="pe-pop" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="pe-palette">
          {palette.map((c) => <button key={c} type="button" className="pe-chip" style={{ background: `#${c}` }} aria-label={`#${c}`} onClick={() => pick(c)} />)}
        </div>
        <div className="pe-row">
          <input type="color" className="pe-colorinput" aria-label={label} value={`#${HEX.test(hex) ? hex : "000000"}`} onChange={(e) => onChange(e.target.value.slice(1).toUpperCase())} />
          <input className="pe-input" value={hex} maxLength={6} aria-label="Hex" onChange={(e) => setHex(e.target.value.replace(/[^0-9a-f]/gi, ""))} onKeyDown={(e) => { if (e.key === "Enter" && HEX.test(hex)) pick(hex.toUpperCase()); }} onBlur={() => HEX.test(hex) && hex.toUpperCase() !== value && onChange(hex.toUpperCase())} />
        </div>
        {onNone && <button type="button" className="pe-link" onClick={() => { onNone(); setOpen(false); }}>{noneLabel}</button>}
      </PopoverContent>
    </Popover>
  );
}

export function NumberField({ label, value, onCommit, step = 1, min = -9999, max = 9999, suffix, decimals = 1, testId }) {
  const fmt = (v) => (Number.isFinite(v) ? String(Number(v.toFixed(decimals))) : "");
  const [text, setText] = React.useState(fmt(value));
  React.useEffect(() => setText(fmt(value)), [value]);  
  const commit = (raw) => {
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) { setText(fmt(value)); return; }
    const v = Math.min(max, Math.max(min, n));
    setText(fmt(v));
    if (v !== value) onCommit(v);
  };
  return (
    <label className="pe-num">
      <span>{label}</span>
      <input inputMode="decimal" value={text} data-testid={testId} aria-label={label}
        onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const base = Number(text) || 0; commit(base + (e.key === "ArrowUp" ? step : -step)); }
        }} />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

export function SliderField({ label, value, onCommit, min = 0, max = 100, testId }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return (
    <div className="pe-slider" data-testid={testId}>
      <span>{label}</span>
      <Slider min={min} max={max} step={1} value={[v]} aria-label={label} onValueChange={([x]) => setV(x)} onValueCommit={([x]) => onCommit(x)} />
      <em>{Math.round(v)}%</em>
    </div>
  );
}

export function Section({ title, children }) {
  return <section className="pe-section"><h3>{title}</h3><div className="pe-section-body">{children}</div></section>;
}

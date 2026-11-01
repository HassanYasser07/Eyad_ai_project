import React from "react";
import { Check } from "lucide-react";

/**
 * Accessible single-choice card group (radio semantics, arrow-key navigation).
 * Used for "purpose" and "audience". Selection is shown with a border, tint and check mark,
 * never by color alone.
 */
export default function OptionCardGroup({ name, label, options, value, onChange, loc, invalid = false, describedBy }) {
  const refs = React.useRef([]);
  const selectedIndex = options.findIndex((option) => option.value === value);

  const move = (from, step) => {
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event, index) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); move(index, document.documentElement.dir === "rtl" && event.key === "ArrowRight" ? -1 : 1); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); move(index, document.documentElement.dir === "rtl" && event.key === "ArrowLeft" ? 1 : -1); }
  };

  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option, index) => {
        const selected = option.value === value;
        const tabbable = selected || (selectedIndex === -1 && index === 0);
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            data-testid={`${name}-${option.value}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={[
              "relative flex min-h-[52px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : invalid
                  ? "border-destructive/60 bg-card text-foreground hover:border-primary/60"
                  : "border-border bg-card text-foreground hover:border-primary/60 hover:bg-accent/40",
            ].join(" ")}
          >
            <span className="leading-snug">{loc(option)}</span>
            <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {selected && <Check className="h-3 w-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

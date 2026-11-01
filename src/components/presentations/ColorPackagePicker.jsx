import React from "react";
import { Check } from "lucide-react";
import { PRESENTATION_COLOR_PACKAGES } from "@/config/presentationColorPackages";

/**
 * Visual picker for the 4-color packages defined in src/config/presentationColorPackages.js.
 * Each card: package name, four swatches, and a check mark + ring when selected.
 */
export default function ColorPackagePicker({ value, onChange, label, packages = PRESENTATION_COLOR_PACKAGES }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {packages.map((pkg) => {
        const selected = pkg.id === value;
        return (
          <button
            key={pkg.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={`color-package-${pkg.id}`}
            onClick={() => onChange(pkg.id)}
            onKeyDown={(event) => {
              const index = packages.findIndex((item) => item.id === pkg.id);
              const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
              if (!delta) return;
              event.preventDefault();
              const rtlFlip = document.documentElement.dir === "rtl" && ["ArrowRight", "ArrowLeft"].includes(event.key) ? -1 : 1;
              const next = packages[(index + delta * rtlFlip + packages.length) % packages.length];
              onChange(next.id);
              event.currentTarget.parentElement?.querySelector(`[data-testid="color-package-${next.id}"]`)?.focus();
            }}
            className={[
              "relative flex flex-col gap-2 rounded-xl border bg-card p-2.5 text-start transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/60",
            ].join(" ")}
          >
            <span className="flex h-12 overflow-hidden rounded-lg border border-border/60" aria-hidden="true">
              {pkg.colors.map((color) => <i key={color} className="block flex-1" style={{ background: color }} />)}
            </span>
            <span className="flex items-center justify-between gap-2">
              <strong className="truncate text-xs font-bold text-foreground" dir="ltr">{pkg.name}</strong>
              <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {selected && <Check className="h-3 w-3" />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

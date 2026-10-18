import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef(({ className, variant = "default", "aria-label": ariaLabel, ...props }, ref) => {
  const wave = variant === "wave";
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      aria-label={ariaLabel}
      data-variant={variant}
      {...props}
    >
      <SliderPrimitive.Track className={cn("relative w-full grow overflow-hidden rounded-full", wave ? "pe-wave-slider-track" : "h-1.5 bg-primary/20")}>
        <SliderPrimitive.Range className={cn("absolute h-full", wave ? "pe-wave-slider-range" : "bg-primary")} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={ariaLabel} className={cn("block rounded-full border shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", wave ? "pe-wave-slider-thumb" : "h-4 w-4 border-primary/50 bg-background")} />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

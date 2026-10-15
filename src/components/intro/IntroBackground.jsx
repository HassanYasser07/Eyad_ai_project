/**
 * EYAD AI Intro — atmospheric background layers.
 * Light blue/cyan gradients, soft edge vignette, and subtle bokeh particles.
 * No images. Pure CSS for smooth mobile performance.
 */
import React from "react";

// Deterministic bokeh field (no JS animation, CSS handles motion).
const BOKEH = [
  { top: "12%", left: "16%", size: 8, op: 0.5, delay: 0, dur: 7 },
  { top: "22%", left: "78%", size: 6, op: 0.4, delay: 1.2, dur: 8 },
  { top: "34%", left: "8%", size: 10, op: 0.35, delay: 0.6, dur: 9 },
  { top: "44%", left: "88%", size: 7, op: 0.45, delay: 2, dur: 7.5 },
  { top: "58%", left: "20%", size: 6, op: 0.4, delay: 1.6, dur: 8.5 },
  { top: "66%", left: "72%", size: 9, op: 0.35, delay: 0.3, dur: 9.5 },
  { top: "76%", left: "30%", size: 5, op: 0.5, delay: 2.4, dur: 7 },
  { top: "82%", left: "64%", size: 8, op: 0.4, delay: 1.1, dur: 8 },
  { top: "16%", left: "48%", size: 5, op: 0.3, delay: 2.8, dur: 10 },
  { top: "50%", left: "50%", size: 6, op: 0.3, delay: 0.9, dur: 11 },
  { top: "90%", left: "46%", size: 7, op: 0.35, delay: 1.8, dur: 8 },
  { top: "28%", left: "40%", size: 4, op: 0.3, delay: 3.2, dur: 9 },
];

export default function IntroBackground() {
  return (
    <>
      <div className="eyad-intro__edge" aria-hidden="true" />
      {BOKEH.map((d, i) => (
        <span
          key={i}
          className="eyad-intro__bokeh"
          aria-hidden="true"
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            opacity: d.op,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
          }}
        />
      ))}
    </>
  );
}
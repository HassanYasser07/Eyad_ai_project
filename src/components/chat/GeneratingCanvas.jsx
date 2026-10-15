import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { appConfig } from "@/config/app.config";
import "./generating-canvas.css";

/**
 * Dot Matrix Energy Wave — generation loading animation.
 *
 * A dense grid of dots rendered on a <canvas>. Two Gaussian "energy waves"
 * travel diagonally across the grid in opposite directions. Dots near a
 * wave front grow, brighten, and gain a soft glow; as the wave passes they
 * return smoothly to their idle state. The motion is continuous and fluid
 * (no jumps, no randomness).
 *
 * EYAD theme: white / very-light-cyan glass surface, EYAD cyan→blue→soft-violet
 * dots with a premium soft glow (not neon).
 *
 * Completion transition: when `completing` becomes true the wave slows, a soft
 * brightness pulse sweeps the grid, dots calm down, and the whole surface
 * fades + scales + blurs out before `onComplete` is called — giving a smooth
 * hand-off to the result state with no flash or jump.
 */
export default function GeneratingCanvas({
  variant = "full",
  completing = false,
  onComplete,
}) {
  const { language } = useI18n();
  const isAr = language !== "en";
  const eyadIconSrc = appConfig.assets.logoIcon;
  const compact = variant === "compact";

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const completingRef = useRef(false);
  const completionStartRef = useRef(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [progress, setProgress] = useState(0);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    completingRef.current = completing;
    if (completing) {
      completionStartRef.current = Date.now();
      completedRef.current = false;
    }
  }, [completing]);

  useEffect(() => {
    if (compact) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    let width = 0, height = 0, dpr = 1;
    let cols = 0, rows = 0;
    const dotSpacing = 15;
    const baseRadius = 1.1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor(width / dotSpacing));
      rows = Math.max(1, Math.floor(height / dotSpacing));
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // EYAD palette
    const cyan   = { r: 34,  g: 211, b: 238 };  // #22D3EE
    const blue   = { r: 37,  g: 99,  b: 235 };  // #2563EB
    const violet = { r: 139, g: 92,  b: 246 };  // #8B5CF6

    const lerp = (a, b, t) => a + (b - a) * t;
    const mix = (c1, c2, t) => ({
      r: lerp(c1.r, c2.r, t),
      g: lerp(c1.g, c2.g, t),
      b: lerp(c1.b, c2.b, t),
    });

    let waveTime = 0;
    let lastTime = performance.now();
    let progressAccum = 0;

    const animate = (now) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // ── Completion phase factors ──
      let speedFactor = 1;
      let brightnessPulse = 0;
      let globalFade = 1;

      if (completingRef.current) {
        const ce = (Date.now() - completionStartRef.current) / 1000;
        const dur = 1.4;
        const t = Math.min(1, ce / dur);
        speedFactor = 1 - t * 0.92;           // wave slows to near-stop
        brightnessPulse = Math.sin(t * Math.PI) * 0.45; // soft pulse
        globalFade = 1 - Math.pow(t, 1.8);   // smooth fade-out

        if (t >= 1 && !completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
          return;
        }
      }

      waveTime += dt * speedFactor;

      // ── Simulated progress (ease-out, never hits 100% until completion) ──
      if (!completingRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const simulated = Math.min(95, 15 + 80 * (1 - Math.exp(-elapsed / 10)));
        // Throttle setProgress to avoid excessive re-renders
        progressAccum += dt;
        if (progressAccum > 0.3) {
          progressAccum = 0;
          setProgress(Math.round(simulated));
        }
      } else {
        setProgress(100);
      }

      ctx.clearRect(0, 0, width, height);

      // ── Wave geometry ──
      const totalDist = cols + rows + 24;
      const sigma = 5.5;
      const wavePos1 = ((waveTime * 5.5) % totalDist) - 12;
      const wavePos2 = ((waveTime * 3.8 + totalDist * 0.45) % totalDist) - 12;

      const offsetX = (width - cols * dotSpacing) / 2;
      const offsetY = (height - rows * dotSpacing) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * dotSpacing + dotSpacing / 2 + offsetX;
          const y = row * dotSpacing + dotSpacing / 2 + offsetY;

          // Primary diagonal wave (↘)
          const d1 = (col + row) - wavePos1;
          const e1 = Math.exp(-(d1 * d1) / (2 * sigma * sigma));

          // Secondary diagonal wave (↙)
          const d2 = (col - row + rows) - wavePos2;
          const e2 = Math.exp(-(d2 * d2) / (2 * sigma * sigma));

          let excitement = Math.min(1, e1 + e2 * 0.55);

          // Idle breathing — keeps dots alive even away from the wave
          const idle = 0.10 + 0.06 * Math.sin(waveTime * 0.9 + col * 0.35 + row * 0.25);
          let finalEx = Math.max(idle, excitement);

          // Completion brightness pulse
          finalEx = Math.min(1, finalEx * (1 - brightnessPulse) + brightnessPulse);
          finalEx *= globalFade;

          // Size & opacity
          const radius = baseRadius + finalEx * 2.6;
          const opacity = (0.10 + finalEx * 0.90) * globalFade;

          // Color: cyan → blue → violet
          let color;
          if (finalEx < 0.5) {
            color = mix(cyan, blue, finalEx * 2);
          } else {
            color = mix(blue, violet, (finalEx - 0.5) * 2);
          }
          const cr = Math.round(color.r);
          const cg = Math.round(color.g);
          const cb = Math.round(color.b);

          // Soft glow halo for excited dots
          if (finalEx > 0.22) {
            const glowR = radius * 3.2;
            const glowA = (finalEx - 0.22) * 0.28 * globalFade;
            ctx.beginPath();
            ctx.arc(x, y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${glowA})`;
            ctx.fill();
          }

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${opacity})`;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      ro.disconnect();
    };
  }, [compact]);

  // ── Compact variant (unchanged text-only indicator) ──
  if (compact) {
    return (
      <div className="eyad-generating eyad-generating--compact" role="status" aria-live="polite">
        <span className="eyad-generating__compact-text">
          <span className="eyad-generating__icon"><img src={eyadIconSrc} alt="" /></span>
          {isAr ? "جاري التوليد" : "Generating"}
        </span>
      </div>
    );
  }

  return (
    <div className={`eyad-generating${completing ? " is-completing" : ""}`} role="status" aria-live="polite">
      <div className="eyad-generating__canvas-container" ref={containerRef}>
        <canvas ref={canvasRef} className="eyad-generating__canvas" />
      </div>
      <div className="eyad-generating__progress-glass">
        <span className="eyad-generating__progress-number">{progress}<span className="eyad-generating__progress-percent">%</span></span>
      </div>
    </div>
  );
}
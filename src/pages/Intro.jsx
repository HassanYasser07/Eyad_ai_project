/**
 * EYAD AI — Cinematic 3D spatial intro (rebuilt from scratch).
 *
 * Phased sequence matching the reference video:
 *   1. ENTERING  — cards materialize from depth, staggered, curved arcs
 *   2. FLOATING  — brief settle, subtle idle drift
 *   3. CARD_EXIT — cards scatter / fly away / fade
 *   4. LOGO      — EYAD AI logo reveals as the finale (cards gone)
 *   5. INTERACTIVE — cards re-enter for swipe/tap; logo fades out
 *
 * Horizontal drag continuously rotates the 3D card space (not a carousel).
 * Release snaps to nearest card with momentum. Tap a card to enter.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, animate } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Logo from "@/components/Logo";
import IntroBackground from "@/components/intro/IntroBackground";
import IntroTile from "@/components/intro/IntroTile";
import { studioRegistry } from "@/studios/studioRegistry";
import "@/components/intro/intro.css";

const CARD_COUNT = studioRegistry.length;
const ANGLE_PER_CARD = 360 / CARD_COUNT;
const DRAG_SENSITIVITY = 0.38;
const EXIT_HOLD_MS = 450;

const PHASE = {
  ENTERING: "entering",
  FLOATING: "floating",
  CARD_EXIT: "card_exit",
  LOGO: "logo",
  INTERACTIVE: "interactive",
};

const wrapAngle = (a) => {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r < -180) r += 360;
  return r;
};

export default function Intro() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(PHASE.ENTERING);
  const [exiting, setExiting] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const interactive = phase === PHASE.FLOATING && !exiting;

  // Continuous rotation of the 3D card space (degrees).
  const rotation = useMotionValue(0);
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startRotation: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    moved: false,
  });
  const exitTimer = useRef(null);
  const lastIndexRef = useRef(-1);
  const pausedUntilRef = useRef(0);
  // Stores the active snap/card animation so a new drag can stop it before
  // it overrides rotation.set(). Without this, the spring from endDrag keeps
  // writing to `rotation` every frame and silently cancels every subsequent
  // drag — the card appears "frozen" after the first gesture.
  const snapAnimRef = useRef(null);
  const phaseRef = useRef(phase);
  const exitingRef = useRef(exiting);

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const startExit = useCallback(
    (target = "/") => {
      if (exiting) return;
      setExiting(true);
      clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(() => {
        navigate(target === "/" ? "/home" : target, target === "/" ? { state: { introCompleted: true } } : undefined);
      }, EXIT_HOLD_MS);
    },
    [exiting, navigate]
  );

  // ── Phase timeline ──
  useEffect(() => {
    if (userInteracted) return;
    if (reduceMotion) {
      const timers = [
        setTimeout(() => setPhase(PHASE.FLOATING), 300),
        setTimeout(() => setPhase(PHASE.CARD_EXIT), 600),
        setTimeout(() => setPhase(PHASE.LOGO), 900),
      ];
      return () => timers.forEach(clearTimeout);
    }
    const timers = [
      setTimeout(() => setPhase(PHASE.FLOATING), 1300),
      setTimeout(() => setPhase(PHASE.CARD_EXIT), 6300),
      setTimeout(() => setPhase(PHASE.LOGO), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, userInteracted]);

  // ── Navigate to Home after logo has been visible ──
  useEffect(() => {
    if (phase !== PHASE.LOGO) return;
    if (userInteracted) return;
    const delay = reduceMotion ? 300 : 1500;
    const t = setTimeout(() => startExit("/"), delay);
    return () => clearTimeout(t);
  }, [phase, reduceMotion, startExit, userInteracted]);

  // Keep refs in sync for the auto-rotation loop.
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { exitingRef.current = exiting; }, [exiting]);

  // ── Auto-rotation: continuous 3D orbit when idle ──
  useEffect(() => {
    let raf;
    let last = performance.now();
    const SPEED = 72; // deg/sec — one full rotation in 5s
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = phaseRef.current;
      const canRotate =
        (p === PHASE.ENTERING || p === PHASE.FLOATING || p === PHASE.CARD_EXIT) &&
        !dragRef.current.dragging &&
        !exitingRef.current &&
        now > pausedUntilRef.current;
      if (canRotate) rotation.set(rotation.get() + SPEED * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rotation]);

  // Pause auto-rotation briefly after cards settle / re-enter.
  useEffect(() => {
    if (phase === PHASE.INTERACTIVE) pausedUntilRef.current = performance.now() + 1800;
  }, [phase]);

  // Track which card is at the focus position — only re-render on change.
  useEffect(() => {
    const unsub = rotation.on("change", (r) => {
      const nearest = Math.round(r / ANGLE_PER_CARD);
      const idx = ((nearest % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
      if (idx !== lastIndexRef.current) {
        lastIndexRef.current = idx;
        if (phaseRef.current === PHASE.INTERACTIVE) setActiveIndex(idx);
      }
    });
    return unsub;
  }, [rotation]);

  // ── Continuous drag: the card space rotates with the finger ──
  const handlePointerDown = useCallback(
    (e) => {
      if (!interactive) return;
      setUserInteracted(true);
      // Stop any ongoing snap/card spring so it cannot override the drag's
      // rotation.set() calls on the next frame.
      if (snapAnimRef.current) {
        snapAnimRef.current.stop();
        snapAnimRef.current = null;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startRotation: rotation.get(),
        lastX: e.clientX,
        lastTime: Date.now(),
        velocity: 0,
        moved: false,
      };
    },
    [interactive, rotation]
  );

  const handlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d.dragging) return;
      const delta = e.clientX - d.startX;
      if (Math.abs(delta) > 5) d.moved = true;
      rotation.set(d.startRotation - delta * DRAG_SENSITIVITY);
      const now = Date.now();
      const dt = now - d.lastTime;
      if (dt > 0) {
        d.velocity = ((e.clientX - d.lastX) / dt) * -DRAG_SENSITIVITY * 1000;
      }
      d.lastX = e.clientX;
      d.lastTime = now;
    },
    [rotation]
  );

  const endDrag = useCallback((e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    // Release pointer capture explicitly on every exit path (pointerup,
    // pointercancel). The browser auto-releases on pointerup, but calling
    // it here guarantees cleanup on pointercancel too, so no capture is
    // left dangling for the next gesture.
    if (e?.currentTarget && e?.pointerId != null) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
    pausedUntilRef.current = performance.now() + 2500;
    const current = rotation.get();
    const nearest = Math.round(current / ANGLE_PER_CARD) * ANGLE_PER_CARD;
    snapAnimRef.current = animate(rotation, nearest, {
      type: "spring",
      stiffness: 70,
      damping: 16,
      mass: 0.7,
      velocity: d.velocity,
    });
  }, [rotation]);

  // ── Card tap: open if focused, otherwise rotate to focus then open ──
  const handleCardClick = useCallback(
    (studio, index) => {
      const d = dragRef.current;
      if (d.moved) {
        d.moved = false;
        return;
      }
      if (exiting || !interactive) return;
      if (index === lastIndexRef.current) {
        startExit(studio.route);
      } else {
        const current = rotation.get();
        const target = index * ANGLE_PER_CARD;
        let diff = target - current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        snapAnimRef.current = animate(rotation, current + diff, {
          type: "spring",
          stiffness: 65,
          damping: 15,
          mass: 0.8,
        });
        setTimeout(() => startExit(studio.route), 780);
      }
    },
    [exiting, interactive, startExit, rotation]
  );

  const activeStudio = studioRegistry[activeIndex];
  const logoVisible = phase === PHASE.LOGO;

  return (
    <div className={`eyad-intro ${exiting ? "is-exiting" : ""}`} dir="rtl">
      <IntroBackground />
      <div className="eyad-intro__atmosphere" aria-hidden="true" />

      <div
        className="eyad-intro__stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          // If the browser revokes capture unexpectedly, reset drag state
          // without starting a snap animation so the next gesture is clean.
          if (dragRef.current.dragging) dragRef.current.dragging = false;
        }}
      >
        <div className="eyad-intro__orbit">
          <div className="eyad-intro__ring eyad-intro__ring--1" aria-hidden="true" />
          <div className="eyad-intro__ring eyad-intro__ring--2" aria-hidden="true" />
          <div className="eyad-intro__glow" aria-hidden="true" />

          {studioRegistry.map((studio, index) => (
            <IntroTile
              key={studio.id}
              studio={studio}
              index={index}
              rotation={rotation}
              cardPhase={phase}
              interactive={interactive}
              reduceMotion={reduceMotion}
              onSelect={handleCardClick}
            />
          ))}

          <div className="eyad-intro__center-wrap">
            <motion.div
              className="eyad-intro__center"
              initial={{ opacity: 0, scale: 0.7, y: 12 }}
              animate={{
                opacity: phase === PHASE.LOGO && !exiting ? 1 : 0,
                scale: phase === PHASE.LOGO && !exiting ? 1 : 0.78,
                y: phase === PHASE.LOGO && !exiting ? 0 : 12,
              }}
              transition={{
                duration: phase === PHASE.LOGO ? 1.1 : 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="eyad-intro__logo-float">
                <Logo variant="full" className="eyad-intro__logo-img" alt="EYAD AI" />
              </div>
              <p className="eyad-intro__logo-subtext">استوديو إبداعي ذكي</p>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        className="eyad-intro__selection"
        animate={{
          opacity: phase === PHASE.INTERACTIVE && !exiting ? 1 : 0,
          y: phase === PHASE.INTERACTIVE ? 0 : 8,
        }}
        transition={{ duration: 0.5 }}
      >
        <span>{activeStudio?.name.ar}</span>
        <small>اسحب للتنقل · اضغط للاختيار</small>
      </motion.div>

      <div className="eyad-intro__pagination" aria-hidden="true">
        {studioRegistry.map((studio, index) => (
          <span
            key={studio.id}
            className={index === activeIndex && phase === PHASE.INTERACTIVE ? "is-active" : ""}
          />
        ))}
      </div>

      <button
        type="button"
        className="eyad-intro__skip"
        onClick={() => startExit("/")}
      >
        تخطي
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
}
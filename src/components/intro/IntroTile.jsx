/**
 * EYAD AI Intro — single 3D glass card.
 *
 * Position is driven by the shared `rotation` motion value via useTransform
 * — no React re-renders during drag. Each card sits on an elliptical ring;
 * depth, scale, blur, opacity and rotateY derive from the card's angle.
 *
 * Lifecycle (driven by `cardPhase` prop):
 *   entering  → enterProgress 0→1 (materialize from depth, curved arc)
 *   card_exit → exitProgress 0→1 (scatter: fly outward, up, shrink, blur, fade)
 *   interactive → reset + re-enter (quick, for swipe/tap use)
 *
 * Idle: a gentle sine-wave float keeps the card subtly alive.
 */
import React, { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  animate,
} from "framer-motion";
import { getStudioIcon } from "@/studios/studioIcons";

const CARD_COUNT = 7;
const ANGLE_PER_CARD = 360 / CARD_COUNT;

// Ellipse radii — wider than tall, with real depth.
const RADIUS_X = 145;
const RADIUS_Z = 105;
const Y_BASE = 0; // all cards on the same level
const Y_RANGE = 0; // no vertical variation by depth

// All cards share the same Y — level ring.
const Y_OFFSETS = [0, 0, 0, 0, 0, 0, 0];
const ARC_OFFSETS = [-28, 22, -18, 14, -14, 18, -22];

const wrapAngle = (a) => {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r < -180) r += 360;
  return r;
};

export default function IntroTile({
  studio,
  index,
  rotation,
  cardPhase,
  interactive,
  reduceMotion,
  onSelect,
}) {
  const Icon = getStudioIcon(studio.icon);
  const cardAngle = index * ANGLE_PER_CARD;

  // ── Entrance / exit progress ──
  const enterProgress = useMotionValue(0);
  const exitProgress = useMotionValue(0);

  // Initial entrance on mount.
  useEffect(() => {
    const delay = reduceMotion ? 0 : 0.05 + index * 0.08;
    const controls = animate(enterProgress, 1, {
      duration: reduceMotion ? 0.2 : 0.75,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase-driven: card exit and re-enter.
  useEffect(() => {
    if (cardPhase === "card_exit") {
      const delay = reduceMotion ? 0 : index * 0.03;
      const controls = animate(exitProgress, 1, {
        duration: reduceMotion ? 0.15 : 0.5,
        delay,
        ease: [0.7, 0, 0.84, 0], // easeIn — accelerate away
      });
      return controls.stop;
    }
    if (cardPhase === "interactive") {
      exitProgress.set(0);
      enterProgress.set(0);
      const delay = reduceMotion ? 0 : 0.05 + index * 0.05;
      const controls = animate(enterProgress, 1, {
        duration: reduceMotion ? 0.15 : 0.5,
        delay,
        ease: [0.16, 1, 0.3, 1],
      });
      return controls.stop;
    }
  }, [cardPhase, index, reduceMotion, enterProgress, exitProgress]);

  // ── Slot position from continuous rotation ──
  const relativeAngle = useTransform(rotation, (r) => wrapAngle(cardAngle - r));
  const rad = useTransform(relativeAngle, (a) => (a * Math.PI) / 180);

  const baseX = useTransform(rad, (r) => RADIUS_X * Math.sin(r));
  const depthFactor = useTransform(rad, (r) => (1 - Math.cos(r)) / 2);
  const baseScale = useTransform(depthFactor, (d) => 1 - d * 0.55);
  const baseOpacity = useTransform(depthFactor, (d) => 1 - d * 0.65);
  const baseBlur = useTransform(depthFactor, (d) => d * 4);
  const baseRotateY = useTransform(rad, (r) => -r * (180 / Math.PI) * 0.1);
  const baseZ = useTransform(depthFactor, (d) => -d * RADIUS_Z);
  const baseZIndex = useTransform(depthFactor, (d) => Math.round(50 - d * 30));
  const baseY = useTransform(
    depthFactor,
    (d) => Y_BASE - d * Y_RANGE + (Y_OFFSETS[index] || 0)
  );

  // ── Blend entrance + exit with slot position ──
  const arc = ARC_OFFSETS[index] || 0;

  const x = useTransform(
    [baseX, enterProgress, exitProgress],
    ([bx, ep, xp]) => bx * ep + bx * 0.7 * xp
  );
  const yRaw = useTransform(
    [baseY, enterProgress, exitProgress],
    ([by, ep, xp]) =>
      by * ep + arc * Math.sin(ep * Math.PI) * (1 - ep * 0.4) - 70 * xp
  );
  const scale = useTransform(
    [baseScale, enterProgress, exitProgress],
    ([bs, ep, xp]) => (0.12 + (bs - 0.12) * ep) * (1 - xp * 0.4)
  );
  const opacity = useTransform(
    [baseOpacity, enterProgress, exitProgress],
    ([bo, ep, xp]) => bo * ep * (1 - xp)
  );
  const blurAmount = useTransform(
    [baseBlur, enterProgress, exitProgress],
    ([bb, ep, xp]) => bb + (1 - ep) * 16 + xp * 14
  );
  const filter = useMotionTemplate`blur(${blurAmount}px)`;
  const rotateY = useTransform(
    [baseRotateY, enterProgress, exitProgress],
    ([br, ep, xp]) => br * ep + (1 - ep) * 28 + xp * 25
  );
  const translateZ = useTransform(
    [baseZ, enterProgress, exitProgress],
    ([bz, ep, xp]) => bz * ep + (1 - ep) * -210 - xp * 150
  );
  const zIndex = useTransform(
    [baseZIndex, enterProgress, exitProgress],
    ([zi, ep, xp]) => Math.round(zi * ep * (1 - xp) + 1)
  );

  // ── Idle floating (subtle, organic) ──
  const floatY = useMotionValue(0);
  const floatRotate = useMotionValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    let raf;
    const start = Date.now();
    const tick = () => {
      const t = (Date.now() - start) / 1000;
      floatY.set(Math.sin(t * 0.7 + index * 0.9) * 2.5);
      floatRotate.set(Math.sin(t * 0.5 + index * 1.3) * 1.2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, reduceMotion]);

  const finalY = useTransform([yRaw, floatY], ([yy, fy]) => yy + fy);

  return (
    <motion.div
      className="eyad-intro__tile-anchor"
      style={{
        x,
        y: finalY,
        scale,
        opacity,
        rotateY,
        z: translateZ,
        zIndex,
        filter,
        rotate: floatRotate,
      }}
    >
      <motion.button
        type="button"
        className="eyad-intro__tile"
        disabled={!interactive}
        onClick={() => onSelect(studio, index)}
        whileTap={interactive ? { scale: 0.95 } : undefined}
        aria-label={studio.name.ar}
        style={{ "--tile-accent": studio.accent }}
      >
        <span className="eyad-intro__tile-shine" aria-hidden="true" />
        <span
          className="eyad-intro__tile-icon"
          style={{ color: studio.accent, backgroundColor: `${studio.accent}1a` }}
        >
          <Icon className="w-5 h-5" strokeWidth={1.9} />
        </span>
        <span className="eyad-intro__tile-name">{studio.name.ar}</span>
      </motion.button>
    </motion.div>
  );
}
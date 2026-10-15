import React from "react";
import { appConfig } from "@/config/app.config";
import "./eyad-orb.css";

/**
 * EYAD Orb — the living AI entity.
 * @param {object} props
 * @param {"idle"|"listening"|"thinking"|"speaking"} props.state
 * @param {number} [props.size] — diameter in px
 */
export default function EyadOrb({ state = "idle", size = 180 }) {
  const logoSrc = appConfig.assets.logoIcon;

  return (
    <div
      className={`eyad-orb is-${state}`}
      style={{ "--orb-size": `${size}px` }}
      role="img"
      aria-label={`EYAD ${state}`}
    >
      <div className="eyad-orb__halo" />
      <div className="eyad-orb__ring" />
      <div className="eyad-orb__wave eyad-orb__wave--1" />
      <div className="eyad-orb__wave eyad-orb__wave--2" />
      <div className="eyad-orb__wave eyad-orb__wave--3" />
      <div className="eyad-orb__core">
        <div className="eyad-orb__shimmer" />
        <div className="eyad-orb__logo">
          <img src={logoSrc} alt="" />
        </div>
      </div>
    </div>
  );
}
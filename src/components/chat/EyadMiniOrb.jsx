import React from "react";
import { appConfig } from "@/config/app.config";
import "./eyad-orb.css";

/**
 * EYAD Mini Orb — small breathing orb for the chat composer.
 * Tapping it opens the full-screen Voice experience.
 */
export default function EyadMiniOrb({ active = false, onClick, ariaLabel = "Talk to EYAD" }) {
  const logoSrc = appConfig.assets.logoIcon;

  return (
    <button
      type="button"
      className={`eyad-mini-orb ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="eyad-mini-orb__halo" />
      <span className="eyad-mini-orb__core">
        <span className="eyad-mini-orb__logo">
          <img src={logoSrc} alt="" />
        </span>
      </span>
    </button>
  );
}
/**
 * EYAD AI logo — renders the official provided brand asset as-is.
 * Never redraw, recreate, recolor, or modify the logo. The asset URL is
 * centralized in src/config/app.config.js. Uses the shared Image component
 * with fittingType="fit" so the logo is contained, never cropped or recolored.
 */
import React from "react";
import { Image } from "@/components/ui/image";
import { appConfig } from "@/config/app.config";

export default function Logo({ variant = "icon", className = "", alt = "EYAD AI" }) {
  const src = variant === "full" ? appConfig.assets.logoFull : appConfig.assets.logoIcon;
  return (
    <Image
      src={src}
      alt={alt}
      fittingType="fit"
      className={className}
      draggable={false}
    />
  );
}
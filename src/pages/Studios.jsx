import React from "react";
import HomeStudios, { HOME_STUDIO_IDS } from "@/components/home/HomeStudios";
import { studioRegistry } from "@/studios/studioRegistry";

export default function Studios() {
  const studioIds = [...HOME_STUDIO_IDS, "templates"];
  const homeStudios = studioIds
    .map((id) => studioRegistry.find((studio) => studio.id === id))
    .filter(Boolean);

  return (
    <>
      <div className="eyad-studios-mobile-page">
        <HomeStudios studios={homeStudios} studioIds={studioIds} />
      </div>
    </>
  );
}

import React from "react";
import { useI18n } from "@/i18n/I18nContext";
import HomeHero from "@/components/home/HomeHero";
import HomeStudios from "@/components/home/HomeStudios";
import HomeMarketplace from "@/components/home/HomeMarketplace";
import HomeMyWork from "@/components/home/HomeMyWork";
import HomeFeatureBlock from "@/components/home/HomeFeatureBlock";
import HomeCreateSection from "@/components/home/HomeCreateSection";
import HomeIdeas from "@/components/home/HomeIdeas";
import HomeCompare from "@/components/home/HomeCompare";
import { studioRegistry } from "@/studios/studioRegistry";
import DesktopShell from "@/components/home/DesktopShell";
import "./home.css";
import "./homeDesktop.css";

export default function Home() {
  const { direction } = useI18n();
  return (
    <>
      <DesktopShell />
      <div className="eyad-home eyad-home--mobile">
        <div className="eyad-home__bg" aria-hidden="true" />
        <div dir={direction} className="eyad-home__content">
          <HomeHero />
          <HomeStudios studios={studioRegistry} />
          <HomeMarketplace />
          <HomeMyWork />
          <HomeFeatureBlock />
          <HomeCreateSection />
          <HomeIdeas />
          <HomeCompare />
        </div>
      </div>
    </>
  );
}
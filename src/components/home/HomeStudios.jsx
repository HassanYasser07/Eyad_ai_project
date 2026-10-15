import React from "react";
import { useNavigate } from "react-router-dom";
import { getStudioIcon } from "@/studios/studioIcons";
import { useI18n } from "@/i18n/I18nContext";

export const HOME_STUDIO_IDS = [
  "logo",
  "brand-kit",
  "ai-images",
  "video",
  "templates",
  "presentations",
  "company-profile",
];

export const STUDIO_VISUALS = {
  logo: {
    image:
      "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/17181d05c_lOGOSTUDIO.png",
    title: "home.studio.logo.title",
    line: "home.studio.logo.line",
  },
  "brand-kit": {
    image:
      "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/938a9d9f7_vISUALIDENTITY.png",
    title: "home.studio.brand.title",
    line: "home.studio.brand.line",
  },
  video: {
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=85",
    title: "home.studio.video.title",
    line: "home.studio.video.line",
  },
  "ai-images": {
    image:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=85",
    title: "home.studio.images.title",
    line: "home.studio.images.line",
  },
  "company-profile": {
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85",
    title: "home.studio.company.title",
    line: "home.studio.company.line",
  },
  presentations: {
    image:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85",
    title: "home.studio.presentations.title",
    line: "home.studio.presentations.line",
  },
  templates: {
    image:
      "https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=1200&q=85",
    title: "home.studio.templates.title",
    line: "home.studio.templates.line",
  },
};

export default function HomeStudios({ studios, studioIds = HOME_STUDIO_IDS }) {
  const navigate = useNavigate();
  const { t, loc } = useI18n();
  const ordered = studioIds.map((id) =>
    studios.find((s) => s.id === id)
  ).filter(Boolean);

  return (
    <section className="eyad-home__studios">
      <div className="eyad-home__section-head">
        <h2>{t("home.studios.title")}</h2>
        <span>{t("home.studios.choose")}</span>
      </div>

      <div className="eyad-home__studio-grid">
        {ordered.map((studio, index) => {
          const visual = STUDIO_VISUALS[studio.id] || {};
          const featured = studio.id === "logo" || studio.id === "brand-kit" || studio.id === "templates";
          const Icon = getStudioIcon(studio.icon);
          return (
            <button
              key={studio.id}
              type="button"
              onClick={() => navigate(studio.route)}
              className={`eyad-home__studio-card ${featured ? "is-featured" : ""}`}
            >
              <img src={visual.image} alt="" loading="lazy" />
              <span className="eyad-home__studio-shade" />
              <span className="eyad-home__studio-icon">
                <Icon />
              </span>
              <span className="eyad-home__studio-copy">
                <strong>{visual.title ? t(visual.title) : loc(studio.name)}</strong>
                <small>{visual.line ? t(visual.line) : loc(studio.description)}</small>
                <em>{t("home.studio.enter")}</em>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
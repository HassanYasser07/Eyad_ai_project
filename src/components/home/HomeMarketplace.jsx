import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

const PILLS = ["home.studio.logo.title", "home.studio.brand.title", "home.studio.images.title", "home.studio.presentations.title"];

export default function HomeMarketplace() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <section className="eyad-home__market">
      <button
        type="button"
        className="eyad-home__market-card"
        onClick={() => navigate("/studios/marketplace")}
      >
        <img
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=85"
          alt=""
          loading="lazy"
        />
        <div className="eyad-home__market-card-content">
          <strong>{t("home.market.title")}</strong>
          <small>{t("home.market.subtitle")}</small>
          <span className="eyad-home__market-card-link">
            {t("home.studio.enter")} <ArrowLeft className="w-4 h-4" />
          </span>
        </div>
      </button>

      <div className="eyad-home__pills-section">
        <h3 className="eyad-home__pills-title">{t("home.market.idea")}</h3>
        <div className="eyad-home__pills">
          {PILLS.map((pill) => (
            <button
              key={pill}
              type="button"
              className="eyad-home__pill"
              onClick={() => navigate("/studios")}
            >
              {t(pill)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
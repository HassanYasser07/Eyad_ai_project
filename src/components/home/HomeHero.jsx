import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import { useI18n } from "@/i18n/I18nContext";

export default function HomeHero() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <section className="eyad-home__hero">
      <div className="eyad-home__greeting">
        <span className="eyad-home__greeting-icon">
          <Logo variant="icon" className="eyad-home__greeting-logo" />
        </span>
        <span className="eyad-home__greeting-text">{t("home.greeting")}</span>
      </div>

      <h1 className="eyad-home__title">{t("home.title")}</h1>
      <p className="eyad-home__subtitle">{t("home.subtitle")}</p>

      <div className="eyad-home__suggest">
        <p className="eyad-home__suggest-text">
          {t("home.suggestion")}
        </p>
        <div className="eyad-home__suggest-bottom">
          <span className="eyad-home__suggest-icon">
            <Logo variant="icon" className="eyad-home__suggest-logo" />
          </span>
          <button
            type="button"
            className="eyad-home__suggest-btn"
            onClick={() => navigate("/studios")}
          >
            {t("home.startWithEyad")}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="eyad-home__chat"
        onClick={() => navigate("/chat")}
      >
        <span className="eyad-home__chat-icon">
          <Logo variant="icon" className="eyad-home__chat-logo" />
        </span>
        <span className="eyad-home__chat-copy">
          <strong>{t("home.chat.title")}</strong>
          <span>{t("home.chat.placeholder")}</span>
        </span>
        <span className="eyad-home__chat-arrow">
          <ArrowLeft />
        </span>
      </button>
    </section>
  );
}
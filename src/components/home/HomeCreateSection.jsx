import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function HomeCreateSection() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <section className="eyad-home__create">
      <div className="eyad-home__create-strip">
        <span>{t("home.create.export")}</span>
        <span>{t("home.create.identity")}</span>
      </div>

      <h3 className="eyad-home__create-heading">{t("home.create.heading")}</h3>
      <h4 className="eyad-home__create-title">
        {t("home.create.title")}
      </h4>
      <p className="eyad-home__create-desc">
        {t("home.create.desc")}
      </p>

      <div className="eyad-home__create-card">
        <img
          src="https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=85"
          alt=""
          loading="lazy"
        />
        <span className="eyad-home__create-card-shade" />
        <div className="eyad-home__create-card-content">
          <span className="eyad-home__create-badge">{t("home.create.discover")}</span>
          <strong>{t("home.create.cardTitle")}</strong>
          <p>{t("home.create.cardBody")}</p>
          <button
            type="button"
            className="eyad-home__create-card-btn"
            onClick={() => navigate("/studios/brand-kit")}
          >
            {t("home.create.cardAction")} <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
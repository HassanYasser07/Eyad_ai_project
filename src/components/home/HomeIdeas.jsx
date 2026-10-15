import React from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";

const IDEAS = [
  {
    key: "home.ideas.cafe",
    image: null,
  },
  {
    key: "home.ideas.company",
    image:
      "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=85",
  },
  {
    key: "home.ideas.video",
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=85",
  },
];

export default function HomeIdeas() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <section className="eyad-home__ideas">
      {IDEAS.map((idea) => (
        <button
          key={idea.key}
          type="button"
          className="eyad-home__idea-card"
          onClick={() => navigate("/studios")}
        >
          {idea.image && <img src={idea.image} alt="" loading="lazy" />}
          <div className="eyad-home__idea-card-body">
            <strong>{t(idea.key)}</strong>
            <small>{t("home.ideas.use")}</small>
          </div>
        </button>
      ))}
    </section>
  );
}
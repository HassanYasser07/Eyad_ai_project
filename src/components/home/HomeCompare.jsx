import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, MessageCircle, Sparkles, Layers3, Wand2, Palette, Image as ImageIcon, Video, BriefcaseBusiness, Presentation } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { studioRegistry } from "@/studios/studioRegistry";

const rows = [
  ["chat", "home.compare.chat", "home.compare.tradChat"],
  ["context", "home.compare.context", "home.compare.tradContext"],
  ["edit", "home.compare.edit", "home.compare.tradEdit"],
  ["variations", "home.compare.variations", "home.compare.tradVariations"],
  ["studio", "home.compare.studio", "home.compare.tradStudio"],
  ["identity", "home.compare.identity", "home.compare.tradIdentity"],
  ["export", "home.compare.export", "home.compare.tradExport"],
];

const cards = [
  { id: "logo", icon: Palette, image: "https://images.unsplash.com/photo-1626785774573-4b7996242425?auto=format&fit=crop&w=1000&q=85", title: "home.compare.logoTitle", body: "home.compare.logoBody", action: "home.compare.logoAction" },
  { id: "brand-kit", icon: Layers3, image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1000&q=85", title: "home.compare.identityTitle", body: "home.compare.identityBody", action: "home.compare.identityAction" },
  { id: "ai-images", icon: ImageIcon, image: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1000&q=85", title: "home.compare.imageTitle", body: "home.compare.imageBody", action: "home.compare.imageAction" },
  { id: "video", icon: Video, image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1000&q=85", title: "home.compare.videoTitle", body: "home.compare.videoBody", action: "home.compare.videoAction" },
  { id: "company-profile", icon: BriefcaseBusiness, image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85", title: "home.compare.profileTitle", body: "home.compare.profileBody", action: "home.compare.profileAction" },
  { id: "presentations", icon: Presentation, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=85", title: "home.compare.presentationTitle", body: "home.compare.presentationBody", action: "home.compare.presentationAction" },
];

export default function HomeCompare() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const isArabic = document.documentElement.dir === "rtl";

  const goToStudio = (id) => {
    const studio = studioRegistry.find((item) => item.id === id);
    if (studio?.route) navigate(studio.route);
  };

  return (
    <section className="eyad-home__compare" aria-label={t("home.compare.title")}>
      <div className="eyad-home__compare-intro">
        <span className="eyad-home__compare-kicker"><Sparkles size={15} />{t("home.compare.label")}</span>
        <h2>{t("home.compare.title")}</h2>
        <p>{t("home.compare.body")}</p>
      </div>

      <div className="eyad-home__compare-table-wrap">
        <div className="eyad-home__compare-table">
          <div className="eyad-home__compare-head">
            <span>{t("home.compare.feature")}</span>
            <strong>{t("home.compare.eyad")}</strong>
            <span>{t("home.compare.traditional")}</span>
          </div>
          {rows.map(([id, key, traditionalKey]) => (
            <div className="eyad-home__compare-row" key={id}>
              <span className="eyad-home__compare-feature">{t(key)}</span>
              <strong className="eyad-home__compare-yes"><span>✓</span>{t("home.compare.eyad")}</strong>
              <span className="eyad-home__compare-neutral">{t(traditionalKey)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="eyad-home__compare-cta-head">
        <div><span>{t("home.compare.cta")}</span><p>{t("home.compare.ctaBody")}</p></div>
        <Wand2 aria-hidden="true" />
      </div>

      <div className="eyad-home__compare-cards">
        {cards.map(({ id, icon: Icon, image, title, body, action }) => (
          <button key={id} type="button" className="eyad-home__compare-card" onClick={() => goToStudio(id)}>
            <span className="eyad-home__compare-card-media">
              <img src={image} alt="" loading="lazy" />
              <span className="eyad-home__compare-card-icon"><Icon /></span>
            </span>
            <span className="eyad-home__compare-card-title">{t(title)}</span>
            <span className="eyad-home__compare-card-body">{t(body)}</span>
            <span className="eyad-home__compare-card-action">{t(action)}{isArabic ? <ArrowLeft /> : <ArrowRight />}</span>
          </button>
        ))}
      </div>

      <button type="button" className="eyad-home__compare-chat" onClick={() => navigate("/chat")}>
        <span className="eyad-home__compare-chat-icon"><MessageCircle /></span>
        <span className="eyad-home__compare-chat-copy"><strong>{t("home.compare.chatCta")}</strong><span>{t("home.compare.chatBody")}</span></span>
        <span className="eyad-home__compare-chat-arrow">{isArabic ? <ArrowLeft /> : <ArrowRight />}</span>
      </button>
    </section>
  );
}
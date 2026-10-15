import React from "react";
import { Wand2, MessageSquare, Layers, Download } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

const FEATURES = [
  { icon: Wand2, key: "home.feature.idea" },
  { icon: MessageSquare, key: "home.feature.refine" },
  { icon: Layers, key: "home.feature.identity" },
  { icon: Download, key: "home.feature.export" },
];

export default function HomeFeatureBlock() {
  const { t } = useI18n();
  return (
    <section className="eyad-home__feature">
      <span className="eyad-home__feature-label">{t("home.feature.label")}</span>
      <h3 className="eyad-home__feature-title">
        {t("home.feature.title")}
      </h3>
      <p className="eyad-home__feature-body">
        {t("home.feature.body")}
      </p>
      <div className="eyad-home__feature-grid">
        {FEATURES.map(({ icon: Icon, key }) => (
          <div key={key} className="eyad-home__feature-item">
            <Icon />
            <span>{t(key)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
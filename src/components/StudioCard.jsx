/**
 * Studio card — presentational component driven by the Studio Registry.
 * No business logic; receives a studio entry and a localized label helper.
 */
import React from "react";
import { getStudioIcon } from "@/studios/studioIcons";
import { useI18n } from "@/i18n/I18nContext";
import { ArrowUpRight } from "lucide-react";

export default function StudioCard({ studio, onClick }) {
  const { loc, t } = useI18n();
  const Icon = getStudioIcon(studio.icon);
  const isPlaceholder = studio.status === "placeholder";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-start w-full card-glass p-5 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${studio.accent}14` }}
        >
          <Icon className="w-5 h-5" style={{ color: studio.accent }} strokeWidth={2} />
        </div>
        {isPlaceholder && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-highlight-sky text-primary/80">
            {t("studio.badge.placeholder")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-title text-foreground">{loc(studio.name)}</h3>
        <p className="text-sm text-muted-foreground leading-snug">{loc(studio.description)}</p>
      </div>

      <div className="mt-auto flex items-center gap-1 text-primary text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
        <span>{t("cta.create")}</span>
        <ArrowUpRight className="w-4 h-4" />
      </div>
    </button>
  );
}
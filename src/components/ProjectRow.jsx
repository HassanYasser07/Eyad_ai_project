/**
 * Project row — compact list item for a project (Recent Projects rail / list).
 * Presentational only; receives a normalized project and optional studio.
 */
import React from "react";
import { Link } from "react-router-dom";
import StatusPill from "@/components/StatusPill";
import { useI18n } from "@/i18n/I18nContext";
import { getStudioIcon } from "@/studios/studioIcons";
import moment from "moment";

export default function ProjectRow({ project, studio }) {
  const { loc, t, language } = useI18n();
  const Icon = studio ? getStudioIcon(studio.icon) : null;

  return (
    <Link
      to={`/chat?project=${encodeURIComponent(project.id)}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-highlight-mist/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={language === "ar" ? `فتح مشروع ${project.title} في محادثة إياد` : `Open ${project.title} in EYAD chat`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={studio ? { backgroundColor: `${studio.accent}14` } : {}}
      >
        {Icon && <Icon className="w-4 h-4" style={{ color: studio.accent }} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {studio ? loc(studio.name) : t("projects.title")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusPill status={project.status} />
        <span className="text-[11px] text-muted-foreground">
          {moment(project.createdAt).locale(language).fromNow()}
        </span>
      </div>
    </Link>
  );
}
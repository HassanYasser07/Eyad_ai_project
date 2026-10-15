/**
 * Status pill — small presentational badge for project status.
 */
import React from "react";
import { useI18n } from "@/i18n/I18nContext";

const STATUS_STYLES = {
  draft: "bg-highlight-mist text-muted-foreground",
  in_progress: "bg-highlight-sky text-primary",
  completed: "bg-emerald-50 text-emerald-600",
  archived: "bg-slate-100 text-slate-500",
};

export default function StatusPill({ status }) {
  const { t } = useI18n();
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${style}`}>
      {t(`status.${status}`)}
    </span>
  );
}
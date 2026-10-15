/**
 * Projects page — lists all projects via the projectService swap point.
 * Phase 0: read-only list with empty state. Full CRUD comes later.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import ProjectRow from "@/components/ProjectRow";
import { useI18n } from "@/i18n/I18nContext";
import { projectService } from "@/services/projectService";
import { normalizeProject } from "@/models/projectModel";
import { getStudioById } from "@/studios/studioRegistry";

export default function Projects() {
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    projectService
      .list(50)
      .then((rows) => {
        if (!active) return;
        setProjects((rows || []).map(normalizeProject).filter(Boolean));
      })
      .catch(() => active && setProjects([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {t("projects.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("projects.subtitle")}</p>
        </div>
        {!loading && projects.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {t("projects.count", { count: projects.length })}
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : projects.length === 0 ? (
        <div className="card-glass rounded-[var(--radius-card)] p-10 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground max-w-sm">{t("projects.empty")}</p>
          <Link
            to="/studios"
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("cta.start")}
          </Link>
        </div>
      ) : (
        <div className="card-glass rounded-[var(--radius-card)] p-3 flex flex-col gap-1">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              studio={getStudioById(project.studioType)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
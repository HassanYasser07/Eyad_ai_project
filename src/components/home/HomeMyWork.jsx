import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft, X, Trash2 } from "lucide-react";
import { projectService } from "@/services/projectService";
import { normalizeProject } from "@/models/projectModel";
import { useI18n } from "@/i18n/I18nContext";

const TABS = ["home.mywork.tabs.all", "home.mywork.tabs.logos", "home.mywork.tabs.library"];

export default function HomeMyWork() {
  const navigate = useNavigate();
  const { t, loc } = useI18n();
  const [projects, setProjects] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home.mywork.tabs.all");

  useEffect(() => {
    let active = true;
    projectService
      .list(6)
      .then((rows) =>
        active && setProjects((rows || []).map(normalizeProject).filter(Boolean))
      )
      .catch(() => active && setProjects([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const getProjectImage = (project) => {
    const data = project?.data || {};
    const assets = Array.isArray(data.assets) ? [...data.assets].reverse() : [];
    return data.approved_asset?.url || data.approved_asset?.data_url || data.latest_asset_url || data.latest_asset?.url || assets.find((asset) => asset?.url)?.url || assets.find((asset) => asset?.data_url)?.data_url || null;
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await projectService.remove(deleteTarget.id);
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete project", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="eyad-home__mywork">
      <div className="eyad-home__section-head">
        <h2>{t("home.mywork.title")}</h2>
        <Link to="/projects">{t("home.mywork.all")}</Link>
      </div>

      <div className="eyad-home__mywork-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`eyad-home__mywork-tab ${tab === activeTab ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="eyad-home__mywork-empty">
          <div className="eyad-home__mywork-empty-text">{t("common.loading")}</div>
        </div>
      ) : projects.length ? (
        <div className="eyad-home__mywork-grid">
          {projects.map((project) => {
            const image = getProjectImage(project);
            return (
              <article key={project.id} className="eyad-home__project-card" onClick={() => navigate("/chat?project=" + encodeURIComponent(project.id))}>
                <div className="eyad-home__project-card-media">
                  {image ? <img src={image} alt="" /> : <div className="eyad-home__project-card-fallback"><Sparkles /></div>}
                  <button
                    type="button"
                    className="eyad-home__project-card-delete"
                    aria-label={loc({ ar: "حذف المشروع", en: "Delete project" })}
                    onClick={(event) => { event.stopPropagation(); setDeleteTarget(project); }}
                  >
                    <X />
                  </button>
                </div>
                <div className="eyad-home__project-card-body">
                  <strong>{project.title}</strong>
                  <span>{loc({ ar: "فتح المشروع", en: "Open project" })}<ArrowLeft /></span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="eyad-home__mywork-empty">
          <span className="eyad-home__mywork-empty-icon">
            <Sparkles />
          </span>
          <p className="eyad-home__mywork-empty-text">
            {t("home.mywork.empty")}
          </p>
          <button
            type="button"
            className="eyad-home__mywork-empty-btn"
            onClick={() => navigate("/studios")}
          >
            {t("home.mywork.start")} <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {deleteTarget && (
        <div className="eyad-home__delete-overlay" role="dialog" aria-modal="true" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="eyad-home__delete-dialog" onClick={(event) => event.stopPropagation()} dir="rtl">
            <div className="eyad-home__delete-icon"><Trash2 /></div>
            <h3>{loc({ ar: "حذف المشروع؟", en: "Delete project?" })}</h3>
            <p>{loc({ ar: "هل أنت متأكد من حذف «" + deleteTarget.title + "»؟ لا يمكن التراجع عن هذا الإجراء.", en: "Are you sure you want to delete “" + deleteTarget.title + "”? This action cannot be undone." })}</p>
            <div className="eyad-home__delete-actions">
              <button type="button" className="eyad-home__delete-cancel" disabled={deleting} onClick={() => setDeleteTarget(null)}>{loc({ ar: "إلغاء", en: "Cancel" })}</button>
              <button type="button" className="eyad-home__delete-confirm" disabled={deleting} onClick={confirmDelete}>{deleting ? loc({ ar: "جاري الحذف…", en: "Deleting…" }) : loc({ ar: "حذف المشروع", en: "Delete project" })}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
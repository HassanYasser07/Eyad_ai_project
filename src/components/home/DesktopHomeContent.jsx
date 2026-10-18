/**
 * EYAD AI — Desktop Home content (>=1024px only).
 * Hero banner, Quick Create (image cards), Recent Projects, Studio Types (image cards),
 * and the rest of the home sections (marketplace, feature, create, ideas, compare).
 * Reuses existing mobile section components so content stays in sync.
 */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, MessageSquare, Wand2, MoreHorizontal } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { studioRegistry } from "@/studios/studioRegistry";
import { getStudioIcon } from "@/studios/studioIcons";
import { projectService } from "@/services/projectService";
import { normalizeProject } from "@/models/projectModel";
import { STUDIO_VISUALS } from "@/components/home/HomeStudios";
import HomeMarketplace from "@/components/home/HomeMarketplace";
import HomeFeatureBlock from "@/components/home/HomeFeatureBlock";
import HomeCreateSection from "@/components/home/HomeCreateSection";
import HomeIdeas from "@/components/home/HomeIdeas";
import HomeCompare from "@/components/home/HomeCompare";

const HERO_VISUAL =
  "/images/studios/logo-studio.png";

const PASTEL = {
  logo: "#E0F2FE",
  "brand-kit": "#EDE9FE",
  video: "#FEF3C7",
  "ai-images": "#DCFCE7",
  "company-profile": "#FEE2E2",
  presentations: "#E0E7FF",
  templates: "#FCE7F3",
  marketplace: "#F3E8FF",
};

const getProjectImage = (project) => {
  const data = project?.data || project?.project_data || {};
  const assets = Array.isArray(data.assets) ? [...data.assets].reverse() : [];
  return (
    data.approved_asset?.url ||
    data.approved_asset?.data_url ||
    data.latest_asset_url ||
    data.latest_asset?.url ||
    assets.find((a) => a?.url)?.url ||
    assets.find((a) => a?.data_url)?.data_url ||
    null
  );
};

const studioImage = (id) => STUDIO_VISUALS[id]?.image;

export default function DesktopHomeContent() {
  const { t, loc } = useI18n();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    projectService
      .list(8)
      .then((rows) =>
        active && setProjects((rows || []).map(normalizeProject).filter(Boolean))
      )
      .catch(() => active && setProjects([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="eyad-dt-home">
      {/* ── Hero banner ── */}
      <section className="eyad-dt-hero-banner">
        <div className="eyad-dt-hero-banner-content">
          <h1>{t("home.desktop.heroTitle")}</h1>
          <p>{t("home.desktop.heroDesc")}</p>
          <div className="eyad-dt-hero-banner-ctas">
            <button type="button" className="eyad-dt-hero-btn is-primary" onClick={() => navigate("/chat")}>
              <MessageSquare /> {t("home.desktop.heroChat")}
            </button>
            <button type="button" className="eyad-dt-hero-btn is-ghost" onClick={() => navigate("/studios")}>
              <Wand2 /> {t("home.desktop.heroDesign")}
            </button>
          </div>
        </div>
        <div className="eyad-dt-hero-banner-visual">
          <img src={HERO_VISUAL} alt="" />
        </div>
      </section>

      {/* ── Quick Create (image cards) ── */}
      <section className="eyad-dt-section">
        <div className="eyad-dt-section-head">
          <h2>{t("home.desktop.quickCreate")}</h2>
        </div>
        <div className="eyad-dt-quick-row">
          {studioRegistry.slice(0, 5).map((studio) => {
            const img = studioImage(studio.id);
            const Icon = getStudioIcon(studio.icon);
            const bg = PASTEL[studio.id] || "#E0F2FE";
            return (
              <button
                key={studio.id}
                type="button"
                className="eyad-dt-quick-card"
                onClick={() => navigate(studio.route)}
              >
                {img ? (
                  <>
                    <img src={img} alt="" loading="lazy" />
                    <span className="eyad-dt-quick-shade" />
                    <span className="eyad-dt-quick-iconchip" style={{ backgroundColor: bg, color: studio.accent }}>
                      <Icon />
                    </span>
                    <strong>{loc(studio.name)}</strong>
                  </>
                ) : (
                  <>
                    <span className="eyad-dt-quick-fallback" style={{ backgroundColor: bg, color: studio.accent }}>
                      <Icon />
                    </span>
                    <strong>{loc(studio.name)}</strong>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Recent Projects ── */}
      <section className="eyad-dt-section">
        <div className="eyad-dt-section-head">
          <h2>{t("home.desktop.recentProjects")}</h2>
          <Link to="/projects">{t("home.mywork.all")}</Link>
        </div>
        {loading ? (
          <div className="eyad-dt-projects-empty">{t("common.loading")}</div>
        ) : projects.length ? (
          <div className="eyad-dt-projects-grid">
            {projects.map((project) => {
              const image = getProjectImage(project);
              return (
                <article
                  key={project.id}
                  className="eyad-dt-project-card"
                  onClick={() => navigate(`/chat?project=${encodeURIComponent(project.id)}`)}
                >
                  <div className="eyad-dt-project-media">
                    {image ? (
                      <img src={image} alt="" />
                    ) : (
                      <div className="eyad-dt-project-fallback">
                        <Sparkles />
                      </div>
                    )}
                  </div>
                  <div className="eyad-dt-project-body">
                    <strong>{project.title}</strong>
                    <span>{project.studio_type || loc({ ar: "مشروع", en: "Project" })}</span>
                    <button type="button" className="eyad-dt-project-more" aria-label="More">
                      <MoreHorizontal />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="eyad-dt-projects-empty">
            <Sparkles />
            <p>{t("home.projects.empty")}</p>
            <button type="button" onClick={() => navigate("/studios")}>
              {t("home.mywork.start")}
            </button>
          </div>
        )}
      </section>

      {/* ── Available Studios (image cards) ── */}
      <section className="eyad-dt-section">
        <div className="eyad-dt-section-head">
          <h2>{t("home.desktop.studioTypes")}</h2>
        </div>
        <div className="eyad-dt-studio-types">
          {studioRegistry.map((studio) => {
            const img = studioImage(studio.id);
            const Icon = getStudioIcon(studio.icon);
            const bg = PASTEL[studio.id] || "#E0F2FE";
            return (
              <button
                key={studio.id}
                type="button"
                className="eyad-dt-studio-type"
                onClick={() => navigate(studio.route)}
              >
                {img ? (
                  <>
                    <span className="eyad-dt-studio-type-media">
                      <img src={img} alt="" loading="lazy" />
                      <span className="eyad-dt-studio-type-shade" />
                      <span className="eyad-dt-studio-type-iconchip" style={{ backgroundColor: bg, color: studio.accent }}>
                        <Icon />
                      </span>
                    </span>
                    <span className="eyad-dt-studio-type-name">{loc(studio.name)}</span>
                  </>
                ) : (
                  <>
                    <span className="eyad-dt-studio-type-icon" style={{ backgroundColor: bg, color: studio.accent }}>
                      <Icon />
                    </span>
                    <span className="eyad-dt-studio-type-name">{loc(studio.name)}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Rest of the home sections (shared with mobile) ── */}
      <div className="eyad-dt-extra">
        <HomeMarketplace />
        <HomeFeatureBlock />
        <HomeCreateSection />
        <HomeIdeas />
        <HomeCompare />
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon,
  MessageSquare,
  LayoutGrid,
  Folder,
  Search,
  User,
  Mic,
  MoreHorizontal,
  Crown,
  Plus,
  Languages,
  Bell,
  LifeBuoy,
  ChevronDown,
  Sparkles,
  ArrowLeft,
  Wand2,
  Clock3,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { studioRegistry } from "@/studios/studioRegistry";
import { STUDIO_VISUALS } from "@/components/home/HomeStudios";
import { projectService } from "@/services/projectService";
import { normalizeProject } from "@/models/projectModel";
import "./studios.css";

const PRIMARY_NAV = [
  { to: "/home", key: "nav.home", icon: HomeIcon },
  { to: "/chat", key: "nav.chat", icon: MessageSquare },
  { to: "/studios", key: "nav.studios", icon: LayoutGrid },
  { to: "/projects", key: "nav.myprojects", icon: Folder },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/account", key: "nav.myaccount", icon: User },
];

const SECONDARY_NAV = [
  { to: "/chat", key: "nav.voice", icon: Mic },
  { to: "/studios", key: "nav.more", icon: MoreHorizontal },
];

const HERO_VISUAL =
  "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/17181d05c_lOGOSTUDIO.png";

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

export default function Studios() {
  const { t, loc, direction, toggleLanguage } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    projectService
      .list(4)
      .then((rows) => active && setProjects((rows || []).map(normalizeProject).filter(Boolean)))
      .catch(() => active && setProjects([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const profileInitial = (user?.full_name || user?.email || "EYAD").charAt(0).toUpperCase();

  return (
    <div className="eyad-studios-shell" dir="ltr">
      <aside className="eyad-studios-sidebar" dir={direction}>
        <Link to="/home" className="eyad-studios-sidebar-logo" aria-label="EYAD AI">
          <Logo variant="full" className="eyad-studios-logo-img" />
        </Link>

        <nav className="eyad-studios-nav">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`eyad-studios-nav-item ${location.pathname === item.to ? "is-active" : ""}`}
              >
                <Icon />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="eyad-studios-divider" />
        <div className="eyad-studios-label">{t("studios.title")}</div>

        <nav className="eyad-studios-nav">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.key} to={item.to} className="eyad-studios-nav-item">
                <Icon />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <Link to="/account" className="eyad-studios-credits">
          <div className="eyad-studios-credits-head">
            <Crown />
            <span>{t("nav.credits")}</span>
          </div>
          <div className="eyad-studios-credits-body">
            <strong>320</strong>
            <span><Plus /></span>
          </div>
        </Link>

        <div className="eyad-studios-sidebar-footer">
          <Link to="/account" className="eyad-studios-support">
            <LifeBuoy />
            <span>{t("nav.support")}</span>
          </Link>
        </div>
      </aside>

      <div className="eyad-studios-main" dir={direction}>
        <header className="eyad-studios-header">
          <button type="button" className="eyad-studios-search" onClick={() => navigate("/search")}>
            <Search />
            <span>{t("home.desktop.searchPlaceholder")}</span>
          </button>
          <div className="eyad-studios-header-actions">
            <button type="button" className="eyad-studios-header-btn" onClick={toggleLanguage} aria-label="Language">
              <Languages />
              <span>{direction === "rtl" ? "AR" : "EN"}</span>
            </button>
            <button type="button" className="eyad-studios-header-icon" aria-label="Notifications">
              <Bell />
            </button>
            <Link to="/account" className="eyad-studios-profile">
              <span className="eyad-studios-avatar">{profileInitial}</span>
              <span>{user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "EYAD"}</span>
              <ChevronDown />
            </Link>
          </div>
        </header>

        <main className="eyad-studios-content">
          <section className="eyad-studios-intro">
            <div>
              <h1>{loc({ ar: "الاستوديوهات", en: "Studios" })}</h1>
              <p>
                {loc({
                  ar: "اختر الاستوديو المناسب وابدأ في إنشاء محتوى احترافي باستخدام الذكاء الاصطناعي.",
                  en: "Choose the right studio and start creating professional content with AI.",
                })}
              </p>
            </div>
          </section>

          <section className="eyad-studios-hero">
            <div className="eyad-studios-hero-copy">
              <h2>
                {loc({
                  ar: "حوّل أفكارك إلى تصاميم مذهلة مع استوديوهات إياد للذكاء الاصطناعي",
                  en: "Turn your ideas into stunning designs with EYAD AI Studios",
                })}
              </h2>
              <p>
                {loc({
                  ar: "مجموعة متكاملة من الاستوديوهات المتخصصة لإنشاء الشعارات، الهويات البصرية، الصور، الفيديوهات والمزيد.",
                  en: "A complete suite of specialized studios for logos, visual identities, images, video and more.",
                })}
              </p>
              <div className="eyad-studios-hero-actions">
                <button type="button" className="eyad-studios-btn primary" onClick={() => navigate("/chat")}>
                  <Wand2 />
                  {loc({ ar: "ابدأ الإبداع الآن", en: "Start Creating" })}
                </button>
                <button type="button" className="eyad-studios-btn ghost" onClick={() => navigate("/chat")}>
                  <MessageSquare />
                  {loc({ ar: "فتح المحادثة الذكية", en: "Open Smart Chat" })}
                </button>
              </div>
            </div>
            <div className="eyad-studios-hero-visual">
              <img src={HERO_VISUAL} alt="" />
            </div>
          </section>

          <section className="eyad-studios-section">
            <div className="eyad-studios-section-head">
              <div>
                <h2>{loc({ ar: "كل الاستوديوهات", en: "All Studios" })}</h2>
                <p>{loc({ ar: "اختر من بين مجموعة الاستوديوهات المتخصصة وابدأ في إنشاء محتوى مذهل.", en: "Choose from specialized studios and start creating." })}</p>
              </div>
              <button type="button" onClick={() => navigate("/home")}>
                {loc({ ar: "عرض جميع الاستوديوهات", en: "View all studios" })}
                <ArrowLeft />
              </button>
            </div>

            <div className="eyad-studios-grid">
              {studioRegistry.map((studio) => {
                const image = STUDIO_VISUALS[studio.id]?.image;
                const bg = PASTEL[studio.id] || "#E0F2FE";
                return (
                  <button
                    key={studio.id}
                    type="button"
                    className="eyad-studio-tile"
                    onClick={() => navigate(studio.route)}
                  >
                    <span className="eyad-studio-tile-media">
                      {image ? <img src={image} alt="" loading="lazy" /> : <span className="eyad-studio-tile-fallback"><Sparkles /></span>}
                      <span className="eyad-studio-tile-shade" />
                    </span>
                    <span className="eyad-studio-tile-body">
                      <span className="eyad-studio-tile-icon" style={{ backgroundColor: bg, color: studio.accent }}>
                        <Sparkles />
                      </span>
                      <strong>{loc(studio.name)}</strong>
                      <small>{loc(studio.description)}</small>
                      <span className="eyad-studio-tile-arrow"><ArrowLeft /></span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="eyad-studios-section eyad-studios-projects">
            <div className="eyad-studios-section-head">
              <div>
                <h2>{loc({ ar: "مشاريعك الأخيرة", en: "Recent Projects" })}</h2>
                <p>{loc({ ar: "أحدث تصاميمك ومشاريعك", en: "Your latest designs and projects" })}</p>
              </div>
              <Link to="/projects">
                {loc({ ar: "عرض جميع المشاريع", en: "View all projects" })}
                <ArrowLeft />
              </Link>
            </div>

            {loading ? (
              <div className="eyad-studios-projects-empty">{t("common.loading")}</div>
            ) : projects.length ? (
              <div className="eyad-studios-project-grid">
                {projects.map((project) => {
                  const image = getProjectImage(project);
                  return (
                    <button key={project.id} type="button" className="eyad-studio-project" onClick={() => navigate(`/chat?project=${encodeURIComponent(project.id)}`)}>
                      <span className="eyad-studio-project-media">
                        {image ? <img src={image} alt="" /> : <Sparkles />}
                      </span>
                      <span className="eyad-studio-project-body">
                        <strong>{project.title}</strong>
                        <small><Clock3 /> {project.studio_type || loc({ ar: "مشروع", en: "Project" })}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="eyad-studios-projects-empty">
                <Sparkles />
                <p>{loc({ ar: "لا توجد مشاريع حتى الآن.", en: "No projects yet." })}</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

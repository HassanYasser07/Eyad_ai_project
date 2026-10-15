/**
 * EYAD AI — Desktop workspace shell (>=1024px only).
 * Sidebar (left) + header + workspace + right rail. Mobile is untouched.
 * Uses the official Logo component, existing routes, and studioRegistry.
 */
import React from "react";
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
} from "lucide-react";
import Logo from "@/components/Logo";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import DesktopHomeContent from "@/components/home/DesktopHomeContent";
import DesktopRightPanel from "@/components/home/DesktopRightPanel";

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

export default function DesktopShell() {
  const { t, direction, language, toggleLanguage } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (to) => location.pathname === to;
  const profileInitial = (user?.full_name || user?.email || "EYAD").charAt(0).toUpperCase();

  return (
    <div className="eyad-dt-shell" dir="ltr">
      {/* Sidebar — always on the left; inner text follows language direction */}
      <aside className="eyad-dt-sidebar" dir={direction}>
        <Link to="/home" className="eyad-dt-sidebar-logo" aria-label="EYAD AI">
          <Logo variant="full" className="eyad-dt-logo-img" />
        </Link>

        <nav className="eyad-dt-nav">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`eyad-dt-nav-item ${isActive(item.to) ? "is-active" : ""}`}
              >
                <Icon className="eyad-dt-nav-icon" />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="eyad-dt-separator" />

        <div className="eyad-dt-section-label">{t("studios.title")}</div>
        <nav className="eyad-dt-nav">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`eyad-dt-nav-item ${isActive(item.to) ? "is-active" : ""}`}
              >
                <Icon className="eyad-dt-nav-icon" />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <Link to="/account" className="eyad-dt-credits">
          <div className="eyad-dt-credits-head">
            <Crown className="eyad-dt-credits-icon" />
            <span>{t("nav.credits")}</span>
          </div>
          <div className="eyad-dt-credits-body">
            <strong>320</strong>
            <span className="eyad-dt-credits-add" aria-label={t("nav.credits.add")}>
              <Plus />
            </span>
          </div>
        </Link>

        <div className="eyad-dt-sidebar-footer">
          <Link to="/account" className="eyad-dt-foot-btn">
            <LifeBuoy className="eyad-dt-foot-icon" />
            <span>{t("nav.support")}</span>
          </Link>
        </div>
      </aside>

      {/* Main area — header + scrollable content */}
      <div className="eyad-dt-main" dir={direction}>
        <header className="eyad-dt-header">
          <button
            type="button"
            className="eyad-dt-search"
            onClick={() => navigate("/search")}
          >
            <Search className="eyad-dt-search-icon" />
            <span>{t("home.desktop.searchPlaceholder")}</span>
          </button>
          <div className="eyad-dt-header-actions">
            <button type="button" className="eyad-dt-header-btn" onClick={toggleLanguage} aria-label="Language">
              <Languages />
            </button>
            <button type="button" className="eyad-dt-header-btn" aria-label="Notifications">
              <Bell />
            </button>
            <Link to="/account" className="eyad-dt-profile-btn" aria-label={t("nav.myaccount")}>
              <span className="eyad-dt-profile-avatar">{profileInitial}</span>
              <span className="eyad-dt-profile-name">{user?.full_name?.split(" ")[0] || (user?.email?.split("@")[0]) || "EYAD"}</span>
              <ChevronDown className="eyad-dt-profile-chevron" />
            </Link>
          </div>
        </header>

        <div className="eyad-dt-content">
          <div className="eyad-dt-workspace">
            <DesktopHomeContent />
          </div>
          <aside className="eyad-dt-rail">
            <DesktopRightPanel />
          </aside>
        </div>
      </div>
    </div>
  );
}
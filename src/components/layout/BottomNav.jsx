import React from "react";
import { Home, Search, Plus, Folder, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nContext";

const ITEMS = [
  { to: "/home", key: "nav.home", icon: Home },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/chat", key: "cta.create", icon: Plus, create: true },
  { to: "/projects", key: "nav.projects", icon: Folder },
  { to: "/account", key: "nav.account", icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const { t } = useI18n();
  if (location.pathname === "/chat") return null;
  return (
    <nav className="eyad-bottom-nav md:hidden">
      {ITEMS.map(({ to, key, icon: Icon, create }) => {
        const active = location.pathname === to || (to === "/studios" && location.pathname.startsWith("/studios/"));
        return (
          <Link key={key} to={to} className={cn("eyad-bottom-nav__item", create && "is-create", active && "is-active")}>
            <span><Icon /></span>
            <small>{t(key)}</small>
          </Link>
        );
      })}
    </nav>
  );
}

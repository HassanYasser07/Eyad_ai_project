/**
 * Desktop floating top navigation rail (frosted glass).
 * Visible from md breakpoint up. Includes branding, primary nav links,
 * language toggle, and account trigger.
 */
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Folder, User, Languages } from "lucide-react";
import Logo from "@/components/Logo";
import { useI18n } from "@/i18n/I18nContext";
import { NAV_ITEMS } from "@/components/layout/navItems";
import { cn } from "@/lib/utils";

const ICONS = { Home: LayoutGrid, LayoutGrid, Folder, User };

export default function TopNav() {
  const { t, toggleLanguage, language } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <header className="hidden md:flex fixed top-4 inset-x-0 z-40 px-4">
      <div className="mx-auto w-full max-w-7xl glass rounded-2xl shadow-soft px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <Logo variant="icon" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-heading font-extrabold text-lg tracking-tight text-foreground">
            EYAD <span className="text-primary">AI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative px-3.5 h-10 inline-flex items-center gap-2 rounded-xl text-sm font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{t(item.key)}</span>
                {active && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-primary/80" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleLanguage}
            className="h-10 px-3 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-highlight-mist transition-colors"
          >
            <Languages className="w-4 h-4" />
            <span>{language === "ar" ? "EN" : "Ar"}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/account")}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-highlight-sky text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
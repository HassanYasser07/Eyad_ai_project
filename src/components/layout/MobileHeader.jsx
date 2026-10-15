import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";

export default function MobileHeader() {
  const { language, toggleLanguage, t } = useI18n();
  const { user, isLoadingAuth, authChecked } = useAuth();
  const isLoggedIn =
    authChecked &&
    !isLoadingAuth &&
    Boolean(user?.email) &&
    !user?.is_anonymous;
  return (
    <header className="eyad-mobile-header md:hidden">
      <Link to="/home" className="eyad-mobile-header__logo" aria-label="EYAD AI">
        <Logo variant="full" className="h-10 w-[150px] object-contain" />
      </Link>
      <div className="eyad-mobile-header__actions">
        <button type="button" onClick={toggleLanguage} className="eyad-mobile-header__lang">{language === "ar" ? "EN" : "Ar"}</button>
        <Link to={isLoggedIn ? "/account" : "/login"} className="eyad-mobile-header__login">{isLoggedIn ? t("nav.account") : t("auth.login")}</Link>
      </div>
    </header>
  );
}
/**
 * EYAD AI — Internationalization context (Arabic + English, RTL/LTR).
 *
 * Provides: current language, text direction, t(key, vars) translator,
 * and setLanguage/toggleLanguage. Persists choice in localStorage and
 * reflects <html lang> + <html dir> so the whole app reflows correctly.
 *
 * This module is framework-agnostic React (no Base44 imports) and can be
 * reused outside Base44 unchanged.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { translations } from "./translations";
import { appConfig } from "@/config/app.config";

const STORAGE_KEY = "eyad.language";

const I18nContext = createContext(null);

const getDirection = (lang) => (lang === "ar" ? "rtl" : "ltr");

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === "undefined") return appConfig.defaultLanguage;
    return localStorage.getItem(STORAGE_KEY) || appConfig.defaultLanguage;
  });

  const direction = getDirection(language);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = getDirection(language);
  }, [language]);

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = translations[language] || translations.en;
      let value = dict[key] ?? translations.en[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          value = value.replace(`{${k}}`, String(v));
        });
      }
      return value;
    },
    [language]
  );

  // Helper to pull a localized field from registry objects ({ en, ar }).
  const loc = useCallback(
    (field) => (field ? field[language] || field.en : ""),
    [language]
  );

  const value = useMemo(
    () => ({ language, direction, t, loc, setLanguage, toggleLanguage }),
    [language, direction, t, loc, setLanguage, toggleLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

export default I18nContext;
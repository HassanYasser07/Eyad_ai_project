import React from "react";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import useIconLibrary from "@/hooks/useIconLibrary";
import "./iconLibraryPicker.css";

/**
 * Icon library browser shared by the logo editor and the presentation editor.
 * Category tabs on top; the selected category's icons (or search results across all categories) below.
 * `onSelect(icon)` may be async; the picker shows a busy state while it runs.
 */
export default function IconLibraryPicker({ onSelect, disabled = false }) {
  const { t } = useI18n();
  const { categories, loading, error, reload } = useIconLibrary(true);
  const [activeId, setActiveId] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [pendingId, setPendingId] = React.useState(null);

  const active = categories.find((category) => category.id === activeId) || categories[0] || null;
  const needle = query.trim().toLowerCase();
  const icons = React.useMemo(() => {
    if (!needle) return active?.icons || [];
    return categories.flatMap((category) => category.icons.filter((icon) => `${icon.name} ${category.name}`.toLowerCase().includes(needle)));
  }, [needle, active, categories]);

  const choose = async (icon) => {
    if (disabled || pendingId) return;
    setPendingId(icon.id);
    try { await onSelect(icon); } finally { setPendingId(null); }
  };

  if (loading) return <div className="icon-library-state" role="status"><Loader2 size={22} className="animate-spin" aria-hidden="true" /><span>{t("iconLibrary.loading")}</span></div>;
  if (error) return (
    <div className="icon-library-state" role="alert">
      <span>{t("iconLibrary.loadFailed")}</span>
      <button type="button" className="icon-library-retry" onClick={reload}><RefreshCw size={14} aria-hidden="true" />{t("iconLibrary.retry")}</button>
    </div>
  );
  if (!categories.length) return <div className="icon-library-state"><span>{t("iconLibrary.empty")}</span></div>;

  return (
    <div className="icon-library">
      <label className="icon-library-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("iconLibrary.search")} aria-label={t("iconLibrary.search")} />
      </label>
      {!needle && (
        <div className="icon-library-tabs" role="tablist" aria-label={t("iconLibrary.categories")}>
          {categories.map((category) => (
            <button key={category.id} type="button" role="tab" aria-selected={active?.id === category.id} className={`icon-library-tab ${active?.id === category.id ? "is-active" : ""}`} onClick={() => setActiveId(category.id)}>
              {category.name}<small>{category.icons.length}</small>
            </button>
          ))}
        </div>
      )}
      <div className="icon-library-grid" role="list" aria-busy={Boolean(pendingId)}>
        {icons.map((icon) => (
          <button key={icon.id} type="button" role="listitem" className={`icon-library-item ${pendingId === icon.id ? "is-pending" : ""}`} onClick={() => choose(icon)} disabled={disabled || Boolean(pendingId)} title={icon.name} aria-label={icon.name}>
            <img src={icon.url} alt="" loading="lazy" decoding="async" draggable="false" />
            {pendingId === icon.id && <span className="icon-library-spinner"><Loader2 size={18} className="animate-spin" aria-hidden="true" /></span>}
          </button>
        ))}
        {!icons.length && <p className="icon-library-none">{t("iconLibrary.noResults")}</p>}
      </div>
    </div>
  );
}

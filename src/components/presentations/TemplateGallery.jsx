
import React from "react";
import { Check, Layers, Loader2, Presentation, RefreshCw } from "lucide-react";
import { fetchTemplateGallery } from "@/services/templateService";

const ALL = "all";
// Loaded on demand: pulls in the pptx renderer only when a template has a .pptx and no thumbnail image.
const TemplateThumbnail = React.lazy(() => import("./TemplateThumbnail"));

/** Placeholder art for templates without a thumbnail: gradient from the row's own accent colors. */
function placeholderStyle(template) {
  const [a, b] = Array.isArray(template.accent_colors) ? template.accent_colors : [];
  if (!a) return undefined;
  return { backgroundImage: `linear-gradient(135deg, ${a}, ${b || a})` };
}

/** Display only the slide count number. */
function slidesLabel(n) {
  return String(n);
}

function TemplateCard({ template, selected, opening, disabled, onSelect, loc }) {
  const title = loc({ ar: template.title_ar, en: template.title_en });
  const [deckCount, setDeckCount] = React.useState(0);
  const slideCount = deckCount || template.slide_count || 0;
  const placeholder = (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-muted to-accent" style={placeholderStyle(template)} aria-hidden="true">
      <Presentation className="h-8 w-8 text-white/70 drop-shadow-sm" />
    </span>
  );
  return (
    <li>
      <button
        type="button" aria-pressed={selected} aria-busy={opening} disabled={disabled} data-testid={`template-${template.id}`} onClick={() => onSelect(template)}
        className="group block w-full text-start focus-visible:outline-none disabled:cursor-wait"
      >
        <span className={`relative block aspect-[16/9] overflow-hidden rounded-2xl border bg-muted transition-all group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background ${selected ? "border-primary ring-2 ring-primary" : "border-border"}`}>
          {template.thumbnail_url ? (
            <img src={template.thumbnail_url} alt={title} loading="lazy" className="h-full w-full object-cover" />
          ) : template.pptx_path ? (
            <React.Suspense fallback={placeholder}>
              <TemplateThumbnail template={template} title={title} fallback={placeholder} onSlideCount={setDeckCount} />
            </React.Suspense>
          ) : placeholder}
          {slideCount > 0 && (
            <span data-testid="template-slide-count" className="absolute bottom-2 end-2 inline-flex items-center gap-1.5 rounded-full bg-black/65 py-1 ps-2 pe-2.5 text-[11px] font-bold leading-none text-white shadow-sm ring-1 ring-white/15 backdrop-blur-sm">
              <Layers className="h-3 w-3" aria-hidden="true" />
              <span>{slidesLabel(slideCount)}</span>
            </span>
          )}
          {opening && (
            <span role="status" aria-label={loc({ ar: "جاري فتح القالب", en: "Opening template" })} className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" /></span>
          )}
          {selected && (
            <span className="absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
          )}
        </span>
        <span className="mt-2 block truncate text-sm font-semibold text-foreground" dir="auto">{title}</span>
      </button>
    </li>
  );
}

/**
 * "Templates" section under the prompt box: an "All" tab plus one tab per category.
 * Data comes from Supabase (presentation_template_categories / presentation_templates).
 */
export default function TemplateGallery({ selectedId, onSelect, openingId = null, error = "", loc }) {
  const [state, setState] = React.useState({ status: "loading", categories: [], templates: [] });
  const [category, setCategory] = React.useState(ALL);

  const load = React.useCallback(() => {
    let active = true;
    setState((prev) => ({ ...prev, status: "loading" }));
    fetchTemplateGallery()
      .then((data) => { if (active) setState({ status: "ready", ...data }); })
      .catch((error) => { console.warn("Could not load presentation templates", error?.message); if (active) setState((prev) => ({ ...prev, status: "error" })); });
    return () => { active = false; };
  }, []);
  React.useEffect(() => load(), [load]);

  const visible = category === ALL ? state.templates : state.templates.filter((template) => template.category_id === category);
  const tabClass = (on) => `shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

  const onTabKeyDown = (event) => {
    const keys = [ALL, ...state.categories.map((c) => c.id)];
    const rtl = document.documentElement.dir === "rtl";
    const step = event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    if (!step) return;
    event.preventDefault();
    const next = keys[(keys.indexOf(category) + step + keys.length) % keys.length];
    setCategory(next);
    event.currentTarget.parentElement?.querySelector(`[data-tab="${next}"]`)?.focus();
  };

  return (
    <section aria-labelledby="templates-title" data-testid="template-gallery" className="mt-6">
      <h2 id="templates-title" className="text-xl font-black text-foreground">{loc({ ar: "القوالب", en: "Templates" })}</h2>

      <div role="tablist" aria-label={loc({ ar: "تصنيفات القوالب", en: "Template categories" })} className="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1 pb-2" onKeyDown={onTabKeyDown}>
        <button type="button" role="tab" data-tab={ALL} aria-selected={category === ALL} tabIndex={category === ALL ? 0 : -1} onClick={() => setCategory(ALL)} className={tabClass(category === ALL)}>
          {loc({ ar: "الكل", en: "All" })}
        </button>
        {state.categories.map((item) => (
          <button key={item.id} type="button" role="tab" data-tab={item.id} data-testid={`template-category-${item.slug}`} aria-selected={category === item.id} tabIndex={category === item.id ? 0 : -1} onClick={() => setCategory(item.id)} className={tabClass(category === item.id)}>
            {loc({ ar: item.name_ar, en: item.name_en })}
          </button>
        ))}
      </div>

      {error && <p role="alert" data-testid="template-open-error" className="mt-2 text-sm font-bold text-destructive">{error}</p>}

      <div className="mt-4">
        {state.status === "loading" && state.templates.length === 0 && (
          <div role="status" aria-label={loc({ ar: "جاري تحميل القوالب", en: "Loading templates" })} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />)}
          </div>
        )}
        {state.status === "error" && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{loc({ ar: "تعذّر تحميل القوالب.", en: "Could not load templates." })}</p>
            <button type="button" onClick={load} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />{loc({ ar: "إعادة المحاولة", en: "Try again" })}
            </button>
          </div>
        )}
        {state.status === "ready" && visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{loc({ ar: "لا توجد قوالب في هذا التصنيف بعد.", en: "No templates in this category yet." })}</p>
        )}
        {visible.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-5">
            {visible.map((template) => (
              <TemplateCard key={template.id} template={template} selected={template.id === selectedId} opening={template.id === openingId} disabled={Boolean(openingId)} onSelect={onSelect} loc={loc} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

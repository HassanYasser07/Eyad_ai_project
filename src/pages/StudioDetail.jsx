/**
 * Studio detail — Phase 0 placeholder for a single studio.
 * Looks up the studio by id from the centralized Studio Registry and shows
 * a structural placeholder. Full studio functionality is deferred to later
 * phases; this route exists so navigation is complete and stable now.
 */
import React from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { getStudioById } from "@/studios/studioRegistry";
import { getStudioIcon } from "@/studios/studioIcons";
import { projectService } from "@/services/projectService";

export default function StudioDetail() {
  const { id } = useParams();
  const { t, loc, direction } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studio = getStudioById(id);
  const projectId = searchParams.get("project");
  const assetId = searchParams.get("asset");
  const [project, setProject] = React.useState(null);
  const [asset, setAsset] = React.useState(null);
  const [loadingProject, setLoadingProject] = React.useState(Boolean(projectId));

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    projectService.get(projectId).then((data) => {
      if (!active) return;
      setProject(data);
      const latestId = assetId && assetId !== "latest" ? assetId : data?.project_data?.latest_asset_id;
      const latestUrl = data?.project_data?.latest_asset_url;
      if (latestId || latestUrl) setAsset({ id: latestId || null, url: latestUrl || null });
    }).catch(() => {
      if (active) setProject(null);
    }).finally(() => {
      if (active) setLoadingProject(false);
    });
    return () => { active = false; };
  }, [projectId]);

  if (!studio) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">Studio not found.</p>
        <Link to="/studios" className="text-primary font-semibold">
          {t("studios.title")}
        </Link>
      </div>
    );
  }

  const Icon = getStudioIcon(studio.icon);
  const Back = direction === "rtl" ? ArrowLeft : ArrowLeft;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <button
        type="button"
        onClick={() => navigate("/studios")}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground w-fit"
      >
        <Back className="w-4 h-4" />
        {t("studios.title")}
      </button>

      <div className="card-glass rounded-[var(--radius-xl)] p-8 flex flex-col gap-5">
        {projectId && (
          <div className="rounded-2xl border border-primary/10 bg-highlight-sky/30 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary/70">EYAD HANDOFF</p>
                <p className="text-sm font-semibold text-foreground">{loadingProject ? "Loading project context…" : project?.title || "Project context"}</p>
              </div>
              <Link to={`/chat?project=${encodeURIComponent(projectId)}`} className="text-xs font-bold text-primary hover:underline">
                {loc({ en: "Back to EYAD", ar: "العودة إلى إياد" })}
              </Link>
            </div>
            {asset?.url ? (
              <div className="rounded-2xl bg-white/80 border border-white/80 p-3 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  {loc({ en: "Asset transferred from EYAD", ar: "الأصل تم نقله من إياد" })}
                </div>
                <img src={asset.url} alt={loc({ en: "Asset transferred from EYAD", ar: "الأصل المنقول من إياد" })} className="w-full max-h-72 object-contain rounded-xl" />
                {asset.id && <p className="text-[10px] text-muted-foreground break-all">Asset ID: {asset.id}</p>}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-primary/15 p-6 flex flex-col items-center gap-2 text-center">
                <ImageIcon className="w-5 h-5 text-primary/60" />
                <p className="text-xs text-muted-foreground">{loc({ en: "No asset is attached to this handoff yet.", ar: "لا يوجد أصل مرتبط بهذه النقلة حتى الآن." })}</p>
              </div>
            )}
          </div>
        )}
        {projectId && asset?.url && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {loc({ en: "Asset ready for this studio", ar: "الأصل جاهز لهذا الاستوديو" })}
            </span>
            <Link to={`/chat?project=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold text-primary hover:bg-highlight-sky/30">
              <ExternalLink className="w-3.5 h-3.5" />
              {loc({ en: "Continue with EYAD", ar: "استكمال مع إياد" })}
            </Link>
          </div>
        )}

        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${studio.accent}14` }}
        >
          <Icon className="w-6 h-6" style={{ color: studio.accent }} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {loc(studio.name)}
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-highlight-sky text-primary/80">
              {t("studio.badge.placeholder")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg">{loc(studio.description)}</p>
        </div>

        <div className="rounded-2xl border border-dashed border-border p-10 flex flex-col items-center gap-3 text-center bg-highlight-mist/40">
          <Sparkles className="w-6 h-6 text-primary/60" />
          <p className="text-sm text-muted-foreground max-w-sm">
            {t("studio.status.placeholder")} — EYAD AI · Phase 0
          </p>
        </div>
      </div>
    </div>
  );
}
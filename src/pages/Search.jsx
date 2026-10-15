import React from "react";
import {
  Search as SearchIcon, X, Shapes, Image, Video, Presentation,
  Palette, BriefcaseBusiness, Store, Folder, MessageSquare, FileImage
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { studioRegistry } from "@/studios/studioRegistry";
import { supabase } from "@/lib/supabase";
import "./search.css";

const studioIconMap = {
  logo: Shapes,
  "ai-images": Image,
  video: Video,
  presentations: Presentation,
  "brand-kit": Palette,
  "company-profile": BriefcaseBusiness,
  marketplace: Store,
};

const studioAccent = {
  logo: "#9b5de5",
  "ai-images": "#f5b52e",
  video: "#ef6b6b",
  presentations: "#4d8df7",
  "brand-kit": "#7c7ee8",
  "company-profile": "#5ab9aa",
  marketplace: "#f5a623",
};

function normalize(value) {
  return String(value || "").toLocaleLowerCase();
}

function matches(query, ...values) {
  const q = normalize(query).trim();
  return !q || values.some((value) => normalize(value).includes(q));
}

function studioLabel(studio, ar) {
  return ar ? studio.name?.ar : studio.name?.en;
}

export default function SearchPage() {
  const { direction } = useI18n();
  const navigate = useNavigate();
  const ar = direction === "rtl";

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const loadResults = React.useCallback(async (value) => {
    const q = value.trim();

    if (!q) {
      setResults(
        studioRegistry.map((studio) => ({
          type: "studio",
          id: studio.id,
          title: studioLabel(studio, ar),
          description: ar ? studio.description?.ar : studio.description?.en,
          route: studio.route,
          icon: studio.id,
        }))
      );
      return;
    }

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setResults([]);
        return;
      }

      const [{ data: projects }, { data: conversations }, { data: messages }, { data: assets }] =
        await Promise.all([
          supabase.from("projects").select("id,name,description,studio_type,status,updated_at")
            .eq("owner_id", userId).order("updated_at", { ascending: false }).limit(60),
          supabase.from("conversations").select("id,project_id,title,updated_at")
            .eq("owner_id", userId).order("updated_at", { ascending: false }).limit(60),
          supabase.from("messages").select("id,conversation_id,content,role,created_at")
            .eq("owner_id", userId).order("created_at", { ascending: false }).limit(100),
          supabase.from("assets").select("id,project_id,name,kind,metadata,created_at")
            .eq("owner_id", userId).order("created_at", { ascending: false }).limit(60),
        ]);

      const projectMap = new Map((projects || []).map((p) => [p.id, p]));
      const conversationMap = new Map((conversations || []).map((c) => [c.id, c]));
      const found = [];

      studioRegistry.forEach((studio) => {
        if (matches(q, studio.id, studio.name?.ar, studio.name?.en, studio.description?.ar, studio.description?.en)) {
          found.push({
            type: "studio",
            id: studio.id,
            title: studioLabel(studio, ar),
            description: ar ? studio.description?.ar : studio.description?.en,
            route: studio.route,
            icon: studio.id,
          });
        }
      });

      (projects || []).forEach((project) => {
        if (matches(q, project.name, project.description, project.studio_type, project.status)) {
          found.push({
            type: "project",
            id: project.id,
            title: project.name,
            description: project.description || (ar ? "مشروع داخل أعمالك" : "Project in your workspace"),
            route: `/chat?project=${encodeURIComponent(project.id)}`,
            icon: "project",
          });
        }
      });

      (conversations || []).forEach((conversation) => {
        if (matches(q, conversation.title)) {
          const project = projectMap.get(conversation.project_id);
          found.push({
            type: "conversation",
            id: conversation.id,
            title: conversation.title || (ar ? "محادثة إياد" : "EYAD conversation"),
            description: project?.name || (ar ? "محادثة" : "Conversation"),
            route: project?.id ? `/chat?project=${encodeURIComponent(project.id)}` : "/chat",
            icon: "conversation",
          });
        }
      });

      (messages || []).forEach((message) => {
        if (!matches(q, message.content)) return;
        const conversation = conversationMap.get(message.conversation_id);
        const project = conversation ? projectMap.get(conversation.project_id) : null;
        const preview = String(message.content || "").replace(/\s+/g, " ").trim().slice(0, 110);
        found.push({
          type: "message",
          id: message.id,
          title: project?.name || conversation?.title || (ar ? "رسالة" : "Message"),
          description: preview,
          route: project?.id ? `/chat?project=${encodeURIComponent(project.id)}` : "/chat",
          icon: "message",
        });
      });

      (assets || []).forEach((asset) => {
        const metadataText = asset.metadata ? JSON.stringify(asset.metadata) : "";
        if (!matches(q, asset.name, asset.kind, metadataText)) return;
        const project = projectMap.get(asset.project_id);
        found.push({
          type: "asset",
          id: asset.id,
          title: asset.name || (ar ? "ملف إبداعي" : "Creative asset"),
          description: project?.name || asset.kind || (ar ? "أصل إبداعي" : "Creative asset"),
          route: project?.id ? `/chat?project=${encodeURIComponent(project.id)}` : "/projects",
          icon: "asset",
        });
      });

      setResults(found.slice(0, 40));
    } catch (error) {
      console.error("[EYAD Search] failed", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [ar]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => loadResults(query), query.trim() ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [query, loadResults]);

  const close = () => navigate(-1);

  return (
    <div className="eyad-search-overlay" role="dialog" aria-modal="true" aria-label={ar ? "بحث EYAD" : "EYAD Search"}>
      <button className="eyad-search-backdrop" aria-label={ar ? "إغلاق البحث" : "Close search"} onClick={close} />

      <section className="eyad-search-panel" dir={ar ? "rtl" : "ltr"}>
        <div className="eyad-search-top">
          <button type="button" onClick={close} className="eyad-search-close" aria-label={ar ? "إغلاق" : "Close"}>
            <X />
          </button>

          <div className="eyad-search-input-wrap">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "اسأل إياد أي شيء، أو ابدأ الإبداع..." : "Ask EYAD anything, or start creating..."}
            />
            <SearchIcon className="eyad-search-input-icon" />
          </div>
        </div>

        <div className="eyad-search-scroll">
          <div className="eyad-search-heading">
            <h2>{query.trim() ? (ar ? "نتائج البحث" : "Search results") : (ar ? "الاستوديوهات" : "Studios")}</h2>
            {loading && <span className="eyad-search-loading">{ar ? "جاري البحث…" : "Searching…"}</span>}
          </div>

          <div className="eyad-search-results">
            {results.map((item) => {
              const Icon = item.type === "studio"
                ? (studioIconMap[item.icon] || Shapes)
                : item.type === "project"
                  ? Folder
                  : item.type === "conversation"
                    ? MessageSquare
                    : item.type === "asset"
                      ? FileImage
                      : MessageSquare;
              const accent = item.type === "studio" ? (studioAccent[item.icon] || "#4d8df7") : "#4d8df7";

              return (
                <button key={`${item.type}-${item.id}`} type="button" className="eyad-search-result" onClick={() => navigate(item.route)}>
                  <span className="eyad-search-result-icon" style={{ "--search-accent": accent }}>
                    <Icon />
                  </span>
                  <span className="eyad-search-result-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  {item.type === "studio" && <span className="eyad-search-result-action">{ar ? "استوديو" : "Studio"}</span>}
                </button>
              );
            })}

            {!loading && !results.length && (
              <div className="eyad-search-empty">
                {ar ? "لا توجد نتائج مطابقة." : "No matching results."}
              </div>
            )}
          </div>
        </div>

        <div className="eyad-search-hints">
          <span><kbd>Enter</kbd> {ar ? "فتح" : "Open"}</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> {ar ? "للتنقل" : "Navigate"}</span>
          <span><kbd>Esc</kbd> {ar ? "إغلاق" : "Close"}</span>
        </div>
      </section>
    </div>
  );
}

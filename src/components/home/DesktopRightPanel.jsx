/**
 * EYAD AI — Desktop right utility rail (>=1280px only).
 * Smart Chat card, Ready Templates thumbnails, and Useful Tools list.
 * All links route to existing EYAD pages — no fake destinations.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronRight, Scissors, Sparkles, Maximize2, FileCode } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import Logo from "@/components/Logo";

const TEMPLATE_THUMBS = [
  "https://media.base44.com/images/public/6aaccb85de3f09bc7bd4646f/938a9d9f7_vISUALIDENTITY.png",
  "https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=400&q=80",
];

const TOOLS = [
  { key: "home.desktop.right.tool.removeBg", icon: Scissors, to: "/studios/ai-images" },
  { key: "home.desktop.right.tool.enhance", icon: Sparkles, to: "/studios/ai-images" },
  { key: "home.desktop.right.tool.resize", icon: Maximize2, to: "/studios/ai-images" },
  { key: "home.desktop.right.tool.convert", icon: FileCode, to: "/studios/ai-images" },
];

export default function DesktopRightPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="eyad-dt-rail-content">
      {/* Smart Chat */}
      <div className="eyad-dt-rail-card eyad-dt-rail-chat">
        <div className="eyad-dt-rail-chat-head">
          <span className="eyad-dt-rail-chat-icon">
            <Logo variant="icon" className="eyad-dt-rail-chat-logo" />
          </span>
          <div>
            <strong>{t("home.desktop.right.chat")}</strong>
            <small>{t("home.desktop.right.chatDesc")}</small>
          </div>
        </div>
        <button
          type="button"
          className="eyad-dt-rail-chat-btn"
          onClick={() => navigate("/chat")}
        >
          <MessageSquare /> {t("home.desktop.right.startChat")}
        </button>
      </div>

      {/* Ready Templates */}
      <div className="eyad-dt-rail-card">
        <div className="eyad-dt-rail-card-head">
          <strong>{t("home.desktop.right.templates")}</strong>
          <button type="button" onClick={() => navigate("/studios/templates")}>
            {t("home.desktop.right.viewAll")}
          </button>
        </div>
        <div className="eyad-dt-rail-templates">
          {TEMPLATE_THUMBS.map((thumb, i) => (
            <button
              key={i}
              type="button"
              className="eyad-dt-rail-template-thumb"
              onClick={() => navigate("/studios/templates")}
            >
              <img src={thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      {/* Useful Tools */}
      <div className="eyad-dt-rail-card">
        <div className="eyad-dt-rail-card-head">
          <strong>{t("home.desktop.right.tools")}</strong>
        </div>
        <div className="eyad-dt-rail-tools">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.key}
                type="button"
                className="eyad-dt-rail-tool"
                onClick={() => navigate(tool.to)}
              >
                <span className="eyad-dt-rail-tool-icon">
                  <Icon />
                </span>
                <span>{t(tool.key)}</span>
                <ChevronRight className="eyad-dt-rail-tool-arrow" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
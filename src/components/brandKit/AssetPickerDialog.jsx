/**
 * "My Images" picker — lets the user choose any image asset they own (across
 * all their projects) to use as the approved brand logo.
 */
import React from "react";
import { createPortal } from "react-dom";
import { Check, ImageOff, Images, Loader2, X } from "lucide-react";
import { assetService } from "@/services/assetService";

const FILTERS = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "logo", ar: "الشعارات", en: "Logos" },
  { id: "image", ar: "الصور", en: "Images" },
  { id: "mockup", ar: "الموك أب", en: "Mockups" },
];

function matchesFilter(asset, filter) {
  if (filter === "all") return true;
  const kind = String(asset.kind || "").toLowerCase();
  const source = String(asset.metadata?.source || "").toLowerCase();
  if (filter === "logo") return kind === "logo";
  if (filter === "mockup") return source.includes("mockup") || kind === "mockup";
  return kind !== "logo" && !source.includes("mockup") && kind !== "mockup";
}

export default function AssetPickerDialog({ open, onClose, onSelect, ar }) {
  const [assets, setAssets] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState(null);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setSelectedId(null);
    setFilter("all");
    assetService.listUserImages()
      .then((items) => { if (active) setAssets(items); })
      .catch(() => { if (active) setError(ar ? "تعذر تحميل صورك. حاول مرة أخرى." : "Could not load your images. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, ar]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape" && !confirming) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirming]);

  const visible = React.useMemo(() => assets.filter((asset) => matchesFilter(asset, filter)), [assets, filter]);
  const selected = assets.find((asset) => asset.id === selectedId) || null;

  const confirm = async () => {
    if (!selected || confirming) return;
    setConfirming(true);
    setError("");
    try {
      await onSelect?.(selected);
      onClose?.();
    } catch {
      setError(ar ? "تعذر استخدام هذه الصورة كشعار. حاول مرة أخرى." : "Could not use this image as your logo. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="vi-asset-backdrop" role="dialog" aria-modal="true" aria-label={ar ? "صوري" : "My images"} onMouseDown={(e) => { if (e.target === e.currentTarget && !confirming) onClose?.(); }}>
      <div className="vi-asset-modal" dir={ar ? "rtl" : "ltr"}>
        <div className="vi-asset-head">
          <div>
            <strong>{ar ? "اختر من صور مشروعاتك" : "Choose from your images"}</strong>
            <span>{ar ? "كل الصور المحفوظة في حسابك" : "Every image saved in your account"}</span>
          </div>
          <button type="button" className="vi-asset-close" onClick={onClose} disabled={confirming} aria-label={ar ? "إغلاق" : "Close"}><X className="w-4 h-4" /></button>
        </div>

        <div className="vi-asset-filters" role="tablist">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>
              {ar ? item.ar : item.en}
            </button>
          ))}
        </div>

        <div className="vi-asset-body">
          {loading ? (
            <div className="vi-asset-state"><Loader2 className="w-6 h-6 animate-spin" /><span>{ar ? "جارٍ تحميل صورك..." : "Loading your images..."}</span></div>
          ) : error && !assets.length ? (
            <div className="vi-asset-state"><ImageOff className="w-6 h-6" /><span>{error}</span></div>
          ) : !visible.length ? (
            <div className="vi-asset-state"><Images className="w-6 h-6" /><span>{ar ? "لا توجد صور هنا بعد." : "No images here yet."}</span></div>
          ) : (
            <div className="vi-asset-grid">
              {visible.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`vi-asset-tile ${selectedId === asset.id ? "is-selected" : ""}`}
                  onClick={() => setSelectedId(asset.id)}
                  aria-pressed={selectedId === asset.id}
                  title={asset.name || ""}
                >
                  <span className="vi-asset-thumb">
                    <img src={asset.url} alt={asset.name || ""} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  </span>
                  <span className="vi-asset-name">{asset.name || (ar ? "صورة" : "Image")}</span>
                  {selectedId === asset.id && <span className="vi-asset-check"><Check className="w-3.5 h-3.5" /></span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && assets.length > 0 && <p className="vi-asset-error" role="alert">{error}</p>}

        <div className="vi-asset-actions">
          <button type="button" className="mockup-secondary-btn" onClick={onClose} disabled={confirming}>{ar ? "إلغاء" : "Cancel"}</button>
          <button type="button" className="vi-apply-btn" onClick={confirm} disabled={!selected || confirming}>
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {ar ? "استخدم كشعار" : "Use as logo"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import React from "react";
import { Layers3, Printer } from "lucide-react";
import StudioExportFormats from "@/components/studios/StudioExportFormats";

export default function ProductionEngine({ brand, palette, background, ar, projectId, approvedAssetId }) {
  const logoUrl = brand?.logo?.url;
  const name = brand?.brand_name || (ar ? "اسم العلامة" : "Brand Name");

  return (
    <section className="vi-section production-engine">
      <div className="vi-section-head">
        <div className="vi-section-title">
          <span className="vi-section-icon"><Layers3 className="w-4 h-4" /></span>
          <h2>{ar ? "ملفات الإنتاج" : "Production Engine"}</h2>
        </div>
        <span className="vi-section-hint">{ar ? "ملفات الهوية — بدون Mockup" : "Identity files — no mockups"}</span>
      </div>

      <div className="production-source">
        <div className="production-logo-preview">
          {logoUrl ? <img src={logoUrl} alt={name} /> : <span>{ar ? "لا يوجد شعار معتمد" : "No approved logo"}</span>}
        </div>
        <div className="production-source-copy">
          <strong>{name}</strong>
          <span>{ar ? "المصدر المعتمد من Brand Source of Truth" : "Approved source from Brand Source of Truth"}</span>
        </div>
      </div>

      {logoUrl && <StudioExportFormats projectId={projectId} fromStudio="brand-kit" ar={ar} asset={{ id: brand?.logo?.asset_id || approvedAssetId, url: logoUrl, name: (name || "brand") + "-identity", svg_url: brand?.logo?.svg_url || brand?.logo?.svgUrl || null }} />}

      <div className="production-palette">
        <div className="production-palette-title">{ar ? "ألوان الإنتاج" : "Production colors"}</div>
        <div className="production-palette-row">
          {(palette?.swatches || []).map((color) => <span key={color} title={color} style={{ background: color }} />)}
        </div>
      </div>

      <p className="production-note">
        <Printer className="w-3.5 h-3.5" />
        {ar
          ? "الـ Mockup للعرض فقط. ملفات الإنتاج هنا تعتمد على الأصل المعتمد ولا يتم تحويل صورة PNG إلى Vector مزيف."
          : "Mockups are presentation-only. Production files use the approved source and never fake-vectorize a PNG."}
      </p>
    </section>
  );
}

import React from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Save, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import { projectService } from "@/services/projectService";
import { getBrandIdentity } from "@/services/brandService";
import StudioNextActions from "@/components/studios/StudioNextActions";

const EMPTY = { companyName: "", tagline: "", about: "", services: "", phone: "", email: "", website: "", address: "" };

export default function CompanyProfileStudio() {
  const { loc, direction } = useI18n();
  const { isAnonymous, requireAccount } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const [brand, setBrand] = React.useState(null);
  const [form, setForm] = React.useState(EMPTY);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(Boolean(projectId));

  React.useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    Promise.all([getBrandIdentity(projectId), projectService.get(projectId)]).then(([identity, project]) => {
      if (!active) return;
      setBrand(identity);
      const existing = project?.project_data?.company_profile || {};
      const inheritedPrompt = String(project?.metadata?.initial_prompt || project?.description || "").trim();
      setForm({
        ...EMPTY,
        ...existing,
        companyName: existing.companyName || identity?.brand_name || project?.title || "",
        about: existing.about || inheritedPrompt,
      });
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [projectId]);

  const update = (key, value) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (isAnonymous) {
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    if (!projectId) {
      requireAccount(window.location.pathname + window.location.search);
      return;
    }
    setSaving(true);
    try {
      const project = await projectService.get(projectId);
      const pd = project?.project_data || {};
      await projectService.update(projectId, {
        project_data: {
          ...pd,
          company_profile: {
            ...form,
            updated_at: new Date().toISOString(),
          },
          last_studio_id: "company-profile",
        },
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    ["companyName", "اسم الشركة", "Company name"],
    ["tagline", "الشعار التعريفي", "Tagline"],
    ["phone", "الهاتف", "Phone"],
    ["email", "البريد الإلكتروني", "Email"],
    ["website", "الموقع الإلكتروني", "Website"],
    ["address", "العنوان", "Address"],
  ];

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-sky-500 animate-spin" /></div>;

  return (
    <div className="min-h-full px-4 py-6 md:px-8" dir={direction}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <button type="button" onClick={() => navigate(projectId ? "/chat?project=" + encodeURIComponent(projectId) : "/studios")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
            {direction === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {loc({ ar: "رجوع", en: "Back" })}
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/70 border border-white shadow-sm text-xs font-bold text-sky-700">
            <BriefcaseBusiness className="w-4 h-4" />
            {loc({ ar: "ستوديو بروفايل الشركة", en: "Company Profile Studio" })}
          </div>
        </header>

        {brand && (
          <div className="mb-6 rounded-3xl border border-white bg-white/65 backdrop-blur-xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border flex items-center justify-center overflow-hidden">
              {brand.logo?.url ? <img src={brand.logo.url} alt="" className="w-full h-full object-contain p-2" /> : <Sparkles className="w-5 h-5 text-sky-500" />}
            </div>
            <div className="min-w-0">
              <strong className="block text-sm text-slate-800">{brand.brand_name || form.companyName}</strong>
              <span className="text-xs text-slate-400">{loc({ ar: "الهوية المعتمدة متصلة تلقائيًا بهذا البروفايل", en: "Approved brand identity is connected to this profile" })}</span>
            </div>
            {brand.palette?.swatches?.length ? <div className="ml-auto flex gap-1.5">{brand.palette.swatches.slice(0, 5).map((c) => <i key={c} className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ background: c }} />)}</div> : null}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_420px] gap-6">
          <section className="rounded-[28px] border border-white bg-white/70 backdrop-blur-xl shadow-sm p-5 md:p-7">
            <div className="mb-6">
              <span className="text-[11px] font-black tracking-widest text-sky-600 uppercase">EYAD AI</span>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">{loc({ ar: "ابنِ بروفايل شركتك", en: "Build your company profile" })}</h1>
              <p className="text-sm text-slate-500 mt-2">{loc({ ar: "كل بيانات الشركة والهوية تظل داخل نفس المشروع ويمكن استخدامها في القوالب والعروض.", en: "Your company data and brand identity stay inside the same project and can flow into templates and presentations." })}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map(([key, arLabel, enLabel]) => (
                <label key={key} className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-600">{loc({ ar: arLabel, en: enLabel })}</span>
                  <input value={form[key]} onChange={(e) => update(key, e.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white/80 px-4 outline-none focus:border-sky-300" />
                </label>
              ))}
              <label className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600">{loc({ ar: "نبذة عن الشركة", en: "About company" })}</span>
                <textarea value={form.about} onChange={(e) => update("about", e.target.value)} rows={5} className="rounded-2xl border border-slate-200 bg-white/80 p-4 outline-none focus:border-sky-300 resize-y" placeholder={loc({ ar: "اكتب نبذة احترافية عن الشركة ونشاطها...", en: "Write a professional company overview and activity..." })} />
              </label>
              <label className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600">{loc({ ar: "الخدمات", en: "Services" })}</span>
                <textarea value={form.services} onChange={(e) => update("services", e.target.value)} rows={4} className="rounded-2xl border border-slate-200 bg-white/80 p-4 outline-none focus:border-sky-300 resize-y" placeholder={loc({ ar: "اكتب الخدمات، كل خدمة في سطر...", en: "List the main services, one per line..." })} />
              </label>
            </div>

            <button type="button" onClick={save} disabled={saving} className="mt-6 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-slate-900 text-white font-black disabled:opacity-50">
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? loc({ ar: "جاري الحفظ...", en: "Saving..." }) : saved ? loc({ ar: "تم حفظ البروفايل", en: "Profile saved" }) : loc({ ar: "حفظ البروفايل", en: "Save profile" })}
            </button>
          </section>

          <aside className="rounded-[28px] border border-white bg-white/75 backdrop-blur-xl shadow-sm p-6 h-fit sticky top-4">
            <div className="text-[11px] font-black tracking-widest text-sky-600 uppercase mb-4">{loc({ ar: "معاينة", en: "Preview" })}</div>
            {brand?.logo?.url && <img src={brand.logo.url} alt="" className="w-20 h-20 object-contain mb-5" />}
            <h2 className="text-2xl font-black text-slate-900">{form.companyName || loc({ ar: "اسم الشركة", en: "Company Name" })}</h2>
            <p className="mt-1 font-semibold text-sky-600">{form.tagline || loc({ ar: "الشعار التعريفي", en: "Your tagline" })}</p>
            <p className="mt-5 text-sm leading-7 text-slate-600 whitespace-pre-line">{form.about || loc({ ar: "نبذة الشركة ستظهر هنا.", en: "Your company overview will appear here." })}</p>
            {form.services && <div className="mt-5"><strong className="text-sm">{loc({ ar: "الخدمات", en: "Services" })}</strong><p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{form.services}</p></div>}
            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              {form.phone && <div>{form.phone}</div>}{form.email && <div>{form.email}</div>}{form.website && <div>{form.website}</div>}{form.address && <div>{form.address}</div>}
            </div>
          </aside>
        </div>

        {projectId && (
          <StudioNextActions
            projectId={projectId}
            fromStudio="company-profile"
            asset={null}
            title={loc({ ar: "تم تجهيز بروفايل الشركة. اختر الخطوة التالية", en: "Company profile is ready. Choose the next step" })}
            description={loc({ ar: "بيانات الشركة والهوية المعتمدة تظل مرتبطة بالمشروع.", en: "Company data and approved brand identity remain attached to the project." })}
          />
        )}
      </div>
    </div>
  );
}

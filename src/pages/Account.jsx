import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/lib/AuthContext";
import {
  Camera, ChevronRight, Globe2, Bell, Mail, ShieldCheck,
  LogOut, Trash2, X, Check, Loader2
} from "lucide-react";
import {
  enablePushNotifications,
  disablePushNotifications,
  sendTestPush,
  getPushSupport,
  isEmbeddedPreview,
} from "@/lib/pushNotifications";

const AVATAR_KEY = "eyad.profile.avatar";
const NOTIFICATIONS_KEY = "eyad.profile.notifications";

export default function Account() {
  const { t, language, setLanguage } = useI18n();
  const { user, logout, supabase } = useAuth();
  const fileRef = useRef(null);
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || user?.user_metadata?.full_name || "");
  const [savedName, setSavedName] = useState(user?.user_metadata?.display_name || user?.user_metadata?.full_name || "");
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar_url || (typeof window !== "undefined" ? localStorage.getItem(AVATAR_KEY) : "") || "");
  const [notifications, setNotifications] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const embeddedPreview = isEmbeddedPreview();

  useEffect(() => {
    const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || "";
    setDisplayName(name);
    setSavedName(name);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user || user.is_anonymous) return;
      const supported = getPushSupport();
      if (!supported) return;
      const { data } = await supabase.from("push_subscriptions").select("id, enabled").eq("owner_id", user.id).eq("enabled", true).limit(1);
      if (active) setNotifications(Boolean(data?.length));
    })();
    return () => { active = false; };
  }, [user?.id]);

  const handleAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage(t("account.avatarTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result || "");
      const image = new Image();
      image.onload = async () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        const compressed = canvas.toDataURL("image/webp", 0.82);
        setAvatar(compressed);
        localStorage.setItem(AVATAR_KEY, compressed);
        const { error } = await supabase.auth.updateUser({ data: { avatar_url: compressed } });
        setSaveMessage(error ? error.message : t("account.photoUpdated"));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveMessage("");
    const cleanName = displayName.trim();
    const { error } = await supabase.auth.updateUser({ data: { display_name: cleanName, full_name: cleanName } });
    setSaving(false);
    if (error) return setSaveMessage(error.message);
    setSavedName(cleanName);
    setSaveMessage(t("account.saved"));
  };

  const notificationErrorText = (code) => {
    const key = {
      PUSH_EMBEDDED_PREVIEW: "account.notificationsEmbedded",
      PUSH_BLOCKED: "account.notificationsBlocked",
      PUSH_UNSUPPORTED: "account.notificationsUnsupported",
      PUSH_NOT_GRANTED: "account.notificationsNotGranted",
    }[code] || "account.notificationsError";
    return t(key);
  };

  const testPush = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setNotificationMessage("");
    const result = await sendTestPush(supabase);
    setNotificationBusy(false);
    setNotificationMessage(result.ok ? t("account.notificationsTestSent") : notificationErrorText(result.message));
  };

  const toggleNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setNotificationMessage("");

    if (notifications) {
      const result = await disablePushNotifications(supabase, user?.id);
      setNotificationBusy(false);
      if (!result.ok) {
        setNotificationMessage(notificationErrorText(result.message));
        return;
      }
      setNotifications(false);
      localStorage.setItem(NOTIFICATIONS_KEY, "false");
      setNotificationMessage(t("account.notificationsDisabled"));
      return;
    }

    const result = await enablePushNotifications(supabase, user?.id);
    setNotificationBusy(false);
    if (!result.ok) {
      setNotificationMessage(t("account.notificationsError"));
      return;
    }
    setNotifications(true);
    localStorage.setItem(NOTIFICATIONS_KEY, "true");
    setNotificationMessage(t("account.notificationsEnabled"));
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setSaveMessage("");
    const { error } = await supabase.functions.invoke("delete-account", { body: {} });
    if (error) {
      setDeleting(false);
      setSaveMessage(error.message || t("account.deleteError"));
      return;
    }
    localStorage.removeItem(AVATAR_KEY);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    await logout(false);
    window.location.href = "/home";
  };

  const initial = savedName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-32">
      <header className="px-1 pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("account.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("account.subtitle")}</p>
      </header>

      <section className="card-glass rounded-[32px] px-5 py-8 text-center sm:px-8">
        <div className="relative mx-auto w-fit">
          <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-highlight-sky shadow-[0_16px_40px_rgba(65,160,225,.20)] sm:h-36 sm:w-36">
            {avatar ? <img src={avatar} alt={t("account.profilePhoto")} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-primary">{initial}</div>}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label={t("account.changePhoto")} className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95">
            <Camera className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[13px] font-bold text-primary">+</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
        </div>
        <div className="mt-5">
          <p className="break-all text-base font-semibold tracking-tight text-foreground sm:text-lg">{user?.email || "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("account.member")}</p>
        </div>
      </section>

      <section className="card-glass overflow-hidden rounded-[28px]">
        <div className="border-b border-black/5 px-5 py-4">
          <h2 className="text-lg font-bold text-foreground">{t("account.profile")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("account.profileHint")}</p>
        </div>
        <div className="space-y-1 p-3">
          <div className="rounded-2xl bg-highlight-mist/60 p-4">
            <label className="mb-2 block text-xs font-semibold text-muted-foreground">{t("account.displayName")}</label>
            <div className="flex gap-2">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("account.displayNamePlaceholder")} className="min-w-0 flex-1 rounded-xl border border-black/5 bg-white/80 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10" />
              <button type="button" onClick={saveProfile} disabled={saving} className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-highlight-sky text-primary"><Mail className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-muted-foreground">{t("account.email")}</p><p className="truncate text-sm font-semibold text-foreground">{user?.email || "—"}</p></div>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
        </div>
      </section>

      <section className="card-glass overflow-hidden rounded-[28px]">
        <div className="border-b border-black/5 px-5 py-4"><h2 className="text-lg font-bold text-foreground">{t("account.preferences")}</h2></div>
        <div className="space-y-1 p-3">
          {embeddedPreview && <div className="mx-1 mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs leading-5 text-amber-800">{t("account.notificationsEmbedded")}</div>}
          <div className="flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-highlight-sky text-primary"><Globe2 className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{t("account.language")}</p><p className="text-xs text-muted-foreground">{t("account.languageHint")}</p></div>
            <div className="flex gap-1 rounded-xl bg-highlight-mist p-1">
              <button type="button" onClick={() => setLanguage("ar")} className={`rounded-lg px-3 py-2 text-xs font-bold ${language === "ar" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>{t("account.languageArabic")}</button>
              <button type="button" onClick={() => setLanguage("en")} className={`rounded-lg px-3 py-2 text-xs font-bold ${language === "en" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>{t("account.languageEnglish")}</button>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-highlight-sky text-primary"><Bell className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{t("account.notifications")}</p><p className="text-xs text-muted-foreground">{t("account.notificationsHint")}</p></div>
            <button type="button" onClick={toggleNotifications} aria-pressed={notifications} disabled={notificationBusy || embeddedPreview} className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${notifications ? "bg-primary" : "bg-slate-300"}`}>
              <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifications ? "ltr:translate-x-5 rtl:-translate-x-0" : "translate-x-0"}`} style={notifications && document?.dir === "rtl" ? { transform: "translateX(-20px)" } : undefined} />
            </button>
          </div>
          {notificationMessage && <p className="px-4 pb-3 text-center text-[11px] font-medium text-muted-foreground">{notificationMessage}</p>}
          {notifications && (
            <div className="px-4 pb-4 text-center">
              <button type="button" onClick={testPush} disabled={notificationBusy} className="text-xs font-bold text-primary underline-offset-4 hover:underline disabled:opacity-50">
                {t("account.notificationsTest")}
              </button>
            </div>
          )}
        </div>
      </section>

      {saveMessage && <div className="rounded-2xl bg-highlight-mist px-4 py-3 text-center text-xs font-medium text-muted-foreground">{saveMessage}</div>}

      <section className="rounded-[28px] border border-red-200 bg-red-50/70 p-5 sm:p-6">
        <div className="mb-5"><h2 className="text-lg font-extrabold text-red-700">{t("account.danger.title")}</h2><p className="mt-1 text-xs leading-5 text-red-600/80">{t("account.danger.subtitle")}</p></div>
        <div className="space-y-3">
          <button type="button" onClick={() => logout(true)} className="flex w-full items-center justify-between rounded-2xl border border-red-200 bg-white/80 px-4 py-4 text-left text-red-700 transition hover:bg-white">
            <span className="flex items-center gap-3"><LogOut className="h-5 w-5" /><span><span className="block text-sm font-bold">{t("account.logout")}</span><span className="mt-0.5 block text-xs text-red-600/70">{t("account.logoutHint")}</span></span></span>
            <ChevronRight className="h-5 w-5 opacity-60 rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => setDeleteOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-red-300 bg-red-600 px-4 py-4 text-left text-white shadow-sm transition hover:bg-red-700">
            <span className="flex items-center gap-3"><Trash2 className="h-5 w-5" /><span><span className="block text-sm font-bold">{t("account.delete")}</span><span className="mt-0.5 block text-xs text-white/80">{t("account.deleteHint")}</span></span></span>
            <ChevronRight className="h-5 w-5 opacity-80 rtl:rotate-180" />
          </button>
        </div>
      </section>

      {deleteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600"><Trash2 className="h-6 w-6" /></div>
              <button type="button" onClick={() => !deleting && setDeleteOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">{t("account.deleteConfirmTitle")}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t("account.deleteConfirmBody")}</p>
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">{t("common.cancel")}</button>
              <button type="button" disabled={deleting} onClick={handleDeleteAccount} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{deleting && <Loader2 className="h-4 w-4 animate-spin" />}{t("account.deleteConfirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

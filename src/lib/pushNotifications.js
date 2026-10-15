import { supabase as defaultSupabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BJC-I4oHqewIQpgONvmciPGq1fWuDa7xtKleEJ0jjXGVaJOne9KVMOoBY1k6wUeKJJoCtBoobO6pn8Haiv1nAG0";

const SW_PATH = "/sw.js";

export function isEmbeddedPreview() {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

export function getPushSupport() {
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    window.isSecureContext;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getRegistration() {
  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function enablePushNotifications(client = defaultSupabase, ownerId) {
  try {
    if (!ownerId) return { ok: false, message: "AUTH_REQUIRED" };
    if (isEmbeddedPreview()) return { ok: false, message: "PUSH_EMBEDDED_PREVIEW" };
    if (!getPushSupport()) return { ok: false, message: "PUSH_UNSUPPORTED" };
    if (Notification.permission === "denied") return { ok: false, message: "PUSH_BLOCKED" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, message: permission === "denied" ? "PUSH_BLOCKED" : "PUSH_NOT_GRANTED" };
    }

    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, message: "PUSH_SUBSCRIPTION_INVALID" };
    }

    const { error } = await client
      .from("push_subscriptions")
      .upsert({
        owner_id: ownerId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        enabled: true,
      }, { onConflict: "owner_id,endpoint" });

    if (error) return { ok: false, message: error.message };

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error?.message || "PUSH_SETUP_FAILED" };
  }
}

export async function sendTestPush(client = defaultSupabase) {
  try {
    const { data, error } = await client.functions.invoke("send-push", {
      body: {
        title: "EYAD AI",
        body: "الإشعارات الفورية تعمل بشكل صحيح.",
        url: "/account",
      },
    });
    if (error) return { ok: false, message: error.message || "PUSH_SEND_FAILED" };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: error?.message || "PUSH_SEND_FAILED" };
  }
}

export async function disablePushNotifications(client = defaultSupabase, ownerId) {
  try {
    if (!ownerId) return { ok: false, message: "AUTH_REQUIRED" };

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }

    const { error } = await client
      .from("push_subscriptions")
      .update({ enabled: false })
      .eq("owner_id", ownerId);

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error?.message || "PUSH_DISABLE_FAILED" };
  }
}

// Native (Capacitor) Google sign-in helpers.
// On the web NOTHING here changes behaviour: every function falls back to the
// original logic when not running inside the Capacitor shell.
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

// Must match the custom scheme in AndroidManifest.xml (see README).
// Recommended: same value as your Capacitor appId.
export const NATIVE_SCHEME = "com.eyad.ai";
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://auth/callback`;

export const isNativeApp = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

// Open the Google consent URL.
// - Web: exactly the old behaviour (top-level redirect).
// - Native: in-app Chrome Custom Tab, which is closed again after the deep link returns.
export async function openOAuthUrl(url) {
  if (!isNativeApp()) {
    window.top.location.href = url;
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

let listenerStarted = false;

// Call once at app start. Handles com.eyad.ai://auth/callback#access_token=...
export async function startNativeAuthListener() {
  if (!isNativeApp() || listenerStarted) return;
  listenerStarted = true;
  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);

  App.addListener("appUrlOpen", async ({ url }) => {
    if (!url || !url.startsWith(`${NATIVE_SCHEME}://`)) return;
    try {
      const parsed = new URL(url.replace("#", url.includes("?") ? "&" : "?"));
      const p = parsed.searchParams;
      if (p.get("error_description") || p.get("error")) {
        console.warn("OAuth error:", p.get("error_description") || p.get("error"));
      } else if (p.get("code")) {
        await supabase.auth.exchangeCodeForSession(p.get("code"));
      } else if (p.get("access_token") && p.get("refresh_token")) {
        await supabase.auth.setSession({
          access_token: p.get("access_token"),
          refresh_token: p.get("refresh_token"),
        });
      }
    } catch (e) {
      console.warn("Native OAuth callback failed:", e);
    } finally {
      try { await Browser.close(); } catch { /* already closed */ }
    }
  });
}

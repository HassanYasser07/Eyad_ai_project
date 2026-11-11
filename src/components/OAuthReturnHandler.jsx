import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { startNativeAuthListener } from "@/lib/nativeAuth";

/**
 * After Google sign-in Supabase lands the user on the site root. The intro animation there can navigate to /home
 * before the session is ready, so the return step must not live inside the intro page. This handler is mounted once
 * for the whole app: as soon as a registered session exists and an OAuth round trip is pending, it sends the user
 * back to the page they started from (e.g. their presentation) instead of /home.
 * /login has its own handler for the same keys, so it is skipped here.
 */
export default function OAuthReturnHandler() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => { startNativeAuthListener(); }, []);

  useEffect(() => {
    if (!user || user.is_anonymous || pathname === "/login") return;
    let pending = null, returnTo = null;
    try {
      pending = sessionStorage.getItem("eyad_oauth_pending");
      returnTo = sessionStorage.getItem("eyad_oauth_return_to");
    } catch { /* storage unavailable */ }
    if (!pending) return;
    try { sessionStorage.removeItem("eyad_oauth_pending"); sessionStorage.removeItem("eyad_oauth_return_to"); } catch { /* ignore */ }
    const safe = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\") && returnTo !== "/";
    window.location.href = safe ? returnTo : "/home";
  }, [user, pathname]);

  return null;
}

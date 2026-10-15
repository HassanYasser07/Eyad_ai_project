// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in, e.g. the MCP OAuth consent page). Keep the redirect
// validation in one place — it is security-sensitive and easy to drift.

// Resolve ?returnTo= to a safe same-origin path, else "/".
//
// The same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
// Environment-aware OAuth redirect URL.
//
// Uses window.location.origin (root, no path) dynamically so:
// - In Base44 Preview → https://eyad-creative-studio.base44.app
// - In production     → https://eyad-ai.com
//
// We use the ROOT origin (not /login) because Supabase validates the
// redirect_to against its allowlist and falls back to the Site URL
// (eyad-ai.com) when it doesn't match. The preview domain's allowlist
// entry is the bare origin, so appending /login caused Supabase to
// reject it and redirect to the production domain inside the Preview
// iframe ("eyad-ai.com refused to connect"). The IntroGate at "/"
// already handles post-OAuth session detection and redirect.
export function getOAuthRedirectTo() {
  return window.location.origin;
}

export function safeReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return "/";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    // Only access_token/clear_access_token are still URL-read by app-params.js, but the
    // whole bootstrap set stays stripped: one going back to a URL read must not silently
    // become injectable again. Normal app-flow params (e.g. the OAuth consent ctx) are kept.
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
    return path;
  } catch {
    return "/";
  }
}
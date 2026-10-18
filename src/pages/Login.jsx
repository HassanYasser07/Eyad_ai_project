import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo, getOAuthRedirectTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const { user } = useAuth();
  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  const returnTo = safeReturnTo();

  // After Google OAuth, Supabase redirects back to /login with the session
  // in the URL hash. Once the session is detected, send the user to their
  // original destination (stored in sessionStorage during the OAuth flow).
  useEffect(() => {
    if (user && !user.is_anonymous) {
      const stored = sessionStorage.getItem("eyad_oauth_return_to");
      sessionStorage.removeItem("eyad_oauth_return_to");
      sessionStorage.removeItem("eyad_oauth_pending");
      const dest = (stored && stored.startsWith("/") && stored !== "/") ? stored : (returnTo !== "/" ? returnTo : "/home");
      window.location.href = dest;
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    // Store the returnTo in sessionStorage so we can redirect after the
    // OAuth callback. We use window.location.origin (root) as the redirect
    // target instead of the full path, because the Supabase project's
    // redirect URL whitelist may not include every path + query combo.
    if (returnTo && returnTo !== "/") {
      sessionStorage.setItem("eyad_oauth_return_to", returnTo);
    }
    sessionStorage.setItem("eyad_oauth_pending", "1");
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectTo(),
        queryParams: { scope: "openid email profile" },
        skipBrowserRedirect: true,
      },
    });
    if (oauthError) {
      sessionStorage.removeItem("eyad_oauth_pending");
      sessionStorage.removeItem("eyad_oauth_return_to");
      setError(oauthError.message);
      return;
    }
    // Google blocks its OAuth consent screen inside iframes (an embedded
    // preview causes a 403). Break out to the top-level
    // window so Google loads normally. In production (no iframe)
    // window.top === window, so behavior is unchanged.
    window.top.location.href = data.url;
  };

  const handleSendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email });
      if (otpError) throw otpError;
      setOtpMode(true);
    } catch (err) {
      setError(err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });
      if (verifyError) throw verifyError;
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!otpMode && <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>}
        {!otpMode && <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>}
        <Button type="button" variant="outline" className="w-full h-12 font-medium mb-3" onClick={otpMode ? handleVerifyOtp : handleSendOtp} disabled={loading || (otpMode && otpCode.length < 6)}>
        {otpMode ? `Verify code${otpCode ? ` (${otpCode.length}/6)` : ""}` : "Sign in with email code"}
      </Button>

      {otpMode && (
        <Input
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          className="h-12 mb-3 text-center tracking-[0.5em]"
        />
      )}

      {!otpMode && <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>}
      </form>
    </AuthLayout>
  );
}
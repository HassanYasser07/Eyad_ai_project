/**
 * Root gate: always starts the cinematic EYAD intro.
 * The intro explicitly hands off to /home when it finishes.
 *
 * Also handles the post-OAuth redirect: after Google login, Supabase
 * redirects back to the root with the access token in the hash. Once
 * the session is established, we send the user to their original page.
 */
import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Intro from "@/pages/Intro";

export default function IntroGate() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user && !user.is_anonymous && sessionStorage.getItem("eyad_oauth_pending")) {
      sessionStorage.removeItem("eyad_oauth_pending");
      const returnTo = sessionStorage.getItem("eyad_oauth_return_to");
      sessionStorage.removeItem("eyad_oauth_return_to");
      if (returnTo && returnTo.startsWith("/") && returnTo !== "/") {
        window.location.href = returnTo;
      } else {
        window.location.href = "/home";
      }
    }
  }, [user]);

  if (location.state?.introCompleted === true) {
    return <Navigate to="/home" replace />;
  }
  return <Intro />;
}
/**
 * Root gate: always starts the cinematic EYAD intro.
 * The intro explicitly hands off to /home when it finishes.
 *
 * Also handles the post-OAuth redirect: after Google login, Supabase
 * redirects back to the root with the access token in the hash. Once
 * the session is established, we send the user to their original page.
 */
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import Intro from "@/pages/Intro";

export default function IntroGate() {
  const location = useLocation();

  // The post-OAuth return (back to the page the user came from) is handled app-wide by OAuthReturnHandler.

  if (location.state?.introCompleted === true) {
    return <Navigate to="/home" replace />;
  }
  return <Intro />;
}
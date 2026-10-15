import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const applySession = useCallback((session) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);
    setIsAuthenticated(Boolean(nextUser));
    setIsAnonymous(Boolean(nextUser?.is_anonymous));
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    const { data, error } = await supabase.auth.getUser();

    if (error && error.name !== "AuthSessionMissingError") {
      setAuthError({ type: "unknown", message: error.message });
    }

    const nextUser = data?.user ?? null;
    setUser(nextUser);
    setIsAuthenticated(Boolean(nextUser));
    setIsAnonymous(Boolean(nextUser?.is_anonymous));
    setIsLoadingAuth(false);
    setAuthChecked(true);

    return nextUser;
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setAuthError({ type: "unknown", message: error.message });
      }

      // Guest-first architecture:
      // create a temporary Supabase identity when no session exists.
      // This lets EYAD associate temporary work with the current browser
      // without forcing the visitor to log in.
      let activeSession = session;

      if (!activeSession) {
        const { data: anonymousData, error: anonymousError } =
          await supabase.auth.signInAnonymously();

        if (anonymousData?.session) {
          activeSession = anonymousData.session;
        } else if (anonymousError) {
          // The app must remain usable even before Anonymous Sign-ins is enabled.
          console.warn("EYAD guest session unavailable:", anonymousError.message);
        }
      }

      if (!mounted) return;

      applySession(activeSession);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        applySession(session);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        setAuthError(null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setIsAnonymous(false);

    if (error) {
      setAuthError({ type: "unknown", message: error.message });
    }

    if (shouldRedirect) window.location.href = "/";
  };

  const navigateToLogin = (returnTo = window.location.pathname + window.location.search) => {
    const safePath = returnTo && returnTo.startsWith("/") ? returnTo : "/";
    const target = safePath === "/" ? "/login" : "/login?returnTo=" + encodeURIComponent(safePath);
    window.location.href = target;
  };

  // Use this only at actions that require a permanent account:
  // uploads, saving projects, exports that need cloud persistence, billing,
  // marketplace transactions, account pages, etc.
  const requireAccount = useCallback((returnTo) => {
    if (user && !user.is_anonymous) return true;
    navigateToLogin(returnTo);
    return false;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isAnonymous,
      isRegistered: Boolean(user) && !isAnonymous,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      requireAccount,
      checkUserAuth: refreshUser,
      supabase,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

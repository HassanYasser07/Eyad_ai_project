import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function AccountRequiredRoute() {
  const { isLoadingAuth, authChecked, isRegistered } = useAuth();
  const location = useLocation();

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isRegistered) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={"/login?returnTo=" + encodeURIComponent(returnTo)} replace />;
  }

  return <Outlet />;
}

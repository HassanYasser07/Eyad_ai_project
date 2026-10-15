/**
 * EYAD AI — Shared app layout.
 * Hosts the floating top navigation (desktop), mobile header + bottom dock,
 * and renders the active route via <Outlet />. Navigation destinations come
 * from a single NAV_ITEMS list so desktop and mobile stay in sync.
 */
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";
import MobileHeader from "@/components/layout/MobileHeader";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout() {
  const location = useLocation();
  const isChat = location.pathname === "/chat";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Atmospheric halo at the top of the canvas */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] atmosphere-halo" aria-hidden="true" />

      <div className="relative">
        {!isChat && <TopNav />}
        {!isChat && <MobileHeader />}
        <main className={isChat ? "eyad-app-main--chat" : "px-4 sm:px-6 lg:px-10 pt-24 sm:pt-28 pb-28 lg:pb-16 max-w-7xl mx-auto"}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
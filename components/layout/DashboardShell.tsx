"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

const SearchDialog = lazy(() =>
  import("@/components/layout/SearchDialog").then((m) => ({ default: m.SearchDialog }))
);

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d]">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main area shifts based on sidebar width */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
        }`}
      >
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6" id="main-content">
          {children}
        </main>
      </div>

      {/* Lazy-loaded search dialog */}
      <Suspense fallback={null}>
        {searchOpen && (
          <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}

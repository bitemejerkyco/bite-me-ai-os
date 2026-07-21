"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bot,
  Brain,
  CalendarDays,
  ChartColumn,
  CreditCard,
  GalleryVerticalEnd,
  Images,
  LayoutDashboard,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Settings,
} from "lucide-react";
import { DASHBOARD_NAVIGATION, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { NavigationIconKey } from "@/types/navigation";
import { SidebarGroup } from "@/components/dashboard/sidebar-group";
import { TopBar } from "@/components/dashboard/top-bar";

const iconMap: Record<NavigationIconKey, ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  megaphone: Megaphone,
  "pen-square": PenSquare,
  "calendar-days": CalendarDays,
  "book-open": BookOpen,
  brain: Brain,
  images: Images,
  "chart-column": ChartColumn,
  "credit-card": CreditCard,
  settings: Settings,
  "gallery-vertical-end": GalleryVerticalEnd,
  bot: Bot,
};

const DESKTOP_COLLAPSE_KEY = "postmotive.sidebar.collapsed.v1";

export function DashboardShell({
  children,
  isDatabaseConfigured,
  isSupabaseConfigured,
}: {
  children: React.ReactNode;
  isDatabaseConfigured: boolean;
  isSupabaseConfigured: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DESKTOP_COLLAPSE_KEY);
    setCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DESKTOP_COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigation = useMemo(() => DASHBOARD_NAVIGATION, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <TopBar
        onOpenMobileNav={() => setMobileOpen(true)}
        showMenuButton
        isDatabaseConfigured={isDatabaseConfigured}
        isSupabaseConfigured={isSupabaseConfigured}
      />

      <div className="mx-auto grid w-full max-w-[1400px] md:grid-cols-[auto_1fr]">
        <motion.aside
          animate={{ width: collapsed ? 88 : 284 }}
          transition={{ duration: 0.18 }}
          className="sticky top-16 hidden h-[calc(100vh-4rem)] border-r border-[var(--border)] bg-zinc-950/60 p-3 md:block"
          aria-label="Sidebar"
        >
          <div className="mb-6 flex items-center justify-between px-2">
            <Link href="/mission-control" className={cn("rounded-md", collapsed && "mx-auto")}>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--primary)] text-sm font-semibold text-white">PM</div>
              {!collapsed ? (
                <>
                  <p className="mt-2 text-sm font-semibold">{APP_NAME}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{APP_TAGLINE}</p>
                </>
              ) : null}
            </Link>
            {!collapsed ? (
              <button
                type="button"
                className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
          </div>

          <SidebarGroup title={collapsed ? "" : "Mission Control"} className={collapsed ? "px-0" : ""}>
            {navigation.map((item) => {
              const Icon = iconMap[item.icon];
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    active ? "bg-rose-600/20 text-rose-200" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                    collapsed ? "justify-center" : ""
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </SidebarGroup>
        </motion.aside>

        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close mobile navigation"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-[var(--border)] bg-zinc-950 p-4 md:hidden"
              aria-label="Mobile sidebar"
            >
              <p className="mb-3 text-sm font-semibold">Mission Control</p>
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const Icon = iconMap[item.icon];
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                        active ? "bg-rose-600/20 text-rose-200" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

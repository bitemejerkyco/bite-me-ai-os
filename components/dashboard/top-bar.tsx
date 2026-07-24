"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/dashboard/status-badge";

const SearchDialog = dynamic(
  () => import("@/components/dashboard/search-dialog").then((mod) => mod.SearchDialog),
  { ssr: false }
);

export function TopBar({
  onOpenMobileNav,
  showMenuButton,
  isDatabaseConfigured,
  isSupabaseConfigured,
}: {
  onOpenMobileNav: () => void;
  showMenuButton: boolean;
  isDatabaseConfigured: boolean;
  isSupabaseConfigured: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isOpenSearch = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isOpenSearch) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const workspaceState = useMemo(() => {
    if (isSupabaseConfigured && isDatabaseConfigured) {
      return { label: "Operational", tone: "healthy" as const };
    }
    if (isSupabaseConfigured || isDatabaseConfigured) {
      return { label: "Partial setup", tone: "warning" as const };
    }
    return { label: "Setup mode", tone: "offline" as const };
  }, [isDatabaseConfigured, isSupabaseConfigured]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2">
            {showMenuButton ? (
              <Button variant="secondary" size="icon" onClick={onOpenMobileNav} aria-label="Open navigation" className="md:hidden">
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-zinc-400 hover:text-zinc-100 sm:flex"
              aria-label="Open global search"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px]">⌘K</span>
            </button>
            <select
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
              aria-label="Workspace switcher"
              defaultValue="default"
            >
              <option value="default">Default Workspace</option>
            </select>
          </div>

          <div className="relative flex items-center gap-3">
            <StatusBadge tone={workspaceState.tone}>{workspaceState.label}</StatusBadge>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Notifications"
              onClick={() => setNotificationOpen((value) => !value)}
            >
              <Bell className="h-4 w-4" />
            </Button>
            <Avatar initials="PM" />

            {notificationOpen ? (
              <div
                className="absolute right-10 top-12 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-xl"
                role="dialog"
                aria-label="Notifications"
              >
                <p className="text-sm font-medium">Notifications</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">No notifications yet. Activity appears here once your workspace is configured.</p>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

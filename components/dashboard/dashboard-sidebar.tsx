"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  PenSquare,
  Settings,
} from "lucide-react";
import type { ComponentType } from "react";
import { APP_NAME, APP_TAGLINE, DASHBOARD_NAVIGATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { NavigationIconKey } from "@/types/navigation";

const iconMap: Record<NavigationIconKey, ComponentType<{ className?: string }>> = {
  "gallery-vertical-end": GalleryVerticalEnd,
  "layout-dashboard": LayoutDashboard,
  megaphone: Megaphone,
  "pen-square": PenSquare,
  "calendar-days": CalendarDays,
  "book-open": BookOpen,
  brain: Brain,
  images: Images,
  "chart-column": ChartColumn,
  bot: Bot,
  "credit-card": CreditCard,
  settings: Settings,
};

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col border-r border-[var(--border)] bg-zinc-950/90 p-5 md:flex">
      <Link href="/dashboard" className="mb-8 block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-white">P</div>
        <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{APP_NAME}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{APP_TAGLINE}</p>
      </Link>

      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Mission Control</p>
      <nav className="space-y-1">
        {DASHBOARD_NAVIGATION.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-rose-600/20 text-rose-200"
                  : "text-[var(--muted-foreground)] hover:bg-zinc-900 hover:text-[var(--foreground)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

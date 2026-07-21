"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { titleFromPathname } from "@/lib/utils";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";

export function DashboardHeader({
  isSupabaseConfigured,
  isDatabaseConfigured,
}: {
  isSupabaseConfigured: boolean;
  isDatabaseConfigured: boolean;
}) {
  const pathname = usePathname();
  const title = titleFromPathname(pathname);
  const setupComplete = isSupabaseConfigured && isDatabaseConfigured;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <MobileSidebar />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Mission Control</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={setupComplete ? "success" : "warning"}>{setupComplete ? "Setup complete" : "Setup required"}</Badge>
          <Button variant="secondary" size="icon" disabled aria-label="Notifications unavailable during setup">
            <Bell className="h-4 w-4" />
          </Button>
          <Avatar initials="PM" />
        </div>
      </div>
    </header>
  );
}

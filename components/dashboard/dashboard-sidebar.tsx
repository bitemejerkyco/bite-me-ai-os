"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, DASHBOARD_NAVIGATION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type DashboardNavLinksProps = {
  className?: string;
  onNavigate?: () => void;
};

export function DashboardNavLinks({ className, onNavigate }: DashboardNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-1", className)}>
      {DASHBOARD_NAVIGATION.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            className={buttonVariants({
              variant: isActive ? "secondary" : "ghost",
              className: "w-full justify-start gap-3",
            })}
            href={item.href}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="hidden border-r border-white/10 bg-slate-950/70 px-5 py-6 backdrop-blur md:flex md:flex-col">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-300">Workspace</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{APP_NAME}</h2>
        <p className="mt-2 text-sm text-slate-400">Shared dashboard foundation for every platform module.</p>
      </div>
      <Separator className="my-6" />
      <DashboardNavLinks className="flex-1" />
    </aside>
  );
}

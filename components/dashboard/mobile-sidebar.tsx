"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASHBOARD_NAVIGATION } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation" className="md:hidden">
        <Menu className="h-4 w-4" />
      </Button>

      {open ? <button className="fixed inset-0 z-40 bg-black/60 md:hidden" aria-label="Close navigation overlay" onClick={() => setOpen(false)} /> : null}

      <div className={cn("fixed inset-y-0 left-0 z-50 w-72 transform border-r border-[var(--border)] bg-zinc-950 p-5 transition md:hidden", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm font-semibold">Mission Control</p>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="space-y-1">
          {DASHBOARD_NAVIGATION.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm",
                  active ? "bg-rose-600/20 text-rose-200" : "text-[var(--muted-foreground)] hover:bg-zinc-900 hover:text-[var(--foreground)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

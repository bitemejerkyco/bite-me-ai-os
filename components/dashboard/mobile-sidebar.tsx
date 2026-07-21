"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DashboardNavLinks } from "@/components/dashboard/dashboard-sidebar";
import { Button } from "@/components/ui/button";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">Navigation</p>
        <Button
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((value) => !value)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>
      {open ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/95 p-3">
          <DashboardNavLinks onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

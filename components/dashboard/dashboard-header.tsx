"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logout } from "@/lib/auth/actions";
import { getInitials } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  userLabel: string;
  isDemoMode: boolean;
};

export function DashboardHeader({ userLabel, isDemoMode }: DashboardHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      const result = await logout();

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-300" />
            <span className="text-sm font-medium text-slate-200">Bite Me AI OS</span>
          </div>
          <p className="text-sm text-slate-400">Sprint 1A platform foundation</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={isDemoMode ? "secondary" : "success"}>
            {isDemoMode ? "Demo mode" : "Authenticated"}
          </Badge>
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
            <Avatar initials={getInitials(userLabel)} />
            <div className="hidden text-sm text-slate-200 sm:block">{userLabel}</div>
          </div>
          <Button disabled={isPending} onClick={handleLogout} type="button" variant="ghost">
            {isPending ? "Signing out..." : isDemoMode ? "Exit demo" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}

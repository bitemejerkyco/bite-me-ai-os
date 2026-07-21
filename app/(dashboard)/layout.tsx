import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell isDatabaseConfigured={isDatabaseConfigured} isSupabaseConfigured={isSupabaseConfigured}>
      {children}
    </DashboardShell>
  );
}

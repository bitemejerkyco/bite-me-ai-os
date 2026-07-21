import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let userLabel = "Demo mode";

  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userLabel = user.email ?? user.user_metadata.full_name ?? "Authenticated user";
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[280px_minmax(0,1fr)]">
      <DashboardSidebar />
      <div className="flex min-h-screen flex-col">
        <MobileSidebar />
        <DashboardHeader userLabel={userLabel} isDemoMode={!isSupabaseConfigured} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

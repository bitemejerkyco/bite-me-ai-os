import { Activity, CalendarClock, Sparkles, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { isSupabaseConfigured } from "@/lib/env";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Foundation-ready overview for campaigns, content, billing, and analytics.
          </p>
        </div>
        <Badge variant={isSupabaseConfigured ? "success" : "secondary"}>
          {isSupabaseConfigured ? "Supabase connected" : "Local demo mode"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active campaigns" value="12" description="3 ready for launch" icon={Sparkles} />
        <StatCard title="Content queue" value="28" description="7 awaiting approval" icon={CalendarClock} />
        <StatCard title="Revenue tracked" value="$48.2K" description="Updated hourly" icon={Wallet} />
        <StatCard title="Engagement score" value="91%" description="Up 6% this week" icon={Activity} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform foundation complete</CardTitle>
          <CardDescription>
            This workspace now includes route groups, auth scaffolding, protected dashboard shells,
            Supabase SSR helpers, and Prisma runtime wiring.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Auth pages and server actions are ready for real Supabase credentials.
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Dashboard sections share a persistent navigation shell across all platform modules.
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Health and callback routes provide the initial API surface for deployment checks.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

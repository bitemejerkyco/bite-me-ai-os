import { MissionControlWidgets } from "@/components/dashboard/mission-control-widgets";
import { PageHeader } from "@/components/dashboard/page-header";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Modern operations shell inspired by linear workflows and environment-aware setup progress."
      />
      <MissionControlWidgets isDatabaseConfigured={isDatabaseConfigured} isSupabaseConfigured={isSupabaseConfigured} />
    </section>
  );
}

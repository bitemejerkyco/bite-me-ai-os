import { MissionControlWidgets } from "@/components/dashboard/mission-control-widgets";
import { PageHeader } from "@/components/dashboard/page-header";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

export default function MissionControlPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Mission Control"
        description="Central operating console for platform readiness, workflow setup, and execution posture."
      />
      <MissionControlWidgets isDatabaseConfigured={isDatabaseConfigured} isSupabaseConfigured={isSupabaseConfigured} />
    </section>
  );
}

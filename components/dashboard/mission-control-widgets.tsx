import { CircleCheck, CircleDashed, Cpu, Database, Plug, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { Section } from "@/components/dashboard/section";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DASHBOARD_QUICK_ACTIONS, getSetupChecklist } from "@/config/dashboard";

export function MissionControlWidgets({
  isDatabaseConfigured,
  isSupabaseConfigured,
}: {
  isDatabaseConfigured: boolean;
  isSupabaseConfigured: boolean;
}) {
  const setupCount = Number(isDatabaseConfigured) + Number(isSupabaseConfigured);

  return (
    <div className="space-y-6">
      <Section title="Platform Health" description="Configuration-aware platform status.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Environment Status"
            value={`${setupCount}/2`}
            hint="Supabase and database readiness"
            status={{
              label: setupCount === 2 ? "Healthy" : setupCount === 1 ? "Partial" : "Setup mode",
              tone: setupCount === 2 ? "healthy" : setupCount === 1 ? "warning" : "offline",
            }}
          />
          <MetricCard label="Scheduled Posts" value="0" hint="No publishing schedule yet." status={{ label: "No data", tone: "neutral" }} />
          <MetricCard label="Campaign Pipeline" value="0" hint="No active campaigns yet." status={{ label: "No data", tone: "neutral" }} />
          <MetricCard label="AI Status" value="Idle" hint="AI services ready once setup is complete." status={{ label: "Standby", tone: "warning" }} />
        </div>
      </Section>

      <Section title="Environment Status" description="Runtime dependency checks from local configuration.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4" /> Supabase</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-[var(--muted-foreground)]">Authentication and session infrastructure.</p>
              <StatusBadge tone={isSupabaseConfigured ? "healthy" : "warning"}>
                {isSupabaseConfigured ? "Configured" : "Missing vars"}
              </StatusBadge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Database</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-[var(--muted-foreground)]">Prisma-backed persistence layer.</p>
              <StatusBadge tone={isDatabaseConfigured ? "healthy" : "warning"}>
                {isDatabaseConfigured ? "Configured" : "Missing DATABASE_URL"}
              </StatusBadge>
            </CardContent>
          </Card>
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Getting Started" description="Complete these tasks to activate production workflows." className="xl:col-span-2">
          <Card>
            <CardContent className="space-y-2 p-5">
              {getSetupChecklist(isSupabaseConfigured, isDatabaseConfigured).map((item) => (
                <SetupRow
                  key={item.id}
                  icon={
                    item.id === "supabase" ? (
                      <Plug className="h-4 w-4" />
                    ) : item.id === "database" ? (
                      <Database className="h-4 w-4" />
                    ) : (
                      <CircleDashed className="h-4 w-4" />
                    )
                  }
                  label={item.label}
                  complete={item.completed}
                />
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section title="Quick Actions" description="Jump directly into setup and creation flows.">
          <div className="space-y-3">
            {DASHBOARD_QUICK_ACTIONS.map((action) => (
              <QuickActionCard
                key={action.id}
                title={action.label}
                description={action.description}
                href={action.href}
                cta={action.cta}
              />
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Recent Activity" description="Operational timeline and system updates.">
          <EmptyState
            title="No recent activity"
            description="Activity appears here after authentication, brand setup, and campaign operations are active."
          />
        </Section>

        <Section title="Upcoming Posts" description="Scheduled content execution timeline.">
          <EmptyState
            title="No scheduled posts"
            description="Connect channels and create campaigns to populate upcoming posting windows."
          />
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Campaign Pipeline" description="Campaign progression across lifecycle stages.">
          <EmptyState title="Pipeline is empty" description="Create your first campaign to begin pipeline tracking." />
        </Section>
        <Section title="Brand Status" description="Brand profile readiness and coverage.">
          <EmptyState title="No brands configured" description="Use Brand Brain to define identity, voice, and audience details." />
        </Section>
        <Section title="Knowledge Base" description="Indexed context powering AI outputs.">
          <EmptyState title="Knowledge base not seeded" description="Upload documents and sources to improve generation quality." />
        </Section>
      </div>

      <Section title="AI Status" description="Model and orchestration readiness.">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-medium">AI employees and orchestrators are in standby.</p>
              <p className="text-xs text-[var(--muted-foreground)]">Workloads begin after brand and knowledge setup complete.</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={isSupabaseConfigured ? "healthy" : "warning"}><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Auth</StatusBadge>
              <StatusBadge tone={isDatabaseConfigured ? "healthy" : "warning"}><Cpu className="mr-1 h-3.5 w-3.5" /> Data</StatusBadge>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

function SetupRow({
  icon,
  label,
  complete,
}: {
  icon: React.ReactNode;
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-zinc-900/35 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <StatusBadge tone={complete ? "healthy" : "warning"}>
        {complete ? <CircleCheck className="mr-1 h-3.5 w-3.5" /> : null}
        {complete ? "Complete" : "Pending"}
      </StatusBadge>
    </div>
  );
}
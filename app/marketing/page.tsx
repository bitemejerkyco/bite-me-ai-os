import AppShell from "@/components/AppShell";
import MarketingWorkspace from "@/components/core/MarketingWorkspace";

export default function MarketingPage() {
  return (
    <AppShell title="Marketing Command Center" eyebrow="Plan and execute">
      <MarketingWorkspace />
    </AppShell>
  );
}

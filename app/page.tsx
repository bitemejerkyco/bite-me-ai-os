import AppShell from "@/components/AppShell";
import ExecutiveDashboard from "@/components/core/ExecutiveDashboard";

export default function Home() {
  return (
    <AppShell title="Executive Dashboard" eyebrow="PostMotive">
      <ExecutiveDashboard />
    </AppShell>
  );
}

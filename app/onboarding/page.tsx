import AppShell from "@/components/AppShell";
import OnboardingWorkspace from "@/components/core/OnboardingWorkspace";

export default function OnboardingPage() {
  return (
    <AppShell title="Business Setup" eyebrow="Workspace foundation">
      <OnboardingWorkspace />
    </AppShell>
  );
}

import AppShell from "@/components/AppShell";
import AccountHelpSettings from "@/components/help/AccountHelpSettings";

export default function AccountSettingsPage() {
  return (
    <AppShell title="Account Settings" eyebrow="Personal workspace guidance preferences">
      <AccountHelpSettings />
    </AppShell>
  );
}

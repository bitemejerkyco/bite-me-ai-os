import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Settings – Bite Me AI OS" };

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Manage your workspace, account, and integrations."
      />

      <div className="space-y-4">
        {[
          { title: "Account", description: "Update your profile and email address." },
          { title: "Workspace", description: "Manage workspace settings and members." },
          { title: "Integrations", description: "Connect social media accounts and third-party tools." },
          { title: "Notifications", description: "Configure how and when you receive notifications." },
          { title: "API Keys", description: "Manage API keys for external integrations." },
        ].map((section) => (
          <div
            key={section.title}
            className="flex items-center justify-between rounded-xl border border-[#222] bg-[#161616] p-5"
          >
            <div>
              <h3 className="text-sm font-medium text-white">{section.title}</h3>
              <p className="mt-0.5 text-xs text-zinc-500">{section.description}</p>
            </div>
            <span className="rounded-lg border border-[#2a2a2a] px-3 py-1.5 text-xs text-zinc-500">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

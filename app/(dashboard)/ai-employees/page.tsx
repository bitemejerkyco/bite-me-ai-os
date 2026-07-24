import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BotIcon } from "lucide-react";

export const metadata = { title: "AI Employees – Bite Me AI OS" };

export default function AIEmployeesPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="AI Employees"
        description="Manage your AI-powered marketing team."
      />
      <EmptyState
        icon={<BotIcon className="h-6 w-6" />}
        title="No AI employees yet"
        description="AI employee deployment is coming soon."
      />
    </div>
  );
}

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BotIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "AI Employees – Bite Me AI OS" };

export default function AIEmployeesPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="AI Employees"
        description="Manage your AI-powered marketing team."
        actions={
          <Link
            href="/ai-employees/new"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Hire AI employee
          </Link>
        }
      />
      <EmptyState
        icon={<BotIcon className="h-6 w-6" />}
        title="No AI employees yet"
        description="Deploy specialized AI agents to handle content, social, SEO, and more."
        action={
          <Link
            href="/ai-employees/new"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Hire AI employee
          </Link>
        }
      />
    </div>
  );
}

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarIcon } from "lucide-react";

export const metadata = { title: "Marketing Calendar – Bite Me AI OS" };

export default function MarketingCalendarPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Marketing Calendar"
        description="Plan and schedule your content and campaigns."
      />
      <EmptyState
        icon={<CalendarIcon className="h-6 w-6" />}
        title="Calendar coming soon"
        description="Schedule posts and campaigns across all your channels."
      />
    </div>
  );
}

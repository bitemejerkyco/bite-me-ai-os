import AppShell from "@/components/AppShell";
import ContentCalendar from "@/components/core/ContentCalendar";

export default function CalendarPage() {
  return (
    <AppShell title="Publishing Calendar" eyebrow="Schedule or post now">
      <ContentCalendar />
    </AppShell>
  );
}


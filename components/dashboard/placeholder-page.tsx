import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Section } from "@/components/dashboard/section";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-6">
      <PageHeader title={title} description={description} />
      <Section title={`${title} workspace`} description="Production shell is ready while feature implementation is staged.">
        <EmptyState
          title="Feature planned"
          description="This page now uses the production dashboard architecture. Business capabilities are scheduled in upcoming sprints."
        />
      </Section>
    </section>
  );
}

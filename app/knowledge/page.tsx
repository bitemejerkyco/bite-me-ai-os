import AppShell from "@/components/AppShell";
import ContentKnowledge from "@/components/core/ContentKnowledge";

export default function KnowledgePage() {
  return (
    <AppShell title="Knowledge Base" eyebrow="Proven content intelligence">
      <ContentKnowledge />
    </AppShell>
  );
}

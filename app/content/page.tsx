import AppShell from "@/components/AppShell";
import ContentLibrary from "@/components/core/ContentLibrary";

export default function ContentPage() {
  return (
    <AppShell title="Content Library" eyebrow="Drafts and approved content">
      <ContentLibrary />
    </AppShell>
  );
}

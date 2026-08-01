import AppShell from "@/components/AppShell";
import ContentLibrary from "@/components/core/ContentLibrary";

export default function ContentLibraryAliasPage() {
  return (
    <AppShell title="Content Library" eyebrow="Drafts and approved content">
      <ContentLibrary />
    </AppShell>
  );
}

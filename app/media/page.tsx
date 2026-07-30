import AppShell from "@/components/AppShell";
import MediaLibrary from "@/components/core/MediaLibrary";

export default function MediaPage() {
  return (
    <AppShell title="Media Intelligence Library" eyebrow="Brand assets">
      <MediaLibrary />
    </AppShell>
  );
}

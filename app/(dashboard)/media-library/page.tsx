import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageIcon } from "lucide-react";

export const metadata = { title: "Media Library – Bite Me AI OS" };

export default function MediaLibraryPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Media Library"
        description="Manage images, videos, and other media assets."
      />
      <EmptyState
        icon={<ImageIcon className="h-6 w-6" />}
        title="No media files"
        description="Media upload is coming soon."
      />
    </div>
  );
}

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Media Library – Bite Me AI OS" };

export default function MediaLibraryPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Media Library"
        description="Manage images, videos, and other media assets."
        actions={
          <Link
            href="/media-library/upload"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Upload media
          </Link>
        }
      />
      <EmptyState
        icon={<ImageIcon className="h-6 w-6" />}
        title="No media files"
        description="Upload images and videos to use in your campaigns and content."
        action={
          <Link
            href="/media-library/upload"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Upload media
          </Link>
        }
      />
    </div>
  );
}

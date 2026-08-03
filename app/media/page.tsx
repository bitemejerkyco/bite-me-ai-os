import AppShell from "@/components/AppShell";
import MediaLibrary from "@/components/core/MediaLibrary";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { getWorkspaceRole } from "@/features/platform/workspace-roles";
import { mediaCapabilitiesForRole } from "@/features/media/media-capabilities";

type MediaAssetRow = {
  id: string;
  storage_path: string;
  file_name: string;
  asset_type: string;
  mime_type: string | null;
  size_bytes: number;
  tags: string[];
  created_at: string;
  folder_id: string | null;
  source: "UPLOADED" | "GENERATED" | "IMPORTED" | "LEGACY" | "CAMPAIGN" | "UGC" | null;
  generation_status: "PENDING" | "PROCESSING" | "READY" | "FAILED" | null;
  generation_job_id: string | null;
  thumbnail_path: string | null;
  poster_path: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  archived_at: string | null;
  is_favorite: boolean | null;
  metadata: Record<string, unknown> | null;
};

type LibraryFolderRow = {
  id: string;
  library_type: "CONTENT" | "MEDIA";
  name: string;
  parent_id: string | null;
  created_at: string;
};

export default async function MediaPage() {
  const context = await requireWorkspaceContext();
  const supabase = await createClient();

  const [role, assetsResult, foldersResult] = await Promise.all([
    getWorkspaceRole({ workspaceId: context.workspaceId, userId: context.userId }),
    supabase
      .from("media_assets")
      .select("id,storage_path,file_name,asset_type,mime_type,size_bytes,tags,created_at,folder_id,source,generation_status,generation_job_id,thumbnail_path,poster_path,width,height,duration_seconds,archived_at,is_favorite,metadata")
      .eq("workspace_id", context.workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("library_folders")
      .select("id,library_type,name,parent_id,created_at")
      .eq("workspace_id", context.workspaceId)
      .eq("library_type", "MEDIA")
      .order("name", { ascending: true }),
  ]);

  const assetsData = assetsResult.data;
  const foldersData = foldersResult.data;

  const initialAssets = ((assetsData || []) as MediaAssetRow[]).map((row) => ({
    id: row.id,
    name: row.file_name,
    type: row.mime_type || row.asset_type || "application/octet-stream",
    size: Number(row.size_bytes),
    tags: row.tags || [],
    createdAt: row.created_at,
    storagePath: row.storage_path,
    folderId: row.folder_id || undefined,
    source: row.source || undefined,
    generationStatus: row.generation_status || undefined,
    generationJobId: row.generation_job_id || undefined,
    thumbnailPath: row.thumbnail_path || undefined,
    posterPath: row.poster_path || undefined,
    width: Number.isFinite(row.width) ? Number(row.width) : undefined,
    height: Number.isFinite(row.height) ? Number(row.height) : undefined,
    durationSeconds: Number.isFinite(row.duration_seconds) ? Number(row.duration_seconds) : undefined,
    archivedAt: row.archived_at || undefined,
    isFavorite: row.is_favorite ?? false,
    productMetadata: row.metadata && typeof row.metadata === "object"
      ? ((row.metadata.productAsset && typeof row.metadata.productAsset === "object"
        ? row.metadata.productAsset
        : row.metadata) as {
          productId?: string;
          productName?: string;
          assetRole?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
          isPrimaryProductImage?: boolean;
          role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
          angle?: string;
          locked?: boolean;
          approvedForGeneration?: boolean;
          transparentBackground?: boolean;
          originalAssetId?: string;
          exactProductMode?: boolean;
          allowAiMotion?: boolean;
          preserveOriginalAsset?: boolean;
          originalStoragePath?: string;
          background?: string;
          position?: string;
          scale?: string;
          safeArea?: string;
          notes?: string;
        })
      : undefined,
  }));

  const initialFolders = ((foldersData || []) as LibraryFolderRow[]).map((row) => ({
    id: row.id,
    libraryType: row.library_type,
    name: row.name,
    parentId: row.parent_id || undefined,
    createdAt: row.created_at,
  }));

  const initialRoleLabel = role || "GUEST";
  const initialCapabilities = mediaCapabilitiesForRole(initialRoleLabel);

  return (
    <AppShell title="Media Intelligence Library" eyebrow="Brand assets">
      <MediaLibrary
        initialAssets={initialAssets}
        initialFolders={initialFolders}
        initialRoleLabel={initialRoleLabel}
        initialCapabilities={initialCapabilities}
      />
    </AppShell>
  );
}

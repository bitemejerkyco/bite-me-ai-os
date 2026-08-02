type SignedPathMap = Map<string, string>;

type SignedUrlResponseItem = {
  path: string | null;
  signedUrl: string | null;
  error?: string | null;
};

type StorageSigner = {
  from: (bucket: string) => {
    createSignedUrls: (
      paths: string[],
      expiresIn: number,
    ) => Promise<{
      data: SignedUrlResponseItem[] | null;
      error: { message?: string } | null;
    }>;
  };
};

export type MediaUrlResolverRow = {
  id: string;
  workspace_id: string;
  file_name: string;
  asset_type: string | null;
  mime_type: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  poster_path: string | null;
  size_bytes: number;
  tags: string[] | null;
  created_at: string;
  folder_id: string | null;
  source: string | null;
  generation_status: string | null;
  generation_job_id: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  archived_at: string | null;
};

export type MediaAssociation = {
  mediaAssetId: string;
  campaignId?: string;
  creatorName?: string;
  usageRightsStart?: string;
  usageRightsEnd?: string;
  approvalStatus?: string;
};

export type ResolvedMediaAsset = {
  assetId: string;
  previewUrl: string;
  downloadUrl: string;
  thumbnailUrl: string;
  expiresAt: string | null;
  mimeType: string;
  isDownloadAllowed: boolean;
  fileName: string;
  assetType: string;
  createdAt: string;
  source: string;
  generationStatus: string;
  generationJobId: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sizeBytes: number;
  folderId: string | null;
  tags: string[];
  campaignIds: string[];
  creatorName: string | null;
  usageRightsStart: string | null;
  usageRightsEnd: string | null;
  usageRightsStatus: "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED";
  approvalStatus: string | null;
  label: "generated" | "uploaded" | "imported" | "legacy";
  error: string | null;
};

export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function normalizeStoragePath(storagePath: string): string {
  const trimmed = storagePath.trim();
  if (!trimmed) return "";
  if (isAbsoluteUrl(trimmed)) return trimmed;
  return trimmed
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/(?:sign|public|authenticated)\/brand-media\//, "")
    .replace(/^brand-media\//, "");
}

export function inferAssetType(mimeType: string, fallbackType?: string | null): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (fallbackType) return fallbackType.toLowerCase();
  return "file";
}

export function usageRightsStatus(
  usageRightsStart?: string | null,
  usageRightsEnd?: string | null,
  now = new Date(),
): "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED" {
  if (!usageRightsStart && !usageRightsEnd) return "NONE";
  const start = usageRightsStart ? new Date(usageRightsStart) : null;
  const end = usageRightsEnd ? new Date(usageRightsEnd) : null;

  if (end && end.getTime() < now.getTime()) return "EXPIRED";
  if (start && start.getTime() > now.getTime()) return "ACTIVE";
  if (end) {
    const msLeft = end.getTime() - now.getTime();
    if (msLeft <= 7 * 24 * 60 * 60 * 1000) return "EXPIRING";
  }
  return "ACTIVE";
}

export function shouldRefreshSignedUrl(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return true;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return true;
  return expiryMs <= now;
}

function toCustomerSafeError(message: string): string {
  if (message.includes("not found")) return "Preview unavailable";
  return "Unable to resolve preview";
}

function toLabel(source: string): "generated" | "uploaded" | "imported" | "legacy" {
  switch (source) {
    case "GENERATED":
      return "generated";
    case "IMPORTED":
    case "UGC":
    case "CAMPAIGN":
      return "imported";
    case "LEGACY":
      return "legacy";
    default:
      return "uploaded";
  }
}

async function createSignedPathMap(
  storage: StorageSigner,
  bucket: string,
  paths: string[],
  expiresInSeconds: number,
): Promise<SignedPathMap> {
  const map: SignedPathMap = new Map();
  if (!paths.length) return map;
  const unique = [...new Set(paths.map((path) => normalizeStoragePath(path)).filter(Boolean))];
  if (!unique.length) return map;

  const { data, error } = await storage.from(bucket).createSignedUrls(unique, expiresInSeconds);
  if (error) return map;
  for (const item of data || []) {
    if (item?.signedUrl && item.path) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

export async function resolveMediaRows(params: {
  rows: MediaUrlResolverRow[];
  associations: MediaAssociation[];
  storage: StorageSigner;
  downloadRoutePrefix?: string;
  bucket?: string;
  expiresInSeconds?: number;
  now?: Date;
}): Promise<ResolvedMediaAsset[]> {
  const bucket = params.bucket || "brand-media";
  const expiresInSeconds = params.expiresInSeconds || 15 * 60;
  const now = params.now || new Date();
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();

  const previewPaths = params.rows
    .map((row) => row.storage_path || "")
    .filter((path) => path && !isAbsoluteUrl(path));
  const thumbnailPaths = params.rows
    .flatMap((row) => [row.thumbnail_path || "", row.poster_path || ""])
    .filter((path) => path && !isAbsoluteUrl(path));

  const [previewMap, thumbnailMap] = await Promise.all([
    createSignedPathMap(params.storage, bucket, previewPaths, expiresInSeconds),
    createSignedPathMap(params.storage, bucket, thumbnailPaths, expiresInSeconds),
  ]);

  const groupedAssociations = new Map<string, MediaAssociation[]>();
  for (const association of params.associations) {
    const current = groupedAssociations.get(association.mediaAssetId) || [];
    current.push(association);
    groupedAssociations.set(association.mediaAssetId, current);
  }

  return params.rows.map((row) => {
    const mimeType = (row.mime_type || "application/octet-stream").toLowerCase();
    const assetType = inferAssetType(mimeType, row.asset_type);
    const path = row.storage_path ? normalizeStoragePath(row.storage_path) : "";
    const thumbnailPath = normalizeStoragePath(row.thumbnail_path || row.poster_path || "");

    const previewUrl = !path
      ? ""
      : isAbsoluteUrl(path)
        ? path
        : previewMap.get(path) || "";

    const signedThumb = thumbnailPath
      ? (isAbsoluteUrl(thumbnailPath) ? thumbnailPath : thumbnailMap.get(thumbnailPath) || "")
      : "";

    const thumbnailUrl = signedThumb || previewUrl;

    const associations = groupedAssociations.get(row.id) || [];
    const firstAssociation = associations[0];
    const usageStatus = usageRightsStatus(
      firstAssociation?.usageRightsStart,
      firstAssociation?.usageRightsEnd,
      now,
    );

    const error = previewUrl ? null : toCustomerSafeError("not found");

    return {
      assetId: row.id,
      previewUrl,
      downloadUrl: `${params.downloadRoutePrefix || "/api/media/download"}/${row.id}`,
      thumbnailUrl,
      expiresAt: previewUrl && !isAbsoluteUrl(previewUrl) ? expiresAt : null,
      mimeType,
      isDownloadAllowed: Boolean(path),
      fileName: row.file_name,
      assetType,
      createdAt: row.created_at,
      source: row.source || "UPLOADED",
      generationStatus: row.generation_status || "READY",
      generationJobId: row.generation_job_id,
      width: row.width,
      height: row.height,
      durationSeconds: row.duration_seconds,
      sizeBytes: Number(row.size_bytes || 0),
      folderId: row.folder_id,
      tags: row.tags || [],
      campaignIds: associations.map((item) => item.campaignId).filter(Boolean) as string[],
      creatorName: firstAssociation?.creatorName || null,
      usageRightsStart: firstAssociation?.usageRightsStart || null,
      usageRightsEnd: firstAssociation?.usageRightsEnd || null,
      usageRightsStatus: usageStatus,
      approvalStatus: firstAssociation?.approvalStatus || null,
      label: toLabel(row.source || "UPLOADED"),
      error,
    } satisfies ResolvedMediaAsset;
  });
}

export type MediaCapabilities = {
  canView: boolean;
  canDownload: boolean;
  canRename: boolean;
  canEditTags: boolean;
  canMoveFolder: boolean;
  canAddToCollection: boolean;
  canAddToCampaign: boolean;
  canAddToContent: boolean;
  canCreateWithAsset: boolean;
  canFavorite: boolean;
  canArchive: boolean;
  canDelete: boolean;
};

export const DEFAULT_MEDIA_CAPABILITIES: MediaCapabilities = {
  canView: true,
  canDownload: true,
  canRename: false,
  canEditTags: false,
  canMoveFolder: false,
  canAddToCollection: false,
  canAddToCampaign: false,
  canAddToContent: false,
  canCreateWithAsset: false,
  canFavorite: false,
  canArchive: false,
  canDelete: false,
};

export function mediaCapabilitiesForRole(role: string | null | undefined): MediaCapabilities {
  const normalized = String(role || "GUEST").trim().toUpperCase();
  const canEdit = ["OWNER", "ADMIN", "MANAGER", "EDITOR"].includes(normalized);
  const canManage = ["OWNER", "ADMIN", "MANAGER"].includes(normalized);

  return {
    ...DEFAULT_MEDIA_CAPABILITIES,
    canRename: canEdit,
    canEditTags: canEdit,
    canMoveFolder: canEdit,
    canAddToCollection: canEdit,
    canAddToCampaign: canEdit,
    canAddToContent: canEdit,
    canCreateWithAsset: canEdit,
    canFavorite: canEdit,
    canArchive: canEdit,
    canDelete: canManage,
  };
}
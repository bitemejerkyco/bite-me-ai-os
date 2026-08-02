import type { MediaAsset } from "@/features/core/local-os";

export function applyFavoriteUpdate(
  assets: MediaAsset[],
  assetId: string,
  isFavorite: boolean,
): MediaAsset[] {
  return assets.map((asset) => (
    asset.id === assetId
      ? { ...asset, isFavorite }
      : asset
  ));
}

export function applyArchiveUpdate(
  assets: MediaAsset[],
  assetId: string,
  archivedAt: string | null,
): MediaAsset[] {
  return assets.map((asset) => {
    if (asset.id !== assetId) return asset;
    if (!archivedAt) {
      return { ...asset, archivedAt: undefined };
    }
    return { ...asset, archivedAt };
  });
}

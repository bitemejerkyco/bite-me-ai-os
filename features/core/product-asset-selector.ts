import type { MediaAsset } from "@/features/core/local-os";
import type { VideoProject } from "@/features/core/video-project";

export const SUPPORTED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const MAX_PRODUCT_IMAGE_BYTES = 25 * 1024 * 1024;

export const EXACT_PRODUCT_REQUIRED_MESSAGE =
  "Choose or upload an approved product image before generating in Exact Product Mode.";

export type ProductAssetChoice = {
  id: string;
  name: string;
  storagePath: string;
  type: string;
  workspaceId?: string;
  archivedAt?: string;
  width?: number;
  height?: number;
  tags: string[];
  productMetadata?: MediaAsset["productMetadata"];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isProductImageType(mimeType: string): boolean {
  return SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(text(mimeType).toLowerCase());
}

export function isApprovedProductAsset(asset: ProductAssetChoice): boolean {
  return Boolean(asset.productMetadata?.approvedForGeneration);
}

export function isExplicitProductAsset(
  asset: Pick<ProductAssetChoice, "type" | "workspaceId" | "archivedAt" | "productMetadata">,
  activeWorkspaceId?: string,
): boolean {
  if (!isProductImageType(asset.type)) return false;
  if (asset.archivedAt) return false;
  if (activeWorkspaceId && text(asset.workspaceId) !== text(activeWorkspaceId)) return false;
  return Boolean(asset.productMetadata?.approvedForGeneration);
}

export function hasLockedProductUsage(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const raw = metadata as Record<string, unknown>;
  const manifest = raw.compositionManifest;
  if (!manifest || typeof manifest !== "object") return false;
  const layers = (manifest as Record<string, unknown>).layers;
  if (!Array.isArray(layers)) return false;
  return layers.some((layer) => {
    if (!layer || typeof layer !== "object") return false;
    const item = layer as Record<string, unknown>;
    return item.type === "product" && item.locked === true && item.approvedForGeneration === true;
  });
}

export function isProductTaggedAsset(asset: ProductAssetChoice): boolean {
  return asset.tags.includes("product");
}

export function toProductAssetChoice(asset: MediaAsset): ProductAssetChoice | null {
  if (!asset.storagePath || !isProductImageType(asset.type)) return null;
  return {
    id: asset.id,
    name: asset.name,
    storagePath: asset.storagePath,
    type: asset.type,
    workspaceId: asset.workspaceId,
    archivedAt: asset.archivedAt,
    width: asset.width,
    height: asset.height,
    tags: asset.tags || [],
    productMetadata: asset.productMetadata,
  };
}

export function buildProductAssetChoices(
  assets: MediaAsset[],
  options?: { includeUnapproved?: boolean; activeWorkspaceId?: string },
): ProductAssetChoice[] {
  const includeUnapproved = Boolean(options?.includeUnapproved);
  return assets
    .filter((asset) => isProductImageType(asset.type))
    .filter((asset) => !asset.archivedAt)
    .filter((asset) => !options?.activeWorkspaceId || text(asset.workspaceId) === text(options.activeWorkspaceId))
    .map(toProductAssetChoice)
    .filter((asset): asset is ProductAssetChoice => Boolean(asset))
    .filter((asset) => includeUnapproved || isExplicitProductAsset(asset, options?.activeWorkspaceId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function validateProductImageUpload(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!isProductImageType(file.type)) {
    return "Only PNG, JPEG, and WEBP product images are supported.";
  }
  if (file.size <= 0) {
    return "The selected file is empty.";
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return "Product image must be 25MB or smaller.";
  }
  if (!text(file.name)) {
    return "The selected file is missing a filename.";
  }
  return null;
}

export function deriveSelectedProductAssetFromProject(project: VideoProject | null): {
  assetId: string;
  storagePath: string;
} | null {
  if (!project) return null;
  for (const scene of project.scenes || []) {
    const assetId = text(scene.productAssetId);
    if (!assetId) continue;
    return {
      assetId,
      storagePath: text(scene.productAssetStoragePath),
    };
  }
  return null;
}

export function applyProductSceneMetadata(
  scenes: VideoProject["scenes"],
  productAsset: ProductAssetChoice | null,
  allowMotion: boolean,
): VideoProject["scenes"] {
  if (!productAsset) return scenes;
  return scenes.map((scene) => ({
    ...scene,
    productAssetId: productAsset.id,
    productAssetName: productAsset.name,
    productAssetStoragePath: productAsset.storagePath,
    productMode: allowMotion ? "AI_PRODUCT_MOTION" : "EXACT_PRODUCT",
    productPlacement: productAsset.productMetadata?.position || "center frame",
    productScale: productAsset.productMetadata?.scale || "large and readable",
    productOpacity: scene.productOpacity ?? 1,
    productShadow: scene.productShadow ?? true,
    productRotation: scene.productRotation ?? 0,
    productEntrance: scene.productEntrance ?? "FADE_IN",
    productExit: scene.productExit ?? "FADE_OUT",
    productZoom: scene.productZoom ?? "NONE",
    productBackground: productAsset.productMetadata?.background || "brand-safe neutral background",
    productSafeArea: productAsset.productMetadata?.safeArea || "leave room for overlays",
    productLocked: productAsset.productMetadata?.locked ?? true,
    preserveOriginalAsset: productAsset.productMetadata?.preserveOriginalAsset ?? true,
  }));
}

export function describeAssetDimensions(asset: ProductAssetChoice): string {
  if (!asset.width || !asset.height) return "Dimensions unavailable";
  return `${asset.width} x ${asset.height}`;
}

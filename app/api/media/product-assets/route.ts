import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { rowBelongsToWorkspace } from "@/features/media/workspace-access";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  isProductImageType,
} from "@/features/core/product-asset-selector";

type ProductAssetMetadata = {
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
};

type MediaAssetRow = {
  id: string;
  workspace_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  width: number | null;
  height: number | null;
  archived_at: string | null;
};

type ApproveBody = {
  assetId?: unknown;
  allowAiMotion?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeStoragePathForWorkspace(workspaceId: string, storagePath: string): boolean {
  const normalized = storagePath.replace(/\\/g, "/").trim();
  if (!normalized) return false;
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/") || normalized.startsWith("./")) return false;
  return normalized.startsWith(`${workspaceId}/`);
}

function readProductMetadata(row: MediaAssetRow): ProductAssetMetadata {
  const metadataSource = row.metadata && typeof row.metadata === "object"
    ? ((row.metadata.productAsset && typeof row.metadata.productAsset === "object")
      ? row.metadata.productAsset
      : row.metadata)
    : null;

  if (!metadataSource || typeof metadataSource !== "object") {
    return {};
  }

  const metadata = metadataSource as Record<string, unknown>;
  const role = metadata.role === "PRIMARY" || metadata.role === "ALTERNATE" || metadata.role === "REFERENCE"
    ? metadata.role
    : metadata.assetRole === "PRIMARY" || metadata.assetRole === "ALTERNATE" || metadata.assetRole === "REFERENCE"
      ? metadata.assetRole
      : undefined;

  return {
    productId: typeof metadata.productId === "string" ? metadata.productId : undefined,
    productName: typeof metadata.productName === "string" ? metadata.productName : undefined,
    role,
    assetRole: role,
    isPrimaryProductImage: typeof metadata.isPrimaryProductImage === "boolean"
      ? metadata.isPrimaryProductImage
      : role === "PRIMARY"
        ? true
        : undefined,
    angle: typeof metadata.angle === "string" ? metadata.angle : undefined,
    locked: typeof metadata.locked === "boolean" ? metadata.locked : undefined,
    approvedForGeneration: typeof metadata.approvedForGeneration === "boolean" ? metadata.approvedForGeneration : undefined,
    transparentBackground: typeof metadata.transparentBackground === "boolean" ? metadata.transparentBackground : undefined,
    originalAssetId: typeof metadata.originalAssetId === "string" ? metadata.originalAssetId : undefined,
    exactProductMode: typeof metadata.exactProductMode === "boolean" ? metadata.exactProductMode : undefined,
    allowAiMotion: typeof metadata.allowAiMotion === "boolean" ? metadata.allowAiMotion : undefined,
    preserveOriginalAsset: typeof metadata.preserveOriginalAsset === "boolean" ? metadata.preserveOriginalAsset : undefined,
    originalStoragePath: typeof metadata.originalStoragePath === "string" ? metadata.originalStoragePath : undefined,
    background: typeof metadata.background === "string" ? metadata.background : undefined,
    position: typeof metadata.position === "string" ? metadata.position : undefined,
    scale: typeof metadata.scale === "string" ? metadata.scale : undefined,
    safeArea: typeof metadata.safeArea === "string" ? metadata.safeArea : undefined,
    notes: typeof metadata.notes === "string" ? metadata.notes : undefined,
  };
}

function mapAsset(row: MediaAssetRow) {
  const metadata = readProductMetadata(row);
  return {
    id: row.id,
    name: row.file_name,
    storagePath: row.storage_path,
    type: row.mime_type || "",
    width: Number.isFinite(Number(row.width)) ? Number(row.width) : undefined,
    height: Number.isFinite(Number(row.height)) ? Number(row.height) : undefined,
    sizeBytes: Number(row.size_bytes || 0),
    tags: row.tags || [],
    approvedForGeneration: Boolean(metadata.approvedForGeneration),
    productMetadata: metadata,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const includeAll = new URL(request.url).searchParams.get("includeAll") === "true";

    const { data, error } = await context.supabase
      .from("media_assets")
      .select("id,workspace_id,storage_path,file_name,mime_type,size_bytes,tags,metadata,width,height,archived_at")
      .eq("workspace_id", context.workspaceId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Unable to load workspace media assets." }, { status: 400 });
    }

    const rows = ((data || []) as MediaAssetRow[])
      .filter((row) => rowBelongsToWorkspace(context.workspaceId, row.workspace_id))
      .filter((row) => isProductImageType(text(row.mime_type).toLowerCase()))
      .filter((row) => isSafeStoragePathForWorkspace(context.workspaceId, row.storage_path));

    const assets = rows
      .map(mapAsset)
      .filter((asset) => includeAll || asset.approvedForGeneration);

    return NextResponse.json({ ok: true, assets }, { headers: { "cache-control": "no-store" } });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to load product assets.";
    return NextResponse.json({ error: message || "Unable to load product assets." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json().catch(() => null)) as ApproveBody | null;
    const assetId = text(body?.assetId);
    if (!assetId) {
      return NextResponse.json({ error: "Asset ID is required." }, { status: 400 });
    }

    const { data: rowData, error: rowError } = await context.supabase
      .from("media_assets")
      .select("id,workspace_id,storage_path,file_name,mime_type,size_bytes,tags,metadata,width,height,archived_at")
      .eq("workspace_id", context.workspaceId)
      .eq("id", assetId)
      .is("archived_at", null)
      .maybeSingle();

    if (rowError) {
      return NextResponse.json({ error: "Unable to read product asset." }, { status: 400 });
    }

    const row = (rowData || null) as MediaAssetRow | null;
    if (!row || !rowBelongsToWorkspace(context.workspaceId, row.workspace_id)) {
      return NextResponse.json({ error: "Product asset not found in this workspace." }, { status: 404 });
    }

    if (!isSafeStoragePathForWorkspace(context.workspaceId, row.storage_path)) {
      return NextResponse.json({ error: "Selected product image path is invalid." }, { status: 400 });
    }

    const mimeType = text(row.mime_type).toLowerCase();
    if (!isProductImageType(mimeType)) {
      return NextResponse.json({ error: "Unsupported product image type. Use PNG, JPEG, or WEBP." }, { status: 400 });
    }

    if (Number(row.size_bytes || 0) > MAX_PRODUCT_IMAGE_BYTES) {
      return NextResponse.json({ error: "Product image must be 25MB or smaller." }, { status: 400 });
    }

    const allowAiMotion = body?.allowAiMotion === true;
    const previous = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const productMetadata = {
      ...readProductMetadata(row),
      approvedForGeneration: true,
      role: "PRIMARY",
      assetRole: "PRIMARY",
      isPrimaryProductImage: true,
      locked: true,
      exactProductMode: true,
      allowAiMotion,
      preserveOriginalAsset: true,
      originalAssetId: row.id,
      originalStoragePath: row.storage_path,
      transparentBackground: true,
    } satisfies ProductAssetMetadata;

    const tags = Array.from(new Set([...(row.tags || []), "product", "exact-product"]))
      .filter((value) => text(value).length > 0);

    const { error: updateError } = await context.supabase
      .from("media_assets")
      .update({
        tags,
        metadata: {
          ...previous,
          productAsset: productMetadata,
        },
      })
      .eq("workspace_id", context.workspaceId)
      .eq("id", row.id);

    if (updateError) {
      return NextResponse.json({ error: "Unable to approve product asset." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      asset: {
        ...mapAsset(row),
        approvedForGeneration: true,
        tags,
        productMetadata,
      },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to approve product asset.";
    return NextResponse.json({ error: message || "Unable to approve product asset." }, { status: 500 });
  }
}

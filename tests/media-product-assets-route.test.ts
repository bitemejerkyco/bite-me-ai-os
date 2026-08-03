import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceContextMock = vi.fn();

vi.mock("@/features/marketing-director/workspace-context", () => ({
  requireWorkspaceContext: requireWorkspaceContextMock,
}));

type Row = {
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

function makeContext(rows: Row[]) {
  let updatePayload: Record<string, unknown> | null = null;
  let patchTargetId = "";

  const selectQueryBuilder = {
    eq: vi.fn((field: string, value: string) => {
      if (field === "workspace_id") {
        return {
          is: vi.fn(() => ({
            order: vi.fn(async () => ({ data: rows, error: null })),
          })),
          eq: vi.fn((nextField: string, nextValue: string) => {
            if (nextField === "id") {
              patchTargetId = nextValue;
            }
            return {
              is: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: rows.find((row) => row.id === patchTargetId) || null,
                  error: null,
                })),
              })),
            };
          }),
        };
      }

      patchTargetId = value;
      return {
        is: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: rows.find((row) => row.id === patchTargetId) || null,
            error: null,
          })),
        })),
      };
    }),
  };

  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => selectQueryBuilder),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }),
    })),
  };

  requireWorkspaceContextMock.mockResolvedValue({
    workspaceId: "workspace-1",
    supabase,
  });

  return {
    getUpdatePayload: () => updatePayload,
  };
}

describe("media product assets route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns approved workspace images by default and never includes another workspace", async () => {
    makeContext([
      {
        id: "asset-approved",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/approved.png",
        file_name: "approved.png",
        mime_type: "image/png",
        size_bytes: 1024,
        tags: ["product"],
        metadata: { productAsset: { approvedForGeneration: true } },
        width: 1200,
        height: 1200,
        archived_at: null,
      },
      {
        id: "asset-unapproved",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/unapproved.png",
        file_name: "unapproved.png",
        mime_type: "image/png",
        size_bytes: 1024,
        tags: [],
        metadata: { productAsset: { approvedForGeneration: false } },
        width: 1200,
        height: 1200,
        archived_at: null,
      },
      {
        id: "asset-other-workspace",
        workspace_id: "workspace-2",
        storage_path: "workspace-2/user-1/other.png",
        file_name: "other.png",
        mime_type: "image/png",
        size_bytes: 1024,
        tags: ["product"],
        metadata: { productAsset: { approvedForGeneration: true } },
        width: 1200,
        height: 1200,
        archived_at: null,
      },
    ]);

    const { GET } = await import("@/app/api/media/product-assets/route");
    const response = await GET(new Request("https://postmotive.example/api/media/product-assets"));
    const payload = (await response.json()) as { assets?: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.assets?.map((item) => item.id)).toEqual(["asset-approved"]);
  });

  it("includes unapproved workspace images when includeAll=true", async () => {
    makeContext([
      {
        id: "asset-approved",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/approved.png",
        file_name: "approved.png",
        mime_type: "image/png",
        size_bytes: 1024,
        tags: ["product"],
        metadata: { productAsset: { approvedForGeneration: true } },
        width: 1200,
        height: 1200,
        archived_at: null,
      },
      {
        id: "asset-unapproved",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/unapproved.png",
        file_name: "unapproved.png",
        mime_type: "image/png",
        size_bytes: 1024,
        tags: [],
        metadata: { productAsset: { approvedForGeneration: false } },
        width: 1200,
        height: 1200,
        archived_at: null,
      },
    ]);

    const { GET } = await import("@/app/api/media/product-assets/route");
    const response = await GET(new Request("https://postmotive.example/api/media/product-assets?includeAll=true"));
    const payload = (await response.json()) as { assets?: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.assets?.map((item) => item.id)).toEqual([
      "asset-approved",
      "asset-unapproved",
    ]);
  });

  it("rejects unsupported upload types during approval", async () => {
    makeContext([
      {
        id: "asset-gif",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/asset.gif",
        file_name: "asset.gif",
        mime_type: "image/gif",
        size_bytes: 1024,
        tags: [],
        metadata: {},
        width: 500,
        height: 500,
        archived_at: null,
      },
    ]);

    const { PATCH } = await import("@/app/api/media/product-assets/route");
    const response = await PATCH(
      new Request("https://postmotive.example/api/media/product-assets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: "asset-gif" }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toContain("Unsupported product image type");
  });

  it("rejects oversized product images during approval", async () => {
    makeContext([
      {
        id: "asset-large",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/large.png",
        file_name: "large.png",
        mime_type: "image/png",
        size_bytes: 30 * 1024 * 1024,
        tags: [],
        metadata: {},
        width: 500,
        height: 500,
        archived_at: null,
      },
    ]);

    const { PATCH } = await import("@/app/api/media/product-assets/route");
    const response = await PATCH(
      new Request("https://postmotive.example/api/media/product-assets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: "asset-large" }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toContain("25MB");
  });

  it("approves workspace image and stores product metadata without signed URLs", async () => {
    const context = makeContext([
      {
        id: "asset-ok",
        workspace_id: "workspace-1",
        storage_path: "workspace-1/user-1/product.png",
        file_name: "product.png",
        mime_type: "image/png",
        size_bytes: 1024,
        tags: ["uploaded"],
        metadata: {},
        width: 500,
        height: 500,
        archived_at: null,
      },
    ]);

    const { PATCH } = await import("@/app/api/media/product-assets/route");
    const response = await PATCH(
      new Request("https://postmotive.example/api/media/product-assets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: "asset-ok" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = context.getUpdatePayload() as {
      metadata?: { productAsset?: Record<string, unknown> };
      tags?: string[];
    } | null;
    expect(payload).toBeTruthy();
    expect(payload?.tags).toContain("product");
    expect(payload?.tags).toContain("exact-product");
    expect(payload?.metadata?.productAsset?.approvedForGeneration).toBe(true);
    expect(payload?.metadata?.productAsset?.originalStoragePath).toBe("workspace-1/user-1/product.png");
    expect(payload?.metadata?.productAsset?.signedUrl).toBeUndefined();
  });
});

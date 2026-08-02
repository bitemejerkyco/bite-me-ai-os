import { describe, expect, it } from "vitest";
import {
  inferAssetType,
  isAbsoluteUrl,
  normalizeStoragePath,
  resolveMediaRows,
  shouldRefreshSignedUrl,
  usageRightsStatus,
  type MediaUrlResolverRow,
} from "@/features/media/media-url-resolver";

const stubStorage = {
  from() {
    return {
      async createSignedUrls(paths: string[]) {
        return {
          data: paths.map((path) => ({
            path,
            signedUrl: `https://signed.example/${encodeURIComponent(path)}`,
          })),
          error: null,
        };
      },
    };
  },
};

function row(partial: Partial<MediaUrlResolverRow>): MediaUrlResolverRow {
  return {
    id: "asset_1",
    workspace_id: "ws_1",
    file_name: "file.png",
    asset_type: "image",
    mime_type: "image/png",
    storage_path: "ws_1/user/a-file.png",
    thumbnail_path: null,
    poster_path: null,
    size_bytes: 1200,
    tags: ["image"],
    created_at: "2026-08-01T00:00:00.000Z",
    folder_id: null,
    source: "UPLOADED",
    generation_status: "READY",
    generation_job_id: null,
    width: null,
    height: null,
    duration_seconds: null,
    archived_at: null,
    ...partial,
  };
}

describe("media url resolver", () => {
  it("normalizes legacy storage paths", () => {
    expect(normalizeStoragePath("/brand-media/ws/a.png")).toBe("ws/a.png");
    expect(
      normalizeStoragePath("storage/v1/object/sign/brand-media/ws/a.png"),
    ).toBe("ws/a.png");
  });

  it("detects absolute urls", () => {
    expect(isAbsoluteUrl("https://example.com/a.jpg")).toBe(true);
    expect(isAbsoluteUrl("ws/a.jpg")).toBe(false);
  });

  it("infers asset type from mime", () => {
    expect(inferAssetType("image/png")).toBe("image");
    expect(inferAssetType("video/mp4")).toBe("video");
    expect(inferAssetType("application/pdf")).toBe("file");
  });

  it("flags expiring and expired rights", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    expect(usageRightsStatus(null, null, now)).toBe("NONE");
    expect(usageRightsStatus("2026-07-01", "2026-07-31", now)).toBe("EXPIRED");
    expect(usageRightsStatus("2026-07-01", "2026-08-04", now)).toBe("EXPIRING");
    expect(usageRightsStatus("2026-07-01", "2026-12-01", now)).toBe("ACTIVE");
  });

  it("indicates signed url refresh only when expired", () => {
    const now = Date.parse("2026-08-01T00:00:00.000Z");
    expect(shouldRefreshSignedUrl("2026-08-01T00:00:20.000Z", now)).toBe(false);
    expect(shouldRefreshSignedUrl("2026-07-31T23:59:59.000Z", now)).toBe(true);
    expect(shouldRefreshSignedUrl("2026-08-01T00:10:00.000Z", now)).toBe(false);
  });

  it("resolves uploaded image thumbnail and preview", async () => {
    const [resolved] = await resolveMediaRows({
      rows: [
        row({
          id: "img_1",
          file_name: "photo.png",
          mime_type: "image/png",
          thumbnail_path: "ws_1/thumbs/photo.png",
          width: 1024,
          height: 768,
        }),
      ],
      associations: [],
      storage: stubStorage,
    });

    expect(resolved.assetId).toBe("img_1");
    expect(resolved.previewUrl).toContain("signed.example");
    expect(resolved.thumbnailUrl).toContain("signed.example");
    expect(resolved.mimeType).toBe("image/png");
  });

  it("resolves generated video preview using poster and duration", async () => {
    const [resolved] = await resolveMediaRows({
      rows: [
        row({
          id: "vid_1",
          file_name: "render.mp4",
          mime_type: "video/mp4",
          storage_path: "ws_1/generated/render.mp4",
          poster_path: "ws_1/generated/render.jpg",
          source: "GENERATED",
          generation_status: "READY",
          generation_job_id: "job_123",
          duration_seconds: 18.5,
        }),
      ],
      associations: [],
      storage: stubStorage,
    });

    expect(resolved.assetType).toBe("video");
    expect(resolved.label).toBe("generated");
    expect(resolved.generationJobId).toBe("job_123");
    expect(resolved.durationSeconds).toBe(18.5);
    expect(resolved.thumbnailUrl).toContain("render.jpg");
  });

  it("does not expose raw private path when signing fails", async () => {
    const failingStorage = {
      from() {
        return {
          async createSignedUrls() {
            return { data: null, error: { message: "failed" } };
          },
        };
      },
    };

    const [resolved] = await resolveMediaRows({
      rows: [row({ id: "raw_1", storage_path: "ws_1/private/raw.png" })],
      associations: [],
      storage: failingStorage,
    });

    expect(resolved.previewUrl).toBe("");
    expect(resolved.error).toBe("Preview unavailable");
    expect(resolved.downloadUrl).toContain("/api/media/download/raw_1");
  });
});

import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fakeActor = {
  supabase: {} as never,
  userId: "user-1",
  workspaceId: "workspace-1",
};

vi.mock("@/app/api/integrations/tiktok/_lib", () => ({
  resolveTikTokActor: vi.fn(async () => fakeActor),
  safeTikTokError: (error: unknown) =>
    NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 }),
}));

const publishJobService = {
  createTikTokPublishJob: vi.fn(),
  initializeTikTokInboxUpload: vi.fn(),
  refreshTikTokPublishStatus: vi.fn(),
};

vi.mock("@/features/integrations/tiktok/publish-jobs", () => ({
  TikTokPublishJobService: class {
    createTikTokPublishJob = publishJobService.createTikTokPublishJob;
    initializeTikTokInboxUpload = publishJobService.initializeTikTokInboxUpload;
    refreshTikTokPublishStatus = publishJobService.refreshTikTokPublishStatus;
  },
}));

vi.mock("@/features/integrations/tiktok/service", () => ({
  TikTokConnectionService: class {
    sendScheduledVideoToInbox = vi.fn();
  },
}));

vi.mock("@/lib/auth/server", () => ({
  getViewerContext: vi.fn(),
}));

vi.mock("@/features/admin/audit", () => ({
  writeAdminAuditEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

describe("TikTok routes and admin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe upload job data without tokens", async () => {
    publishJobService.createTikTokPublishJob.mockResolvedValue({ id: "job-1" });
    publishJobService.initializeTikTokInboxUpload.mockResolvedValue({
      id: "job-1",
      workspaceId: "workspace-1",
      connectionId: "connection-1",
      mediaAssetId: "media-1",
      publishMode: "beta_upload",
      publishId: "publish-1",
      status: "processing",
      caption: "Caption",
      errorCode: null,
      errorMessage: null,
      consentedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      completedAt: null,
      failedAt: null,
      progress: 75,
      reconnectRequired: false,
      retryable: false,
      message: "TikTok is still processing the upload.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mediaAsset: { id: "media-1", name: "clip.mp4", mimeType: "video/mp4", sizeBytes: 100 },
    });

    const { POST } = await import("@/app/api/integrations/tiktok/upload/route");
    const response = await POST(
      new Request("https://postmotive.example/api/integrations/tiktok/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaAssetId: "media-1",
          caption: "Caption",
          hashtags: ["#brand"],
          consent: true,
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.ok).toBe(true);
    expect(payload.ok).toBe(true);
    expect(payload.data.publishId).toBe("publish-1");
    expect(JSON.stringify(payload)).not.toContain("access_token");
    expect(JSON.stringify(payload)).not.toContain("refresh_token");
  });

  it("passes direct-post mode and controls into shared upload job creation", async () => {
    publishJobService.createTikTokPublishJob.mockResolvedValue({ id: "job-direct" });
    publishJobService.initializeTikTokInboxUpload.mockResolvedValue({
      id: "job-direct",
      workspaceId: "workspace-1",
      connectionId: "connection-1",
      mediaAssetId: "media-1",
      publishMode: "direct_post",
      publishId: "publish-direct",
      status: "processing",
      caption: "Direct caption",
      errorCode: null,
      errorMessage: null,
      consentedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      completedAt: null,
      failedAt: null,
      progress: 75,
      reconnectRequired: false,
      retryable: false,
      message: "TikTok is still processing the upload.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mediaAsset: { id: "media-1", name: "clip.mp4", mimeType: "video/mp4", sizeBytes: 100 },
    });

    const { POST } = await import("@/app/api/integrations/tiktok/upload/route");
    const response = await POST(
      new Request("https://postmotive.example/api/integrations/tiktok/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaAssetId: "media-1",
          caption: "Direct caption",
          hashtags: ["#brand"],
          consent: true,
          mode: "DIRECT_POST",
          privacyLevel: "SELF_ONLY",
          disableComment: true,
          disableDuet: false,
          disableStitch: true,
          commercialContentDisclosure: true,
          brandedContentToggle: false,
          idempotencyKey: "job-direct-key",
        }),
      }) as never,
    );

    expect(response.ok).toBe(true);
    expect(publishJobService.createTikTokPublishJob).toHaveBeenCalledWith(
      fakeActor,
      expect.objectContaining({
        mediaAssetId: "media-1",
        mode: "DIRECT_POST",
        privacyLevel: "SELF_ONLY",
        disableComment: true,
        disableDuet: false,
        disableStitch: true,
        commercialContentDisclosure: true,
        brandedContentToggle: false,
        idempotencyKey: "job-direct-key",
      }),
    );
  });

  it("returns safe job status data from the job polling route", async () => {
    publishJobService.refreshTikTokPublishStatus.mockResolvedValue({
      id: "job-1",
      workspaceId: "workspace-1",
      connectionId: "connection-1",
      mediaAssetId: "media-1",
      publishMode: "beta_upload",
      publishId: "publish-1",
      status: "inbox_delivered",
      caption: "Caption",
      errorCode: null,
      errorMessage: null,
      consentedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      failedAt: null,
      progress: 100,
      reconnectRequired: false,
      retryable: false,
      message: "TikTok confirmed delivery to the inbox or drafts flow.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mediaAsset: { id: "media-1", name: "clip.mp4", mimeType: "video/mp4", sizeBytes: 100 },
    });

    const { GET } = await import("@/app/api/integrations/tiktok/jobs/[jobId]/route");
    const response = await GET(new Request("https://postmotive.example/api/integrations/tiktok/jobs/job-1") as never, { params: { jobId: "job-1" } });
    const payload = await response.json();

    expect(response.ok).toBe(true);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("inbox_delivered");
    expect(JSON.stringify(payload)).not.toContain("access_token");
    expect(JSON.stringify(payload)).not.toContain("refresh_token");
  });

  it("blocks non-super-admin TikTok admin mutations", async () => {
    const { getViewerContext } = await import("@/lib/auth/server");
    vi.mocked(getViewerContext).mockResolvedValue({
      userId: "user-1",
      isSuperAdmin: false,
    } as never);

    const { updateTikTokWorkspaceBetaAccessAction } = await import("@/app/admin/tiktok/actions");
    const formData = new FormData();
    formData.append("workspaceId", "workspace-1");
    formData.append("enabled", "true");
    formData.append("reason", "needed for beta");
    await expect(
      updateTikTokWorkspaceBetaAccessAction(formData as never),
    ).rejects.toThrow();
  });
});
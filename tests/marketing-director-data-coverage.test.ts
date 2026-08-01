import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildDataCoverageModel } from "@/features/marketing-director/data-coverage";

describe("marketing director data coverage", () => {
  it("marks revenue as missing when no connected revenue records exist", () => {
    const coverage = buildDataCoverageModel({
      workspaceId: "ws-1",
      workspaceProfileComplete: true,
      hasProductsTable: true,
      productsCount: 5,
      mediaCount: 3,
      contentDraftCount: 4,
      scheduledPostsCount: 1,
      tiktokConnected: true,
      tiktokLastSyncedAt: new Date().toISOString(),
      amazonAdsConnected: false,
      amazonAdsMessage: "Not connected",
      emailConnected: false,
      emailMessage: "Not connected",
      performanceSnapshotCount: 0,
      performanceLastRecordedAt: null,
      revenueRecordsCount: 0,
      aiUsageCount: 1,
      aiUsageLastAt: new Date().toISOString(),
      videoTransactionsCount: 1,
      videoTransactionsLastAt: new Date().toISOString(),
    });

    const revenue = coverage.sources.find((source) => source.key === "revenue_tracking");
    expect(revenue?.health).toBe("missing");
    expect(revenue?.message).toContain("Insufficient connected revenue data");
  });
});

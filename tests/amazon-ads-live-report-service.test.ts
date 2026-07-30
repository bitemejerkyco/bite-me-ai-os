import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  AmazonAdsLiveReportService,
  assertDateRange,
} from "@/features/marketing/providers/amazon-ads/live/report-service";
import { AmazonAdsClient } from "@/features/platform/connectors/providers/amazon/clients/amazon-ads-client";

const actor = { workspaceId: "ws_1", userId: "user_1" };
const access = {
  workspaceId: actor.workspaceId,
  connectionId: "connection_1",
  clientId: "client_1",
  accessToken: "access_1",
  profileId: "1234567890",
  marketplaceId: "US",
  region: "na" as const,
};

describe("Amazon Ads live report service", () => {
  it("loads, decompresses, and normalizes a completed read-only report", async () => {
    const requestReport = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      data: { reportId: "report-1" },
      headers: new Headers(),
    });
    const pollReport = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { reportId: "report-1", status: "PENDING" },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          reportId: "report-1",
          status: "COMPLETED",
          url: "https://reports.example.com/report-1.gz",
        },
        headers: new Headers(),
      });
    const bytes = gzipSync(
      JSON.stringify([
        {
          date: "2026-07-20",
          campaignId: "campaign-1",
          campaignName: "Jerky exact",
          campaignStatus: "ENABLED",
          campaignBudgetAmount: 50,
          keywordId: "keyword-1",
          keyword: "beef jerky",
          matchType: "EXACT",
          searchTerm: "premium beef jerky",
          impressions: 1000,
          clicks: 50,
          cost: 25,
          purchases7d: 5,
          sales7d: 100,
        },
      ]),
    );
    const downloadReport = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      headers: new Headers(),
    });
    const service = new AmazonAdsLiveReportService({
      connectionService: {
        getLiveReadAccess: vi.fn().mockResolvedValue(access),
      },
      clientFactory: () => ({ requestReport, pollReport, downloadReport }),
      sleep: async () => undefined,
      now: () => new Date("2026-07-23T12:00:00.000Z"),
    });

    const result = await service.loadSearchTermPerformance({
      actor,
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      correlationId: "correlation-1",
    });

    expect(result.reportId).toBe("report-1");
    expect(result.records).toEqual([
      expect.objectContaining({
        workspaceId: "ws_1",
        providerId: "amazon-ads-live",
        profileId: "1234567890",
        marketplaceId: "US",
        campaignName: "Jerky exact",
        searchTerm: "premium beef jerky",
        spend: 25,
        sales: 100,
        orders: 5,
      }),
    ]);
    expect(requestReport).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          reportTypeId: "spSearchTerm",
          adProduct: "SPONSORED_PRODUCTS",
          format: "GZIP_JSON",
        }),
      }),
    );
    expect(downloadReport).toHaveBeenCalledWith("https://reports.example.com/report-1.gz");
  });

  it("returns an explicit pending state without downloading", async () => {
    const downloadReport = vi.fn();
    const service = new AmazonAdsLiveReportService({
      connectionService: {
        getLiveReadAccess: vi.fn().mockResolvedValue(access),
      },
      clientFactory: () => ({
        requestReport: vi.fn().mockResolvedValue({
          ok: true,
          status: 202,
          data: { reportId: "report-2" },
          headers: new Headers(),
        }),
        pollReport: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          data: { reportId: "report-2", status: "PENDING" },
          headers: new Headers(),
        }),
        downloadReport,
      }),
      sleep: async () => undefined,
      maxPollAttempts: 2,
    });

    await expect(
      service.loadSearchTermPerformance({
        actor,
        startDate: "2026-07-01",
        endDate: "2026-07-07",
      }),
    ).rejects.toThrow("REPORT_PENDING");
    expect(downloadReport).not.toHaveBeenCalled();
  });

  it("rejects malformed and excessive report ranges before requesting access", () => {
    expect(() => assertDateRange("2026/07/01", "2026-07-02")).toThrow(
      "REPORT_RANGE_INVALID",
    );
    expect(() => assertDateRange("2026-01-01", "2026-03-01")).toThrow(
      "REPORT_RANGE_INVALID",
    );
  });

  it("authenticates reporting requests and rejects non-reporting or untrusted URLs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reportId: "report-3" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new AmazonAdsClient({
      workspaceId: "ws_1",
      connectionId: "connection_1",
      correlationId: "correlation-1",
      clientId: "client-1",
      accessToken: "access-1",
      profileId: "1234567890",
      region: "na",
      fetchImpl,
      maxRetries: 0,
    });

    await client.requestReport({ name: "read-only-report" });
    const requestHeaders = fetchImpl.mock.calls[0][1]?.headers as Headers;
    expect(requestHeaders.get("authorization")).toBe("Bearer access-1");
    expect(requestHeaders.get("amazon-advertising-api-clientId")).toBe("client-1");
    expect(requestHeaders.get("amazon-advertising-api-scope")).toBe("1234567890");
    await expect(client.get("/sp/campaigns")).rejects.toThrow("READ_ONLY_VIOLATION");
    await expect(client.downloadReport("https://attacker.example/report.gz")).rejects.toThrow(
      "READ_ONLY_VIOLATION",
    );
  });
});

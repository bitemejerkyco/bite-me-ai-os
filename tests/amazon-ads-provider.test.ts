import { describe, expect, it, vi } from "vitest";
import { AmazonAdsCanonicalNormalizer } from "@/features/marketing/providers/amazon-ads/normalization/normalizers";
import { AmazonAdsMarketingProvider } from "@/features/marketing/providers/amazon-ads/services/provider";
import { AmazonAdsReadService } from "@/features/marketing/providers/amazon-ads/services/read-service";
import { AmazonAdsSandboxSyncService } from "@/features/marketing/providers/amazon-ads/services/sync-service";
import { AmazonAdsSandboxTransport } from "@/features/marketing/providers/amazon-ads/transport/sandbox-transport";
import { amazonAdsSandboxQuerySchema } from "@/features/marketing/providers/amazon-ads/validators/schemas";
import { InMemoryMarketingRepository } from "@/features/marketing/repositories/memory-repository";
import { InMemoryConnectorRepository } from "@/features/platform/connectors/repositories/repository";
import { createMarketingProviderRegistry } from "@/features/marketing/providers/registry";

const context = {
  workspaceId: "ws_1", workspaceSlug: "bite-me", timezone: "America/Los_Angeles", currency: "USD",
  correlationId: "corr_amazon_123", requestedAt: "2026-07-23T12:00:00.000Z", sourceMode: "SANDBOX" as const,
  providerId: "amazon-ads", connectorId: "connector_1", platform: "AMAZON_ADS",
  channel: "MARKETPLACE" as const, ruleVersion: "amazon-ads-sponsored-products-sandbox-v1",
};

function client() {
  return {
    get: vi.fn(async (path: string) => ({
      ok: true, status: 200,
      data: path.includes("campaigns")
        ? { campaigns: [{ campaignId: "c1", name: "Jerky SP", state: "ENABLED", dailyBudget: 50, currency: "USD" }], nextToken: "next-page" }
        : { rows: [] },
      headers: new Headers({ "x-amzn-requestid": "amazon-request", "x-amzn-ratelimit-limit": "2" }),
      correlationId: context.correlationId,
    })),
    requestReport: vi.fn(async () => ({
      ok: true, status: 202, data: { reportId: "report-1" }, headers: new Headers(), correlationId: context.correlationId,
    })),
    pollReport: vi.fn(),
    downloadReport: vi.fn(),
  };
}

describe("Amazon Ads Sponsored Products sandbox provider", () => {
  it("normalizes PPC performance, conversions, currency, timezone, attribution, and evidence", () => {
    const normalizer = new AmazonAdsCanonicalNormalizer();
    const row = {
      campaignId: "c1", adGroupId: "g1", keywordId: "k1", searchTerm: "beef jerky",
      date: "2026-07-22", impressions: 1000, clicks: 50, cost: 25,
      purchases14d: 10, sales14d: 100, currency: "USD", attributionWindow: "14d",
    };
    const performance = normalizer.performance(row, context);
    const conversion = normalizer.conversion(row, context);
    const evidence = normalizer.evidence({ ...row, reportId: "report-1", profileId: "123" }, context);
    expect((performance.data as Record<string, unknown>).metrics).toMatchObject({
      impressions: 1000, clicks: 50, spend: 25, cpc: 0.5, ctr: 5,
      orders: 10, sales: 100, conversion_rate: 20, acos: 25, roas: 4,
    });
    for (const entity of [performance, conversion, evidence]) {
      expect(entity.workspaceId).toBe("ws_1");
      expect(entity.providerId).toBe("amazon-ads");
      expect(entity.currency).toBe("USD");
      expect(entity.timezone).toBe("America/Los_Angeles");
      expect(entity.evidenceId).toBeTruthy();
    }
  });

  it("exposes only a sandbox read contract and refuses live normalization", async () => {
    const provider = new AmazonAdsMarketingProvider();
    expect(provider.certification.paginationModel).toBe("TOKEN");
    expect(provider.certification.checkpointSupport).toBe(true);
    expect(provider.certification.requiredEndpoints.join(" ")).not.toMatch(/bid change|budget change|campaign creation/i);
    expect(() => provider.normalizeCampaign({ records: [{ campaignId: "c1" }], context: { ...context, sourceMode: "LIVE" } })).toThrow("SANDBOX_ONLY");
    expect(() => createMarketingProviderRegistry().activate("amazon-ads", provider)).toThrow("SANDBOX_ONLY");
  });

  it("uses bounded list pagination and captures rate-limit evidence", async () => {
    const fake = client();
    const page = await new AmazonAdsSandboxTransport(fake as never).list("campaigns", { nextToken: "token-1", maxResults: 100 });
    expect(fake.get).toHaveBeenCalledWith("/v2/sp/campaigns?count=100&nextToken=token-1");
    expect(page.nextToken).toBe("next-page");
    expect(page.requestId).toBe("amazon-request");
    expect(page.rateLimit).toBe(2);
  });

  it("creates reporting jobs only for allow-listed read report types", async () => {
    const fake = client();
    const transport = new AmazonAdsSandboxTransport(fake as never);
    const response = await transport.createPerformanceReport({
      reportType: "spSearchTerm", startDate: "2026-07-01", endDate: "2026-07-22", attributionWindow: "14d",
    });
    expect(response.ok).toBe(true);
    expect((fake.requestReport as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      configuration: { adProduct: "SPONSORED_PRODUCTS", reportTypeId: "spSearchTerm" },
    });
    await expect(transport.createPerformanceReport({
      reportType: "budgetUpdate" as never, startDate: "2026-07-01", endDate: "2026-07-22", attributionWindow: "14d",
    })).rejects.toThrow("READ_ONLY_VIOLATION");
  });

  it("persists entity and report checkpoints in workspace scope", async () => {
    const fake = client();
    const transport = new AmazonAdsSandboxTransport(fake as never);
    const marketing = new InMemoryMarketingRepository();
    const connectors = new InMemoryConnectorRepository();
    const reads = new AmazonAdsReadService(transport, marketing);
    const sync = new AmazonAdsSandboxSyncService(reads, transport, connectors);
    const common = { connectorId: "connector_1", profileId: "1234567890", marketplaceId: "ATVPDKIKX0DER", mode: "INCREMENTAL" as const, context };
    const entities = await sync.syncEntities(common);
    expect(entities.counts.campaigns).toBe(1);
    expect(entities.run.status).toBe("PARTIAL_SUCCESS");
    expect((await connectors.getLatestCheckpoint("ws_1", "connector_1"))?.providerId).toBe("amazon-ads");
    expect(await connectors.getLatestCheckpoint("ws_2", "connector_1")).toBeNull();

    const report = await sync.requestPerformanceReport({
      ...common, reportType: "spSearchTerm", startDate: "2026-07-01", endDate: "2026-07-22", attributionWindow: "14d",
    });
    expect(report.reportId).toBe("report-1");
    const ingested = await sync.ingestPerformanceRows({
      ...common, reportId: report.reportId, reportType: "spSearchTerm", completedThrough: "2026-07-22",
      attributionWindow: "14d", rows: [{ campaignId: "c1", date: "2026-07-22", impressions: 10, clicks: 2, cost: 1, purchases14d: 1, sales14d: 5 }],
    });
    expect(ingested.recordsProcessed).toBe(1);
    expect(await marketing.list({ workspaceId: "ws_1", providerId: "amazon-ads", entityType: "PERFORMANCE" })).toHaveLength(1);
  });

  it("validates profile, marketplace, dates, pagination, currency, timezone, and hostile filters", () => {
    const valid = {
      workspaceSlug: "bite-me", connectorId: "connector_1", profileId: "1234567890",
      marketplaceId: "ATVPDKIKX0DER", region: "na", currency: "USD", timezone: "America/Los_Angeles",
    };
    expect(amazonAdsSandboxQuerySchema.parse(valid).maxResults).toBe(100);
    expect(() => amazonAdsSandboxQuerySchema.parse({ ...valid, startDate: "2026-08-01", endDate: "2026-07-01" })).toThrow();
    expect(() => amazonAdsSandboxQuerySchema.parse({ ...valid, maxResults: 1001 })).toThrow();
    expect(() => amazonAdsSandboxQuerySchema.parse({ ...valid, nextToken: "<script>" })).toThrow();
    expect(() => amazonAdsSandboxQuerySchema.parse({ ...valid, currency: "usd" })).toThrow();
  });
});

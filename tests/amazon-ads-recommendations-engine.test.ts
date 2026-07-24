import { describe, expect, it } from "vitest";
import {
  filterAmazonAdsRecommendations,
  generateAmazonAdsRecommendations,
} from "@/features/marketing/providers/amazon-ads/recommendations/engine";
import type { AmazonAdsInsightRecord } from "@/features/marketing/providers/amazon-ads/insights/types";
import * as recommendationEngineModule from "@/features/marketing/providers/amazon-ads/recommendations/engine";

function row(overrides: Partial<AmazonAdsInsightRecord>): AmazonAdsInsightRecord {
  return {
    workspaceId: "workspace-sandbox-01",
    providerId: "amazon-ads-sandbox",
    campaignId: "c-default",
    campaignName: "Default Campaign",
    campaignType: "SPONSORED_PRODUCTS",
    campaignStatus: "ENABLED",
    budget: 50,
    keywordId: "kw-default",
    keyword: "dog treats",
    matchType: "EXACT",
    searchTerm: "dog treats",
    marketplaceId: "US",
    profileId: "profile-us-001",
    date: "2026-06-01",
    impressions: 1000,
    clicks: 30,
    spend: 20,
    sales: 100,
    orders: 4,
    ...overrides,
  };
}

describe("Amazon Ads recommendation engine", () => {
  it("generates all required recommendation types with explainable read-only payloads", () => {
    const records: AmazonAdsInsightRecord[] = [
      row({
        campaignId: "c-strong",
        campaignName: "Strong Scale Campaign",
        budget: 100,
        keywordId: "kw-scale",
        keyword: "premium dog jerky",
        searchTerm: "premium dog jerky",
        clicks: 45,
        spend: 50,
        sales: 300,
        orders: 12,
      }),
      row({
        campaignId: "c-strong",
        campaignName: "Strong Scale Campaign",
        budget: 100,
        keywordId: "kw-low-impr",
        keyword: "niche freeze dried rabbit",
        searchTerm: "niche freeze dried rabbit",
        impressions: 180,
        clicks: 2,
        spend: 3,
        sales: 0,
        orders: 0,
      }),
      row({
        campaignId: "c-weak",
        campaignName: "Weak Campaign",
        budget: 60,
        keywordId: "kw-high-acos",
        keyword: "cheap dog snacks",
        searchTerm: "free dog treats",
        clicks: 34,
        spend: 40,
        sales: 20,
        orders: 0,
      }),
      row({
        campaignId: "c-wasted",
        campaignName: "Wasted Campaign",
        budget: 55,
        keywordId: "kw-wasted",
        keyword: "generic snacks",
        searchTerm: "free samples",
        clicks: 40,
        spend: 52,
        sales: 0,
        orders: 0,
      }),
      row({
        campaignId: "c-decline",
        campaignName: "Declining Campaign",
        budget: 45,
        keywordId: "kw-decline",
        keyword: "protein jerky",
        searchTerm: "protein jerky",
        date: "2026-06-01",
        clicks: 30,
        spend: 20,
        sales: 120,
        orders: 6,
      }),
      row({
        campaignId: "c-decline",
        campaignName: "Declining Campaign",
        budget: 45,
        keywordId: "kw-decline",
        keyword: "protein jerky",
        searchTerm: "protein jerky",
        date: "2026-06-02",
        clicks: 28,
        spend: 20,
        sales: 100,
        orders: 5,
      }),
      row({
        campaignId: "c-decline",
        campaignName: "Declining Campaign",
        budget: 45,
        keywordId: "kw-decline",
        keyword: "protein jerky",
        searchTerm: "protein jerky",
        date: "2026-06-03",
        clicks: 29,
        spend: 20,
        sales: 25,
        orders: 1,
      }),
      row({
        campaignId: "c-decline",
        campaignName: "Declining Campaign",
        budget: 45,
        keywordId: "kw-decline",
        keyword: "protein jerky",
        searchTerm: "protein jerky",
        date: "2026-06-04",
        clicks: 31,
        spend: 20,
        sales: 18,
        orders: 1,
      }),
    ];

    const result = generateAmazonAdsRecommendations(records, "2026-06-05T00:00:00.000Z");
    const types = new Set(result.recommendations.map((item) => item.type));

    expect(types).toEqual(
      new Set([
        "high_spend_zero_orders_search_term",
        "negative_keyword_candidate",
        "profitable_search_term_keyword_candidate",
        "high_acos_keyword",
        "low_impressions_keyword",
        "budget_limited_campaign",
        "campaign_wasted_spend",
        "budget_reallocation",
        "bid_increase_candidate",
        "bid_decrease_candidate",
        "campaign_declining_roas",
        "strong_campaign_scale_candidate",
      ]),
    );

    for (const recommendation of result.recommendations) {
      expect(recommendation.status).toBe("Read Only — No changes applied");
      expect(recommendation.explanation.length).toBeGreaterThan(10);
      expect(recommendation.calculationEvidence.length).toBeGreaterThan(10);
      expect(recommendation.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidenceScore).toBeLessThanOrEqual(1);
      expect(recommendation.estimatedImpactRange.high).toBeGreaterThanOrEqual(
        recommendation.estimatedImpactRange.low,
      );
    }
  });

  it("handles threshold boundary conditions deterministically", () => {
    const records: AmazonAdsInsightRecord[] = [
      row({
        campaignId: "c-boundary",
        campaignName: "Boundary Campaign",
        keywordId: "kw-boundary",
        searchTerm: "boundary term",
        clicks: 20,
        spend: 25,
        orders: 0,
        sales: 0,
      }),
    ];

    const result = generateAmazonAdsRecommendations(records, "2026-06-05T00:00:00.000Z");
    const types = new Set(result.recommendations.map((item) => item.type));
    expect(types.has("high_spend_zero_orders_search_term")).toBe(true);
    expect(types.has("negative_keyword_candidate")).toBe(true);
  });

  it("handles zero-value and insufficient-data inputs safely", () => {
    const result = generateAmazonAdsRecommendations(
      [
        row({
          campaignId: "c-zero",
          campaignName: "Zero Campaign",
          keywordId: "kw-zero",
          searchTerm: "zero term",
          impressions: 0,
          clicks: 0,
          spend: 0,
          sales: 0,
          orders: 0,
        }),
      ],
      "2026-06-05T00:00:00.000Z",
    );

    expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    expect(result.summary.critical + result.summary.high + result.summary.medium + result.summary.low).toBe(
      result.recommendations.length,
    );
  });

  it("enforces workspace/provider isolation and rejects non-sandbox records", () => {
    expect(() =>
      generateAmazonAdsRecommendations(
        [
          row({ campaignId: "c1", workspaceId: "ws-1" }),
          row({ campaignId: "c2", workspaceId: "ws-2" }),
        ],
        "2026-06-05T00:00:00.000Z",
      ),
    ).toThrow("single workspace and provider scope");

    expect(() =>
      generateAmazonAdsRecommendations(
        [row({ providerId: "amazon-ads-live" })],
        "2026-06-05T00:00:00.000Z",
      ),
    ).toThrow("sandbox data");
  });

  it("supports recommendation filtering by priority/type/campaign/marketplace", () => {
    const result = generateAmazonAdsRecommendations(
      [
        row({
          campaignId: "c-filter",
          campaignName: "Filter Campaign",
          keywordId: "kw-filter",
          searchTerm: "filter term",
          clicks: 30,
          spend: 35,
          sales: 0,
          orders: 0,
          marketplaceId: "CA",
        }),
      ],
      "2026-06-05T00:00:00.000Z",
    );

    const filtered = filterAmazonAdsRecommendations(result.recommendations, {
      priority: "critical",
      type: "high_spend_zero_orders_search_term",
      campaignId: "c-filter",
      marketplaceId: "CA",
    });

    expect(filtered).toHaveLength(1);
  });

  it("exposes read-only recommendation functions with no mutation API", () => {
    expect(typeof recommendationEngineModule.generateAmazonAdsRecommendations).toBe("function");
    expect(typeof recommendationEngineModule.filterAmazonAdsRecommendations).toBe("function");
    expect(Object.keys(recommendationEngineModule)).not.toContain("applyCampaignChanges");
    expect(Object.keys(recommendationEngineModule)).not.toContain("updateBudget");
    expect(Object.keys(recommendationEngineModule)).not.toContain("changeBid");
    expect(Object.keys(recommendationEngineModule)).not.toContain("pauseCampaign");
  });
});

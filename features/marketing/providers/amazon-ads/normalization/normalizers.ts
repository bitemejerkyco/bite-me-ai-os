import { createHash } from "node:crypto";
import type { AnyMarketingEntity, MarketingEntityType, MarketingStatus } from "@/features/marketing/domain/models";
import { MarketingNormalizer } from "@/features/marketing/normalization/normalizers";
import type { MarketingNormalizationContext } from "@/features/marketing/types/contexts";

const text = (value: unknown) => typeof value === "string" ? value : value == null ? null : String(value);
const number = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const status = (value: unknown): MarketingStatus => {
  const normalized = text(value)?.toUpperCase();
  if (normalized === "ENABLED" || normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "PAUSED") return "PAUSED";
  if (normalized === "ARCHIVED") return "ARCHIVED";
  return "UNKNOWN";
};

export class AmazonAdsCanonicalNormalizer {
  constructor(private readonly canonical = new MarketingNormalizer()) {}

  private entity(type: MarketingEntityType, externalId: string, data: Record<string, unknown>, context: MarketingNormalizationContext, options: {
    campaignId?: string | null; currency?: string | null; status?: MarketingStatus; occurredAt?: string;
  } = {}): AnyMarketingEntity {
    const evidenceId = createHash("sha256")
      .update(`${context.workspaceId}:${context.connectorId}:${type}:${externalId}:${context.requestedAt}`)
      .digest("hex");
    return this.canonical.normalize(type, {
      externalId, campaignId: options.campaignId, currency: options.currency,
      status: options.status, evidenceId, occurredAt: options.occurredAt || context.requestedAt,
      quality: "COMPLETE", data,
      providerMetadata: { providerVersion: "amazon-ads-sponsored-products-sandbox-v1" },
    }, context) as AnyMarketingEntity;
  }

  campaign(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const id = text(row.campaignId) || text(row.id) || "unknown";
    return this.entity("CAMPAIGN", id, {
      name: text(row.name) || "Unnamed Sponsored Products campaign",
      objective: "SALES",
      startsAt: text(row.startDate),
      endsAt: text(row.endDate),
      campaignType: "SPONSORED_PRODUCTS",
      targetingType: text(row.targetingType),
      budgetType: text(row.budgetType) || "DAILY",
      budget: number(row.dailyBudget ?? row.budget),
      marketplaceId: text(row.marketplaceId),
    }, context, { status: status(row.state ?? row.status), currency: text(row.currency) });
  }

  adGroup(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const id = text(row.adGroupId) || text(row.id) || "unknown";
    return this.entity("CAMPAIGN_GROUP", id, {
      name: text(row.name), defaultBid: number(row.defaultBid),
    }, context, { campaignId: text(row.campaignId), status: status(row.state ?? row.status) });
  }

  ad(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const id = text(row.adId) || text(row.advertisedProductId) || text(row.id) || "unknown";
    return this.entity("CREATIVE", id, {
      asin: text(row.asin), sku: text(row.sku), adGroupId: text(row.adGroupId),
      adType: "SPONSORED_PRODUCT",
    }, context, { campaignId: text(row.campaignId), status: status(row.state ?? row.status) });
  }

  targeting(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const id = text(row.keywordId) || text(row.targetId) || text(row.targetingId) || text(row.id) || "unknown";
    return this.entity("AUDIENCE", id, {
      adGroupId: text(row.adGroupId), keywordText: text(row.keywordText ?? row.keyword),
      matchType: text(row.matchType), expression: row.expression ?? null,
      targetingType: row.keywordId || row.keywordText ? "KEYWORD" : "PRODUCT_OR_AUTO",
      bid: number(row.bid),
    }, context, { campaignId: text(row.campaignId), status: status(row.state ?? row.status) });
  }

  performance(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const campaignId = text(row.campaignId);
    const date = text(row.date) || context.requestedAt.slice(0, 10);
    const discriminator = text(row.searchTerm) || text(row.keywordId) || text(row.targetingId) || "campaign";
    const clicks = number(row.clicks);
    const impressions = number(row.impressions);
    const spend = number(row.cost ?? row.spend);
    const orders = number(row.purchases14d ?? row.orders);
    const sales = number(row.sales14d ?? row.sales);
    return this.entity("PERFORMANCE", `${campaignId || "profile"}:${date}:${discriminator}`, {
      intervalStart: date, intervalEnd: date,
      metrics: {
        impressions, clicks, spend,
        cpc: clicks ? spend / clicks : 0,
        ctr: impressions ? clicks / impressions * 100 : 0,
        orders, sales,
        conversion_rate: clicks ? orders / clicks * 100 : 0,
        acos: sales ? spend / sales * 100 : 0,
        roas: spend ? sales / spend : 0,
      },
      adGroupId: text(row.adGroupId), keywordId: text(row.keywordId),
      targetingId: text(row.targetingId), searchTerm: text(row.searchTerm),
      attributionWindow: text(row.attributionWindow) || "14d",
      marketplaceId: text(row.marketplaceId),
    }, context, { campaignId, currency: text(row.currency), occurredAt: `${date}T00:00:00.000Z` });
  }

  conversion(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const campaignId = text(row.campaignId);
    const date = text(row.date) || context.requestedAt.slice(0, 10);
    return this.entity("CONVERSION", `${campaignId || "profile"}:${date}:${text(row.searchTerm) || "all"}`, {
      orders: number(row.purchases14d ?? row.orders),
      sales: number(row.sales14d ?? row.sales),
      conversionRate: number(row.conversionRate),
      attributionWindow: text(row.attributionWindow) || "14d",
    }, context, { campaignId, currency: text(row.currency), occurredAt: `${date}T00:00:00.000Z` });
  }

  evidence(row: Record<string, unknown>, context: MarketingNormalizationContext) {
    const id = text(row.campaignId) || text(row.reportId) || text(row.id) || "unknown";
    return this.entity("EVIDENCE", id, {
      source: "Amazon Ads API sandbox", profileId: text(row.profileId),
      marketplaceId: text(row.marketplaceId), reportId: text(row.reportId),
      attributionWindow: text(row.attributionWindow), synchronizedAt: context.requestedAt,
    }, context);
  }
}


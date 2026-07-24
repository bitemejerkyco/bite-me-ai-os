import type { MarketingRepository } from "@/features/marketing/repositories/repository";
import type { MarketingNormalizationContext } from "@/features/marketing/types/contexts";
import { AmazonAdsCanonicalNormalizer } from "@/features/marketing/providers/amazon-ads/normalization/normalizers";
import { AmazonAdsSandboxTransport } from "@/features/marketing/providers/amazon-ads/transport/sandbox-transport";

export class AmazonAdsReadService {
  constructor(
    private readonly transport: AmazonAdsSandboxTransport,
    private readonly repository: MarketingRepository,
    private readonly normalizer = new AmazonAdsCanonicalNormalizer(),
  ) {}

  campaigns(input: ReadInput) { return this.list("campaigns", "campaign", input); }
  adGroups(input: ReadInput) { return this.list("adGroups", "adGroup", input); }
  ads(input: ReadInput) { return this.list("ads", "ad", input); }
  keywords(input: ReadInput) { return this.list("keywords", "targeting", input); }
  targeting(input: ReadInput) { return this.list("targets", "targeting", input); }

  async performance(rows: ReadonlyArray<Record<string, unknown>>, context: MarketingNormalizationContext) {
    this.assertSandbox(context);
    for (const row of rows) {
      await this.repository.upsert(this.normalizer.performance(row, context));
      await this.repository.upsert(this.normalizer.conversion(row, context));
      await this.repository.upsert(this.normalizer.evidence(row, context));
    }
    return { recordsProcessed: rows.length };
  }

  private async list(resource: "campaigns" | "adGroups" | "ads" | "keywords" | "targets", normalizer: "campaign" | "adGroup" | "ad" | "targeting", input: ReadInput) {
    this.assertSandbox(input.normalizationContext);
    const page = await this.transport.list(resource, input);
    for (const row of page.results) {
      await this.repository.upsert(this.normalizer[normalizer](row, input.normalizationContext));
      await this.repository.upsert(this.normalizer.evidence(row, input.normalizationContext));
    }
    return page;
  }

  private assertSandbox(context: MarketingNormalizationContext) {
    if (context.sourceMode !== "SANDBOX") throw new Error("SANDBOX_ONLY:Amazon Ads reads require sandbox source mode.");
  }
}

export type ReadInput = {
  nextToken?: string | null;
  maxResults?: number;
  normalizationContext: MarketingNormalizationContext;
};


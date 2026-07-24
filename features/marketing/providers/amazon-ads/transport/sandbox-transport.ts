import type { AmazonAdsClient } from "@/features/platform/connectors/providers/amazon/clients/amazon-ads-client";
import type { AmazonAdsPage, AmazonAdsReportType } from "@/features/marketing/providers/amazon-ads/types/models";

type ClientResponse = Awaited<ReturnType<AmazonAdsClient["get"]>>;
type ReadClient = Pick<AmazonAdsClient, "get" | "requestReport" | "pollReport" | "downloadReport">;

const LIST_PATHS = {
  campaigns: "/v2/sp/campaigns",
  adGroups: "/v2/sp/adGroups",
  ads: "/v2/sp/productAds",
  keywords: "/v2/sp/keywords",
  targets: "/v2/sp/targets",
} as const;

const MUTATION_SHAPES = /(?:create|update|delete|archive|bid|budget|activate|pause|enable|disable|negative)/i;

export class AmazonAdsSandboxTransport {
  constructor(private readonly client: ReadClient) {}

  list(resource: keyof typeof LIST_PATHS, input: { nextToken?: string | null; maxResults?: number } = {}) {
    const query = new URLSearchParams({ count: String(input.maxResults || 100) });
    if (input.nextToken) query.set("nextToken", input.nextToken);
    return this.read(`${LIST_PATHS[resource]}?${query.toString()}`);
  }

  async createPerformanceReport(input: {
    reportType: AmazonAdsReportType;
    startDate: string;
    endDate: string;
    attributionWindow: "1d" | "7d" | "14d" | "30d";
  }) {
    const body = {
      name: `bite-me-sandbox-${input.reportType}-${input.startDate}-${input.endDate}`,
      startDate: input.startDate,
      endDate: input.endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: [input.reportType],
        reportTypeId: input.reportType,
        timeUnit: "DAILY",
        format: "GZIP_JSON",
        columns: [
          "date", "campaignId", "adGroupId", "keywordId", "targetingId", "searchTerm",
          "impressions", "clicks", "cost", "clickThroughRate", "costPerClick",
          "purchases14d", "sales14d", "acosClicks14d", "roasClicks14d",
        ],
        attributionWindow: input.attributionWindow,
      },
    };
    if (MUTATION_SHAPES.test(input.reportType)) throw new Error("READ_ONLY_VIOLATION:Mutation-shaped report type rejected.");
    return this.client.requestReport(body);
  }

  pollReport(reportId: string) {
    this.assertIdentifier(reportId);
    return this.client.pollReport(reportId);
  }

  downloadReport(reportId: string) {
    this.assertIdentifier(reportId);
    return this.client.downloadReport(reportId);
  }

  private async read(path: string): Promise<AmazonAdsPage<Record<string, unknown>>> {
    if (MUTATION_SHAPES.test(path)) throw new Error("READ_ONLY_VIOLATION:Amazon Ads sandbox transport rejected a mutation-shaped path.");
    const response = await this.client.get<Record<string, unknown>>(path) as ClientResponse;
    if (!response.ok) throw new Error(`${response.safeError?.code || "PROVIDER_ERROR"}:${response.safeError?.message || "Amazon Ads read failed."}`);
    const body = response.data && typeof response.data === "object" ? response.data as Record<string, unknown> : {};
    const results = this.extractRows(body);
    return {
      results,
      nextToken: typeof body.nextToken === "string" ? body.nextToken : null,
      requestId: response.headers.get("x-amzn-requestid") || response.headers.get("x-amz-request-id"),
      rateLimit: this.headerNumber(response.headers, "x-amzn-ratelimit-limit"),
      rateLimitRemaining: this.headerNumber(response.headers, "x-amzn-ratelimit-remaining"),
    };
  }

  private extractRows(body: Record<string, unknown>) {
    for (const value of Object.values(body)) {
      if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
    }
    return [];
  }

  private headerNumber(headers: Headers, name: string) {
    const value = headers.get(name);
    return value && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  private assertIdentifier(value: string) {
    if (!/^[A-Za-z0-9._:-]{1,200}$/.test(value)) throw new Error("INVALID_REPORT_ID:Amazon Ads report identifier is invalid.");
  }
}


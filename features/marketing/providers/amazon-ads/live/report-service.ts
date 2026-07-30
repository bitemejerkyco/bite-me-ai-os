import { gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { AmazonAdsClient } from "@/features/platform/connectors/providers/amazon/clients/amazon-ads-client";
import {
  AmazonAdsLiveConnectionService,
  type AmazonAdsLiveReadAccess,
} from "@/features/marketing/providers/amazon-ads/live/connection-service";
import type { AmazonAdsIntegrationActor } from "@/features/marketing/providers/amazon-ads/live/types";
import type { AmazonAdsInsightRecord } from "@/features/marketing/providers/amazon-ads/insights/types";

type ReportClient = Pick<AmazonAdsClient, "requestReport" | "pollReport" | "downloadReport">;

type Dependencies = {
  connectionService?: Pick<AmazonAdsLiveConnectionService, "getLiveReadAccess">;
  clientFactory?: (access: AmazonAdsLiveReadAccess, correlationId: string) => ReportClient;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

type AmazonReportStatus = {
  reportId?: string;
  status?: string;
  url?: string;
  failureReason?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 31;

const REPORT_COLUMNS = [
  "date",
  "campaignId",
  "campaignName",
  "campaignStatus",
  "campaignBudgetAmount",
  "campaignBudgetCurrencyCode",
  "keywordId",
  "keyword",
  "matchType",
  "searchTerm",
  "impressions",
  "clicks",
  "cost",
  "purchases7d",
  "sales7d",
];

function assertDateRange(startDate: string, endDate: string): void {
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    throw new Error("REPORT_RANGE_INVALID:Dates must use YYYY-MM-DD.");
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > MAX_RANGE_DAYS) {
    throw new Error("REPORT_RANGE_INVALID:Date range must contain 1 to 31 days.");
  }
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseReportBytes(bytes: ArrayBuffer): Record<string, unknown>[] {
  const input = Buffer.from(bytes);
  const decoded =
    input.length >= 2 && input[0] === 0x1f && input[1] === 0x8b
      ? gunzipSync(input)
      : input;
  const payload = JSON.parse(decoded.toString("utf8")) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("REPORT_PAYLOAD_INVALID:Amazon Ads report did not contain a JSON array.");
  }
  return payload.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
  );
}

function normalizeRows(
  rows: Record<string, unknown>[],
  actor: AmazonAdsIntegrationActor,
  access: AmazonAdsLiveReadAccess,
): AmazonAdsInsightRecord[] {
  return rows.map((row, index) => ({
    workspaceId: actor.workspaceId,
    providerId: "amazon-ads-live",
    campaignId: stringValue(row.campaignId, `unknown-campaign-${index}`),
    campaignName: stringValue(row.campaignName, "Unknown campaign"),
    campaignType: "SPONSORED_PRODUCTS",
    campaignStatus: stringValue(row.campaignStatus, "UNKNOWN").toUpperCase(),
    budget: numberValue(row.campaignBudgetAmount),
    keywordId: stringValue(row.keywordId, `unknown-keyword-${index}`),
    keyword: stringValue(row.keyword ?? row.keywordText, "Unknown keyword"),
    matchType: stringValue(row.matchType, "UNKNOWN").toUpperCase(),
    searchTerm: stringValue(row.searchTerm, "Unknown search term"),
    marketplaceId: access.marketplaceId,
    profileId: access.profileId,
    date: stringValue(row.date),
    impressions: numberValue(row.impressions),
    clicks: numberValue(row.clicks),
    spend: numberValue(row.cost ?? row.spend),
    sales: numberValue(row.sales7d ?? row.sales14d ?? row.sales),
    orders: numberValue(row.purchases7d ?? row.purchases14d ?? row.orders),
  }));
}

export class AmazonAdsLiveReportService {
  private readonly connectionService: Pick<AmazonAdsLiveConnectionService, "getLiveReadAccess">;
  private readonly clientFactory: NonNullable<Dependencies["clientFactory"]>;
  private readonly sleep: NonNullable<Dependencies["sleep"]>;
  private readonly now: () => Date;
  private readonly maxPollAttempts: number;
  private readonly pollIntervalMs: number;

  constructor(dependencies: Dependencies = {}) {
    this.connectionService =
      dependencies.connectionService ?? new AmazonAdsLiveConnectionService();
    this.clientFactory =
      dependencies.clientFactory ??
      ((access, correlationId) =>
        new AmazonAdsClient({
          workspaceId: access.workspaceId,
          connectionId: access.connectionId,
          correlationId,
          clientId: access.clientId,
          accessToken: access.accessToken,
          profileId: access.profileId,
          region: access.region,
        }));
    this.sleep =
      dependencies.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = dependencies.now ?? (() => new Date());
    this.maxPollAttempts = dependencies.maxPollAttempts ?? 12;
    this.pollIntervalMs = dependencies.pollIntervalMs ?? 2_500;
  }

  async loadSearchTermPerformance(input: {
    actor: AmazonAdsIntegrationActor;
    startDate: string;
    endDate: string;
    correlationId?: string;
  }): Promise<{ records: AmazonAdsInsightRecord[]; generatedAt: string; reportId: string }> {
    assertDateRange(input.startDate, input.endDate);
    const access = await this.connectionService.getLiveReadAccess(input.actor);
    const correlationId = input.correlationId ?? randomUUID();
    const client = this.clientFactory(access, correlationId);
    const created = await client.requestReport({
      name: `postmotive-sp-search-terms-${input.startDate}-${input.endDate}`,
      startDate: input.startDate,
      endDate: input.endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["searchTerm"],
        columns: REPORT_COLUMNS,
        reportTypeId: "spSearchTerm",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
      },
    });
    const reportId = stringValue(created.data?.reportId);
    if (!created.ok || !reportId) {
      throw new Error(created.safeError?.message || "REPORT_CREATE_FAILED:Amazon Ads did not return a report ID.");
    }

    let completed: AmazonReportStatus | null = null;
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      if (attempt > 0) await this.sleep(this.pollIntervalMs);
      const statusResponse = await client.pollReport(reportId);
      if (!statusResponse.ok) {
        throw new Error(statusResponse.safeError?.message || "REPORT_STATUS_FAILED:Unable to read report status.");
      }
      const status = statusResponse.data as AmazonReportStatus | undefined;
      const normalizedStatus = stringValue(status?.status).toUpperCase();
      if (normalizedStatus === "COMPLETED" && status?.url) {
        completed = status;
        break;
      }
      if (normalizedStatus === "FAILURE" || normalizedStatus === "CANCELLED") {
        throw new Error(
          `REPORT_FAILED:${stringValue(status?.failureReason, "Amazon Ads report generation failed.")}`,
        );
      }
    }
    if (!completed?.url) {
      throw new Error("REPORT_PENDING:Amazon Ads report is still processing; retry shortly.");
    }
    const downloaded = await client.downloadReport(completed.url);
    if (!downloaded.ok || !downloaded.data) {
      throw new Error(downloaded.safeError?.message || "REPORT_DOWNLOAD_FAILED:Unable to download report.");
    }
    return {
      records: normalizeRows(parseReportBytes(downloaded.data), input.actor, access),
      generatedAt: this.now().toISOString(),
      reportId,
    };
  }
}

export { assertDateRange, normalizeRows, parseReportBytes };

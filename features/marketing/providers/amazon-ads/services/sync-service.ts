import type { ConnectorRepository } from "@/features/platform/connectors/repositories/repository";
import type { MarketingNormalizationContext } from "@/features/marketing/types/contexts";
import { AmazonAdsReadService } from "@/features/marketing/providers/amazon-ads/services/read-service";
import { AmazonAdsSandboxTransport } from "@/features/marketing/providers/amazon-ads/transport/sandbox-transport";
import type { AmazonAdsReportType } from "@/features/marketing/providers/amazon-ads/types/models";

export class AmazonAdsSandboxSyncService {
  constructor(
    private readonly reads: AmazonAdsReadService,
    private readonly transport: AmazonAdsSandboxTransport,
    private readonly checkpoints: ConnectorRepository,
  ) {}

  async syncEntities(input: SyncInput) {
    this.assertSandbox(input.context);
    const checkpointKey = this.checkpointKey(input.profileId, input.marketplaceId, "entities");
    const previous = await this.checkpoints.getLatestCheckpoint(input.context.workspaceId, input.connectorId, checkpointKey);
    const resume = previous?.payload || {};
    let run = await this.startRun(input, { resumedFromCheckpointId: previous?.id || null });
    try {
      const campaigns = await this.reads.campaigns({ normalizationContext: input.context, nextToken: this.token(resume.campaigns), maxResults: input.maxResults });
      const adGroups = await this.reads.adGroups({ normalizationContext: input.context, nextToken: this.token(resume.adGroups), maxResults: input.maxResults });
      const ads = await this.reads.ads({ normalizationContext: input.context, nextToken: this.token(resume.ads), maxResults: input.maxResults });
      const keywords = await this.reads.keywords({ normalizationContext: input.context, nextToken: this.token(resume.keywords), maxResults: input.maxResults });
      const targets = await this.reads.targeting({ normalizationContext: input.context, nextToken: this.token(resume.targets), maxResults: input.maxResults });
      const tokens = {
        campaigns: campaigns.nextToken, adGroups: adGroups.nextToken, ads: ads.nextToken,
        keywords: keywords.nextToken, targets: targets.nextToken,
      };
      const checkpoint = await this.checkpoints.saveCheckpoint({
        workspaceId: input.context.workspaceId, providerId: "amazon-ads", connectionId: input.connectorId,
        syncRunId: run.id, checkpointKey, payload: {
          ...tokens, profileId: input.profileId, marketplaceId: input.marketplaceId,
          completedAt: input.context.requestedAt,
        },
      });
      const partial = Object.values(tokens).some(Boolean);
      run = await this.checkpoints.saveSyncRun({
        ...run, status: partial ? "PARTIAL_SUCCESS" : "COMPLETED",
        completedAt: input.context.requestedAt, checkpointId: checkpoint.id,
      });
      return {
        run, checkpoint,
        counts: {
          campaigns: campaigns.results.length, adGroups: adGroups.results.length,
          ads: ads.results.length, keywords: keywords.results.length, targets: targets.results.length,
        },
      };
    } catch (error) {
      await this.failRun(run, input.context.requestedAt, error);
      throw error;
    }
  }

  async requestPerformanceReport(input: SyncInput & {
    reportType: AmazonAdsReportType;
    startDate: string;
    endDate: string;
    attributionWindow: "1d" | "7d" | "14d" | "30d";
  }) {
    this.assertSandbox(input.context);
    let run = await this.startRun(input, {
      reportType: input.reportType, startDate: input.startDate, endDate: input.endDate,
      attributionWindow: input.attributionWindow,
    });
    try {
      const response = await this.transport.createPerformanceReport(input);
      if (!response.ok || !response.data) throw new Error(`${response.safeError?.code || "PROVIDER_ERROR"}:${response.safeError?.message || "Amazon Ads report request failed."}`);
      const data = response.data as Record<string, unknown>;
      const reportId = typeof data.reportId === "string" ? data.reportId : typeof data.id === "string" ? data.id : null;
      if (!reportId) throw new Error("INVALID_PROVIDER_RESPONSE:Amazon Ads report identifier is missing.");
      const checkpoint = await this.checkpoints.saveCheckpoint({
        workspaceId: input.context.workspaceId, providerId: "amazon-ads", connectionId: input.connectorId,
        syncRunId: run.id, checkpointKey: this.checkpointKey(input.profileId, input.marketplaceId, `report:${input.reportType}`),
        payload: {
          reportId, reportType: input.reportType, startDate: input.startDate, endDate: input.endDate,
          attributionWindow: input.attributionWindow, status: "PENDING",
        },
      });
      run = await this.checkpoints.saveSyncRun({
        ...run, status: "PARTIAL_SUCCESS", completedAt: input.context.requestedAt, checkpointId: checkpoint.id,
      });
      return { run, checkpoint, reportId };
    } catch (error) {
      await this.failRun(run, input.context.requestedAt, error);
      throw error;
    }
  }

  async ingestPerformanceRows(input: SyncInput & {
    reportId: string;
    reportType: AmazonAdsReportType;
    rows: ReadonlyArray<Record<string, unknown>>;
    completedThrough: string;
    attributionWindow: "1d" | "7d" | "14d" | "30d";
  }) {
    this.assertSandbox(input.context);
    const enriched = input.rows.map((row) => ({
      ...row, reportId: input.reportId, profileId: input.profileId,
      marketplaceId: input.marketplaceId, attributionWindow: input.attributionWindow,
      currency: input.context.currency,
    }));
    const result = await this.reads.performance(enriched, input.context);
    const run = await this.startRun(input, { reportId: input.reportId, reportType: input.reportType });
    const checkpoint = await this.checkpoints.saveCheckpoint({
      workspaceId: input.context.workspaceId, providerId: "amazon-ads", connectionId: input.connectorId,
      syncRunId: run.id, checkpointKey: this.checkpointKey(input.profileId, input.marketplaceId, `report:${input.reportType}`),
      payload: {
        reportId: input.reportId, reportType: input.reportType, completedThrough: input.completedThrough,
        attributionWindow: input.attributionWindow, status: "COMPLETED", rowsProcessed: result.recordsProcessed,
      },
    });
    const completedRun = await this.checkpoints.saveSyncRun({
      ...run, status: "COMPLETED", completedAt: input.context.requestedAt, checkpointId: checkpoint.id,
    });
    return { run: completedRun, checkpoint, ...result };
  }

  private startRun(input: SyncInput, metadata: Record<string, unknown>) {
    return this.checkpoints.saveSyncRun({
      workspaceId: input.context.workspaceId, providerId: "amazon-ads", connectionId: input.connectorId,
      triggerType: "MANUAL", mode: input.mode === "HISTORICAL" ? "FULL_IMPORT" : "INCREMENTAL",
      status: "RUNNING", startedAt: input.context.requestedAt, completedAt: null,
      errorCode: null, errorMessage: null, checkpointId: null, retriedFromSyncRunId: null,
      correlationId: input.context.correlationId,
      metadata: { sandboxOnly: true, profileId: input.profileId, marketplaceId: input.marketplaceId, ...metadata },
    });
  }

  private failRun(run: Awaited<ReturnType<AmazonAdsSandboxSyncService["startRun"]>>, completedAt: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown Amazon Ads sandbox sync failure.";
    return this.checkpoints.saveSyncRun({
      ...run, status: "FAILED", completedAt, errorCode: message.split(":")[0], errorMessage: message,
    });
  }

  private checkpointKey(profileId: string, marketplaceId: string, scope: string) {
    return `amazon-ads:${profileId}:${marketplaceId}:${scope}`;
  }
  private token(value: unknown) { return typeof value === "string" ? value : null; }
  private assertSandbox(context: MarketingNormalizationContext) {
    if (context.sourceMode !== "SANDBOX") throw new Error("SANDBOX_ONLY:Amazon Ads sync is not certified for live mode.");
  }
}

export type SyncInput = {
  connectorId: string;
  profileId: string;
  marketplaceId: string;
  mode: "INITIAL" | "HISTORICAL" | "INCREMENTAL";
  maxResults?: number;
  context: MarketingNormalizationContext;
};


import { AmazonAdsClient } from "@/features/platform/connectors/providers/amazon/clients/amazon-ads-client";
import { inferRegionFromMarketplaces } from "@/features/platform/connectors/providers/amazon/normalization/marketplaces";
import { connectorRepository, telemetry } from "@/features/platform/connectors/runtime/runtime";
import { getMarketingRuntime } from "@/features/marketing/runtime";
import type { MarketingNormalizationContext } from "@/features/marketing/types/contexts";
import { AmazonAdsReadService } from "@/features/marketing/providers/amazon-ads/services/read-service";
import { AmazonAdsSandboxSyncService } from "@/features/marketing/providers/amazon-ads/services/sync-service";
import { AmazonAdsSandboxTransport } from "@/features/marketing/providers/amazon-ads/transport/sandbox-transport";

export async function buildAmazonAdsSandboxRuntime(input: {
  connectorId: string;
  profileId: string;
  marketplaceId: string;
  context: MarketingNormalizationContext;
}) {
  if (input.context.sourceMode !== "SANDBOX") {
    throw new Error("SANDBOX_ONLY:Amazon Ads runtime is not certified for live mode.");
  }
  const connection = await connectorRepository.getConnectionById(input.context.workspaceId, input.connectorId);
  if (!connection || !["amazon", "amazon-ads"].includes(connection.providerId)) {
    throw new Error("RESOURCE_NOT_FOUND:Amazon connector not found in this workspace.");
  }
  if (connection.status !== "CONNECTED") {
    throw new Error("PROVIDER_UNAVAILABLE:Amazon connector is not connected.");
  }
  if (!connection.credentialReferenceId) {
    throw new Error("PROVIDER_NOT_CONFIGURED:Amazon credential reference is missing.");
  }

  const client = new AmazonAdsClient({
    workspaceId: input.context.workspaceId,
    connectionId: input.connectorId,
    correlationId: input.context.correlationId,
    clientId: "sandbox",
    accessToken: "sandbox",
    profileId: input.profileId,
    region: inferRegionFromMarketplaces([input.marketplaceId]),
    telemetry,
  });
  const transport = new AmazonAdsSandboxTransport(client);
  const reads = new AmazonAdsReadService(transport, getMarketingRuntime().repository);
  const sync = new AmazonAdsSandboxSyncService(reads, transport, connectorRepository);
  return { transport, reads, sync };
}

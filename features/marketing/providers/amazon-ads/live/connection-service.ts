import { randomUUID } from "node:crypto";
import { connectorRepository, type ConnectorTelemetry } from "@/features/platform/connectors/runtime/runtime";
import type { ConnectorConnectionRecord, ConnectorCredentialReferenceRecord } from "@/features/platform/connectors/domain/models";
import {
  getAmazonAdsLiveFeatureEnabled,
  getMissingAmazonAdsConfigKeys,
  loadAmazonAdsLiveConfig,
} from "@/features/marketing/providers/amazon-ads/live/config";
import { AmazonAdsOAuthClient } from "@/features/marketing/providers/amazon-ads/live/oauth-client";
import {
  decryptRefreshToken,
  encryptRefreshToken,
  redactSecrets,
} from "@/features/marketing/providers/amazon-ads/live/token-crypto";
import {
  getAmazonAdsOAuthStateStore,
} from "@/features/marketing/providers/amazon-ads/live/state-store";
import {
  getAmazonAdsTokenStore,
  newTokenRecord,
} from "@/features/marketing/providers/amazon-ads/live/token-store";
import type {
  AmazonAdsAdvertiserProfile,
  AmazonAdsConnectionView,
  AmazonAdsDisconnectResult,
  AmazonAdsIntegrationActor,
  AmazonAdsLiveConfig,
  AmazonAdsStateStore,
  AmazonAdsTokenStore,
} from "@/features/marketing/providers/amazon-ads/live/types";
import { inferRegionFromMarketplaces } from "@/features/platform/connectors/providers/amazon/normalization/marketplaces";

type Dependencies = {
  config?: AmazonAdsLiveConfig;
  oauthClient?: AmazonAdsOAuthClient;
  stateStore?: AmazonAdsStateStore;
  tokenStore?: AmazonAdsTokenStore;
  telemetry?: ConnectorTelemetry;
  now?: () => Date;
};

type OAuthResult = {
  authorizeUrl: string;
  connectionId: string;
};

export type AmazonAdsLiveReadAccess = {
  workspaceId: string;
  connectionId: string;
  clientId: string;
  accessToken: string;
  profileId: string;
  marketplaceId: string;
  region: "na" | "eu" | "fe";
};

const PROVIDER_ID = "amazon-ads-live";
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function toStatus(
  record: ConnectorConnectionRecord | null,
  nowMs: number,
): AmazonAdsConnectionView["status"] {
  if (!record) return "disconnected";
  if (record.status === "CONNECTED") {
    const expiresAt = typeof record.metadata?.expiresAt === "string" ? record.metadata.expiresAt : null;
    if (expiresAt && new Date(expiresAt).getTime() <= nowMs) return "expired";
    return "connected";
  }
  if (record.status === "CONNECTING") return "connecting";
  if (record.status === "EXPIRED") return "expired";
  if (record.status === "ERROR") return "error";
  return "disconnected";
}

function parseProfiles(metadata: Record<string, unknown> | undefined): AmazonAdsAdvertiserProfile[] {
  const value = metadata?.profiles;
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => row as Record<string, unknown>)
    .map((row) => ({
      profileId: typeof row.profileId === "string" ? row.profileId : "",
      marketplaceId: typeof row.marketplaceId === "string" ? row.marketplaceId : "",
      accountName: typeof row.accountName === "string" ? row.accountName : "Unknown",
      accountType: typeof row.accountType === "string" ? row.accountType : "unknown",
      currencyCode: typeof row.currencyCode === "string" ? row.currencyCode : "USD",
    }))
    .filter((row) => row.profileId && row.marketplaceId);
}

function sanitizeProfileRows(rows: Awaited<ReturnType<AmazonAdsOAuthClient["discoverProfiles"]>>): AmazonAdsAdvertiserProfile[] {
  return rows
    .map((row) => {
      const profileId =
        typeof row.profileId === "string" ? row.profileId : row.accountInfo?.id && String(row.accountInfo.id);
      const marketplaceId = (row.countryCode || "").trim().toUpperCase();
      if (!profileId || !marketplaceId) return null;
      return {
        profileId: String(profileId),
        marketplaceId,
        accountName: row.accountInfo?.name?.trim() || "Unnamed advertiser profile",
        accountType: row.accountInfo?.type?.trim() || "seller",
        currencyCode: (row.currencyCode || "USD").toUpperCase(),
      } satisfies AmazonAdsAdvertiserProfile;
    })
    .filter((row): row is AmazonAdsAdvertiserProfile => Boolean(row));
}

async function findLiveConnection(actor: AmazonAdsIntegrationActor): Promise<ConnectorConnectionRecord | null> {
  const rows = await connectorRepository.listConnections(actor.workspaceId);
  return rows.find((row) => row.providerId === PROVIDER_ID) || null;
}

function assertActor(actor: AmazonAdsIntegrationActor): void {
  if (!SAFE_ID.test(actor.workspaceId) || !SAFE_ID.test(actor.userId)) {
    throw new Error("ACTOR_INVALID:workspaceId and userId must be safe identifiers.");
  }
}

export class AmazonAdsLiveConnectionService {
  private readonly config: AmazonAdsLiveConfig;
  private readonly oauthClient: AmazonAdsOAuthClient;
  private readonly stateStore: AmazonAdsStateStore;
  private readonly tokenStore: AmazonAdsTokenStore;
  private readonly now: () => Date;
  private readonly telemetry?: ConnectorTelemetry;

  constructor(deps: Dependencies = {}) {
    this.config = deps.config ?? loadAmazonAdsLiveConfig();
    this.oauthClient =
      deps.oauthClient ??
      new AmazonAdsOAuthClient({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUri: this.config.redirectUri,
      });
    this.stateStore = deps.stateStore ?? getAmazonAdsOAuthStateStore();
    this.tokenStore = deps.tokenStore ?? getAmazonAdsTokenStore();
    this.now = deps.now ?? (() => new Date());
    this.telemetry = deps.telemetry;
  }

  getConnectAvailability(): { enabled: boolean; message: string | null } {
    if (!this.config.liveReadEnabled) {
      return {
        enabled: false,
        message: "Live read-only mode is disabled by AMAZON_ADS_LIVE_READ_ENABLED=false.",
      };
    }

    const missing = getMissingAmazonAdsConfigKeys({
      AMAZON_ADS_CLIENT_ID: this.config.clientId,
      AMAZON_ADS_CLIENT_SECRET: this.config.clientSecret,
      AMAZON_ADS_REDIRECT_URI: this.config.redirectUri,
      AMAZON_ADS_LIVE_READ_ENABLED: "true",
      AMAZON_ADS_TOKEN_ENCRYPTION_KEY: this.config.tokenEncryptionKey,
    });
    if (missing.length > 0) {
      return {
        enabled: false,
        message: `Missing required Amazon Ads configuration: ${missing.join(", ")}`,
      };
    }

    if (process.env.NODE_ENV === "production" && this.tokenStore.kind !== "external") {
      return {
        enabled: false,
        message: "Production token storage prerequisite is not met.",
      };
    }
    if (process.env.NODE_ENV === "production" && this.stateStore.kind !== "external") {
      return {
        enabled: false,
        message: "Production OAuth state storage prerequisite is not met.",
      };
    }
    return { enabled: true, message: null };
  }

  async beginAuthorization(actor: AmazonAdsIntegrationActor): Promise<OAuthResult> {
    assertActor(actor);
    this.assertLiveConnectionEnabled();
    await this.ensureCredentialRecordReady(actor);
    const connection = await this.ensureConnection(actor);
    const state = await this.stateStore.create({
      actor,
      connectionId: connection.id,
    });

    await connectorRepository.saveConnection({
      ...connection,
      status: "CONNECTING",
      metadata: {
        ...(connection.metadata || {}),
        actorUserId: actor.userId,
        stateExpiresAt: state.expiresAt,
      },
    });
    return {
      authorizeUrl: this.oauthClient.buildAuthorizeUrl(state.state),
      connectionId: connection.id,
    };
  }

  async completeAuthorization(input: {
    actor: AmazonAdsIntegrationActor;
    state: string;
    code: string;
  }): Promise<{ connectionId: string }> {
    assertActor(input.actor);
    this.assertLiveConnectionEnabled();
    const consumedState = await this.stateStore.consume({
      state: input.state,
      actor: input.actor,
    });
    const connection = await connectorRepository.getConnectionById(input.actor.workspaceId, consumedState.connectionId);
    if (!connection || connection.providerId !== PROVIDER_ID) {
      throw new Error("RESOURCE_NOT_FOUND:Amazon Ads live connection was not found.");
    }

    try {
      const tokenResponse = await this.oauthClient.exchangeAuthorizationCode(input.code);
      const encryptedRefreshToken = encryptRefreshToken(tokenResponse.refreshToken, this.config.tokenEncryptionKey);
      await this.tokenStore.save(
        newTokenRecord({
          workspaceId: input.actor.workspaceId,
          connectionId: connection.id,
          encryptedRefreshToken,
          now: nowIso(this.now),
        }),
      );

      const profiles = sanitizeProfileRows(await this.oauthClient.discoverProfiles(tokenResponse.accessToken));
      const expiresAt = new Date(this.now().getTime() + tokenResponse.expiresInSeconds * 1000).toISOString();

      const credentialReference = await this.ensureCredentialRecordReady(input.actor);
      await connectorRepository.saveConnection({
        ...connection,
        status: "CONNECTED",
        credentialReferenceId: credentialReference.id,
        metadata: {
          liveReadOnly: true,
          noCampaignChanges: true,
          sourceMode: "LIVE",
          actorUserId: input.actor.userId,
          selectedProfileId: null,
          selectedMarketplaceId: null,
          expiresAt,
          profiles,
        },
      });
      return { connectionId: connection.id };
    } catch (error) {
      await connectorRepository.saveConnection({
        ...connection,
        status: "ERROR",
        metadata: {
          ...(connection.metadata || {}),
          lastError: this.redactError(error),
        },
      });
      throw new Error(this.redactError(error));
    }
  }

  async getConnectionView(actor: AmazonAdsIntegrationActor): Promise<AmazonAdsConnectionView> {
    assertActor(actor);
    const connection = await findLiveConnection(actor);
    const featureEnabled = getAmazonAdsLiveFeatureEnabled();
    const availability = this.getConnectAvailability();
    const connectEnabled = availability.enabled;
    const disconnectedMessage = availability.message || "Connect Amazon Ads to discover advertiser profiles.";
    if (!connection) {
      return {
        connectionId: null,
        status: "disconnected",
        featureEnabled,
        liveReadOnly: true,
        noCampaignChanges: true,
        profiles: [],
        selectedProfileId: null,
        selectedMarketplaceId: null,
        expiresAt: null,
        message: disconnectedMessage,
        connectEnabled,
      };
    }
    const metadata = connection.metadata || {};
    return {
      connectionId: connection.id,
      status: toStatus(connection, this.now().getTime()),
      featureEnabled,
      liveReadOnly: true,
      noCampaignChanges: true,
      profiles: parseProfiles(metadata),
      selectedProfileId:
        typeof metadata.selectedProfileId === "string" ? metadata.selectedProfileId : null,
      selectedMarketplaceId:
        typeof metadata.selectedMarketplaceId === "string" ? metadata.selectedMarketplaceId : null,
      expiresAt: typeof metadata.expiresAt === "string" ? metadata.expiresAt : null,
      message: typeof metadata.lastError === "string" ? metadata.lastError : null,
      connectEnabled,
    };
  }

  async selectProfile(input: {
    actor: AmazonAdsIntegrationActor;
    connectionId: string;
    profileId: string;
    marketplaceId: string;
  }): Promise<void> {
    assertActor(input.actor);
    const connection = await connectorRepository.getConnectionById(input.actor.workspaceId, input.connectionId);
    if (!connection || connection.providerId !== PROVIDER_ID) {
      throw new Error("RESOURCE_NOT_FOUND:Amazon Ads live connection was not found.");
    }
    const profiles = parseProfiles(connection.metadata || {});
    const match = profiles.find(
      (row) => row.profileId === input.profileId && row.marketplaceId === input.marketplaceId,
    );
    if (!match) {
      throw new Error("PROFILE_SELECTION_INVALID:Selected profile/marketplace is not available for this connection.");
    }
    await connectorRepository.saveConnection({
      ...connection,
      metadata: {
        ...(connection.metadata || {}),
        selectedProfileId: input.profileId,
        selectedMarketplaceId: input.marketplaceId,
      },
    });
  }

  async disconnect(input: {
    actor: AmazonAdsIntegrationActor;
    connectionId: string;
    confirmed: boolean;
  }): Promise<AmazonAdsDisconnectResult> {
    assertActor(input.actor);
    if (!input.confirmed) {
      throw new Error("CONFIRMATION_REQUIRED:Disconnect must be explicitly confirmed.");
    }
    const connection = await connectorRepository.getConnectionById(input.actor.workspaceId, input.connectionId);
    if (!connection || connection.providerId !== PROVIDER_ID) {
      throw new Error("RESOURCE_NOT_FOUND:Amazon Ads live connection was not found.");
    }
    const token = await this.tokenStore.get(input.actor.workspaceId, input.connectionId);
    let localCredentialsDeleted = false;
    let remoteRevocationAttempted = false;
    let remoteRevocationSucceeded = false;
    let message: string | null = null;
    if (token) {
      remoteRevocationAttempted = true;
      try {
        const refreshToken = decryptRefreshToken(token.encryptedRefreshToken, this.config.tokenEncryptionKey);
        await this.oauthClient.revokeRefreshToken(refreshToken);
        remoteRevocationSucceeded = true;
      } catch (error) {
        this.telemetry?.failure?.(input.actor.workspaceId, PROVIDER_ID, "TOKEN_REVOKE_FAILED", "disconnect");
        remoteRevocationSucceeded = false;
        message = `REMOTE_REVOCATION_FAILED:${this.redactError(error)}`;
      } finally {
        await this.tokenStore.delete(input.actor.workspaceId, input.connectionId);
        localCredentialsDeleted = true;
      }
    }
    if (!token) {
      localCredentialsDeleted = true;
    }

    if (remoteRevocationAttempted && !remoteRevocationSucceeded) {
      await connectorRepository.saveConnection({
        ...connection,
        status: "ERROR",
        credentialReferenceId: null,
        metadata: {
          ...(connection.metadata || {}),
          selectedProfileId: null,
          selectedMarketplaceId: null,
          profiles: [],
          expiresAt: null,
          disconnectedAt: nowIso(this.now),
          lastError:
            "Remote token revocation failed. Local credentials were removed and live access is disabled until reconnection.",
        },
      });
      return {
        localCredentialsDeleted,
        remoteRevocationAttempted,
        remoteRevocationSucceeded,
        connectionStatus: "error",
        message:
          "Local credentials were removed. Amazon remote token revocation failed; reconnect to re-establish secure access.",
      };
    }

    await connectorRepository.saveConnection({
      ...connection,
      status: "DISCONNECTED",
      credentialReferenceId: null,
      metadata: {
        ...(connection.metadata || {}),
        selectedProfileId: null,
        selectedMarketplaceId: null,
        profiles: [],
        expiresAt: null,
        disconnectedAt: nowIso(this.now),
      },
    });
    return {
      localCredentialsDeleted,
      remoteRevocationAttempted,
      remoteRevocationSucceeded,
      connectionStatus: "disconnected",
      message,
    };
  }

  async refreshAccessToken(actor: AmazonAdsIntegrationActor, connectionId: string): Promise<{ expiresAt: string }> {
    assertActor(actor);
    this.assertLiveConnectionEnabled();
    const connection = await connectorRepository.getConnectionById(actor.workspaceId, connectionId);
    if (!connection || connection.providerId !== PROVIDER_ID) {
      throw new Error("RESOURCE_NOT_FOUND:Amazon Ads live connection was not found.");
    }
    const token = await this.tokenStore.get(actor.workspaceId, connectionId);
    if (!token) {
      throw new Error("PROVIDER_NOT_CONFIGURED:No refresh token is stored for this connection.");
    }
    try {
      const refreshToken = decryptRefreshToken(token.encryptedRefreshToken, this.config.tokenEncryptionKey);
      const refreshed = await this.oauthClient.refreshAccessToken(refreshToken);
      const expiresAt = new Date(this.now().getTime() + refreshed.expiresInSeconds * 1000).toISOString();
      await connectorRepository.saveConnection({
        ...connection,
        status: "CONNECTED",
        metadata: {
          ...(connection.metadata || {}),
          expiresAt,
        },
      });
      return { expiresAt };
    } catch (error) {
      throw new Error(this.redactError(error));
    }
  }

  async getLiveReadAccess(actor: AmazonAdsIntegrationActor): Promise<AmazonAdsLiveReadAccess> {
    assertActor(actor);
    this.assertLiveConnectionEnabled();
    const connection = await findLiveConnection(actor);
    if (!connection || connection.status !== "CONNECTED") {
      throw new Error("PROVIDER_NOT_CONFIGURED:Amazon Ads is not connected.");
    }
    const metadata = connection.metadata || {};
    const profileId =
      typeof metadata.selectedProfileId === "string" ? metadata.selectedProfileId : "";
    const marketplaceId =
      typeof metadata.selectedMarketplaceId === "string" ? metadata.selectedMarketplaceId : "";
    if (!profileId || !marketplaceId) {
      throw new Error("PROFILE_SELECTION_REQUIRED:Select an advertiser profile and marketplace first.");
    }
    const token = await this.tokenStore.get(actor.workspaceId, connection.id);
    if (!token) {
      throw new Error("PROVIDER_NOT_CONFIGURED:No refresh token is stored for this connection.");
    }
    try {
      const refreshToken = decryptRefreshToken(
        token.encryptedRefreshToken,
        this.config.tokenEncryptionKey,
      );
      const refreshed = await this.oauthClient.refreshAccessToken(refreshToken);
      const expiresAt = new Date(
        this.now().getTime() + refreshed.expiresInSeconds * 1000,
      ).toISOString();
      await connectorRepository.saveConnection({
        ...connection,
        status: "CONNECTED",
        metadata: {
          ...metadata,
          expiresAt,
          lastError: null,
        },
      });
      return {
        workspaceId: actor.workspaceId,
        connectionId: connection.id,
        clientId: this.config.clientId,
        accessToken: refreshed.accessToken,
        profileId,
        marketplaceId,
        region: inferRegionFromMarketplaces([marketplaceId]),
      };
    } catch (error) {
      throw new Error(this.redactError(error));
    }
  }

  private redactError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return redactSecrets(message);
  }

  private assertLiveConnectionEnabled(): void {
    const availability = this.getConnectAvailability();
    if (!availability.enabled) {
      if (!this.config.liveReadEnabled) {
        throw new Error("FEATURE_DISABLED:Amazon Ads live read-only mode is disabled.");
      }
      if (availability.message?.startsWith("Missing required Amazon Ads configuration:")) {
        throw new Error(`CONFIG_MISSING:${availability.message}`);
      }
      throw new Error(
        `SECURITY_POLICY_VIOLATION:${availability.message || "Live connection prerequisites are not met."}`,
      );
    }
  }

  private async ensureConnection(actor: AmazonAdsIntegrationActor): Promise<ConnectorConnectionRecord> {
    const existing = await findLiveConnection(actor);
    if (existing) return existing;
    return connectorRepository.saveConnection({
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      providerId: PROVIDER_ID,
      status: "DISCONNECTED",
      credentialReferenceId: null,
      metadata: {
        liveReadOnly: true,
        noCampaignChanges: true,
        sourceMode: "LIVE",
        actorUserId: actor.userId,
      },
    });
  }

  private async ensureCredentialRecordReady(actor: AmazonAdsIntegrationActor): Promise<ConnectorCredentialReferenceRecord> {
    const connection = await findLiveConnection(actor);
    if (connection?.credentialReferenceId) {
      const existingReference = await connectorRepository.getCredentialReferenceById(
        actor.workspaceId,
        connection.credentialReferenceId,
      );
      if (existingReference) return existingReference;
    }
    return connectorRepository.saveCredentialReference({
      workspaceId: actor.workspaceId,
      providerId: PROVIDER_ID,
      referenceType: "oauth-refresh-token",
      referenceId: randomUUID(),
    });
  }
}

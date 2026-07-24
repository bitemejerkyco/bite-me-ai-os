export type AmazonAdsIntegrationActor = {
  workspaceId: string;
  userId: string;
};

export type AmazonAdsConnectionStatusView =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "error";

export type AmazonAdsAdvertiserProfile = {
  profileId: string;
  marketplaceId: string;
  accountName: string;
  accountType: string;
  currencyCode: string;
};

export type AmazonAdsConnectionView = {
  connectionId: string | null;
  status: AmazonAdsConnectionStatusView;
  featureEnabled: boolean;
  liveReadOnly: true;
  noCampaignChanges: true;
  profiles: AmazonAdsAdvertiserProfile[];
  selectedProfileId: string | null;
  selectedMarketplaceId: string | null;
  expiresAt: string | null;
  message: string | null;
};

export type AmazonAdsStatePayload = {
  state: string;
  workspaceId: string;
  userId: string;
  connectionId: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type AmazonAdsTokenRecord = {
  id: string;
  workspaceId: string;
  connectionId: string;
  providerId: "amazon-ads-live";
  encryptedRefreshToken: string;
  createdAt: string;
  updatedAt: string;
};

export type AmazonAdsTokenStore = {
  kind: "memory" | "persistent";
  get(workspaceId: string, connectionId: string): Promise<AmazonAdsTokenRecord | null>;
  save(record: AmazonAdsTokenRecord): Promise<AmazonAdsTokenRecord>;
  delete(workspaceId: string, connectionId: string): Promise<void>;
};

export type AmazonAdsLiveConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  liveReadEnabled: boolean;
};

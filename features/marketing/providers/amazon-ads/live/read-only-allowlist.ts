const AMAZON_ADS_LIVE_READ_ONLY_OPERATIONS = new Set([
  "oauth_authorize",
  "oauth_token_exchange",
  "oauth_token_refresh",
  "oauth_token_revoke",
  "profile_discovery",
  "report_read_create",
  "report_read_status",
  "report_read_download",
] as const);

export type AmazonAdsLiveReadOperation = (typeof AMAZON_ADS_LIVE_READ_ONLY_OPERATIONS extends Set<
  infer T
>
  ? T
  : never) & string;

export function assertAmazonAdsReadOnlyOperation(operation: string): asserts operation is AmazonAdsLiveReadOperation {
  if (!AMAZON_ADS_LIVE_READ_ONLY_OPERATIONS.has(operation as AmazonAdsLiveReadOperation)) {
    throw new Error(`READ_ONLY_VIOLATION:Operation "${operation}" is not allowed for Amazon Ads live read-only mode.`);
  }
}

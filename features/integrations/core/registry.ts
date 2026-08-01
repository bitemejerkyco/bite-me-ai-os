export type IntegrationProviderId =
  | "tiktok"
  | "amazon_ads"
  | "shopify"
  | "woocommerce"
  | "klaviyo"
  | "mailchimp"
  | "ga4"
  | "meta"
  | "linkedin"
  | "x"
  | "youtube"
  | "pinterest"
  | "google_business_profile"
  | "amazon_seller_central";

export type IntegrationSupportLevel = "live" | "partial" | "coming_soon";

export type IntegrationCapability =
  | "oauth"
  | "publishing"
  | "analytics"
  | "webhooks"
  | "background_sync"
  | "token_refresh";

export type IntegrationProviderDefinition = {
  id: IntegrationProviderId;
  label: string;
  supportLevel: IntegrationSupportLevel;
  readOnly: boolean;
  capabilities: IntegrationCapability[];
  description: string;
};

export const INTEGRATION_PROVIDER_REGISTRY: readonly IntegrationProviderDefinition[] = [
  {
    id: "tiktok",
    label: "TikTok",
    supportLevel: "live",
    readOnly: false,
    capabilities: ["oauth", "publishing", "webhooks", "token_refresh"],
    description: "OAuth account connection and upload-to-draft publishing flow.",
  },
  {
    id: "amazon_ads",
    label: "Amazon Ads",
    supportLevel: "live",
    readOnly: true,
    capabilities: ["oauth", "analytics", "background_sync", "token_refresh"],
    description: "Live read-only advertiser profile discovery and insights ingestion.",
  },
  {
    id: "shopify",
    label: "Shopify",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "klaviyo",
    label: "Klaviyo",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "mailchimp",
    label: "Mailchimp",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "ga4",
    label: "Google Analytics 4",
    supportLevel: "coming_soon",
    readOnly: true,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "meta",
    label: "Meta",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "x",
    label: "X",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "youtube",
    label: "YouTube",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    supportLevel: "coming_soon",
    readOnly: false,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "google_business_profile",
    label: "Google Business Profile",
    supportLevel: "coming_soon",
    readOnly: true,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
  {
    id: "amazon_seller_central",
    label: "Amazon Seller Central",
    supportLevel: "coming_soon",
    readOnly: true,
    capabilities: [],
    description: "Provider card reserved; no live runtime adapter is enabled.",
  },
] as const;

export function providerById(id: IntegrationProviderId): IntegrationProviderDefinition {
  const provider = INTEGRATION_PROVIDER_REGISTRY.find((item) => item.id === id);
  if (!provider) {
    throw new Error(`INTEGRATION_PROVIDER_UNKNOWN:${id}`);
  }
  return provider;
}

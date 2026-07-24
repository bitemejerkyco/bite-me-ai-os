import type { MarketingProvider } from "@/features/marketing/providers/contracts";

type ProviderEntry = {
  contract: MarketingProvider;
};

export class MarketingProviderRegistry {
  private readonly providers = new Map<string, ProviderEntry>();

  activate(providerId: string, provider: MarketingProvider): void {
    if (providerId !== provider.providerId) {
      throw new Error("MARKETING_PROVIDER_MISMATCH:Provider id does not match contract.");
    }

    if (providerId === "amazon-ads") {
      throw new Error("SANDBOX_ONLY:Amazon Ads provider can only be activated in sandbox runtime flows.");
    }

    this.providers.set(providerId, { contract: provider });
  }

  resolve(providerId: string): ProviderEntry | null {
    return this.providers.get(providerId) || null;
  }

  list(): ProviderEntry[] {
    return [...this.providers.values()];
  }
}

export function createMarketingProviderRegistry(): MarketingProviderRegistry {
  return new MarketingProviderRegistry();
}
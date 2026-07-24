import { InMemoryMarketingRepository } from "@/features/marketing/repositories/memory-repository";
import type { MarketingRepository } from "@/features/marketing/repositories/repository";

export class MarketingRuntime {
  constructor(readonly repository: MarketingRepository) {}
}

let runtime: MarketingRuntime | null = null;

export function getMarketingRuntime(): MarketingRuntime {
  runtime ||= new MarketingRuntime(new InMemoryMarketingRepository());
  return runtime;
}

export function setMarketingRuntime(value: MarketingRuntime | null): void {
  runtime = value;
}
import type {
  AnyMarketingEntity,
  MarketingEntityType,
  MarketingListQuery,
} from "@/features/marketing/domain/models";

export interface MarketingRepository {
  list<T extends AnyMarketingEntity = AnyMarketingEntity>(query: MarketingListQuery): Promise<T[]>;
  findByExternalId<T extends AnyMarketingEntity = AnyMarketingEntity>(
    workspaceId: string,
    entityType: MarketingEntityType,
    providerId: string,
    externalId: string,
  ): Promise<T | null>;
  upsert<T extends AnyMarketingEntity>(entity: T): Promise<T>;
}
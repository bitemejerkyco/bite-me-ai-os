import type {
  AnyMarketingEntity,
  MarketingEntityType,
  MarketingListQuery,
} from "@/features/marketing/domain/models";
import type { MarketingRepository } from "@/features/marketing/repositories/repository";

export class InMemoryMarketingRepository implements MarketingRepository {
  private readonly entities = new Map<string, AnyMarketingEntity>();

  async list<T extends AnyMarketingEntity = AnyMarketingEntity>(
    query: MarketingListQuery,
  ): Promise<T[]> {
    const rows = [...this.entities.values()].filter((entity) => {
      if (entity.workspaceId !== query.workspaceId) return false;
      if (query.entityType && entity.entityType !== query.entityType) return false;
      if (query.connectorId && entity.connectorId !== query.connectorId) return false;
      if (query.providerId && entity.providerId !== query.providerId) return false;
      if (query.campaignId && entity.campaignId !== query.campaignId) return false;
      return true;
    });

    const limited = typeof query.limit === "number" ? rows.slice(0, query.limit) : rows;
    return limited as T[];
  }

  async findByExternalId<T extends AnyMarketingEntity = AnyMarketingEntity>(
    workspaceId: string,
    entityType: MarketingEntityType,
    providerId: string,
    externalId: string,
  ): Promise<T | null> {
    for (const entity of this.entities.values()) {
      if (
        entity.workspaceId === workspaceId &&
        entity.entityType === entityType &&
        entity.providerId === providerId &&
        entity.externalId === externalId
      ) {
        return entity as T;
      }
    }
    return null;
  }

  async upsert<T extends AnyMarketingEntity>(entity: T): Promise<T> {
    this.entities.set(entity.id, entity);
    return entity;
  }
}
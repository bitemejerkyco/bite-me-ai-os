import { PrismaKnowledgeRepository } from "@/features/knowledge-engine/repositories/knowledge-repositories";
import { KnowledgeSearchService } from "@/features/knowledge-engine/search/search-service";
import type { SearchQuery, SearchResult } from "@/features/knowledge-engine/types";

export class KnowledgeQueryService {
  private readonly repository = new PrismaKnowledgeRepository();
  private readonly search = new KnowledgeSearchService();

  async searchDocuments(query: SearchQuery): Promise<SearchResult> {
    const candidates = await this.repository.searchCandidates({
      workspaceId: query.filters.workspaceId,
      collectionId: query.filters.collectionId,
      sourceType: query.filters.sourceType,
      mimeType: query.filters.mimeType,
      status: query.filters.status,
      uploadedById: query.filters.uploadedById,
      createdFrom: query.filters.createdFrom ? new Date(query.filters.createdFrom) : undefined,
      createdTo: query.filters.createdTo ? new Date(query.filters.createdTo) : undefined,
    });

    return this.search.rank(query, candidates);
  }
}

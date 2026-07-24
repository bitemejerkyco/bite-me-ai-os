import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { SearchQuery, SearchResult, SearchResultItem } from "@/features/knowledge-engine/types";

export type SearchCandidate = {
  documentId: string;
  chunkId: string;
  chunkStableKey: string;
  title?: string | null;
  filename: string;
  mimeType: string;
  collectionName?: string | null;
  text: string;
  citationKeys: string[];
  createdAt: string;
};

function scoreText(text: string, term: string): number {
  const normalizedText = text.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  if (!normalizedTerm) return 0;
  let index = normalizedText.indexOf(normalizedTerm);
  let count = 0;
  while (index !== -1) {
    count += 1;
    index = normalizedText.indexOf(normalizedTerm, index + normalizedTerm.length);
  }
  return count;
}

function snippet(text: string, term: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const termLower = term.toLowerCase();
  const idx = normalized.toLowerCase().indexOf(termLower);
  if (idx < 0) {
    return normalized.slice(0, KNOWLEDGE_ENGINE_CONFIG.maxSnippetLength);
  }
  const start = Math.max(0, idx - Math.floor(KNOWLEDGE_ENGINE_CONFIG.maxSnippetLength / 2));
  const end = Math.min(normalized.length, start + KNOWLEDGE_ENGINE_CONFIG.maxSnippetLength);
  return normalized.slice(start, end);
}

export class KnowledgeSearchService {
  rank(query: SearchQuery, candidates: SearchCandidate[]): SearchResult {
    const term = query.term.trim();
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));

    const scored = candidates
      .map((candidate) => {
        const score = scoreText(candidate.text, term) + scoreText(candidate.title || "", term) + scoreText(candidate.filename, term);
        return {
          ...candidate,
          score,
          snippet: snippet(candidate.text, term),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
        return a.chunkStableKey.localeCompare(b.chunkStableKey);
      });

    const start = (page - 1) * pageSize;
    const items: SearchResultItem[] = scored.slice(start, start + pageSize).map((item) => ({
      documentId: item.documentId,
      chunkId: item.chunkId,
      chunkStableKey: item.chunkStableKey,
      title: item.title,
      filename: item.filename,
      mimeType: item.mimeType,
      collectionName: item.collectionName,
      score: item.score,
      snippet: item.snippet,
      citationKeys: item.citationKeys,
      createdAt: item.createdAt,
    }));

    return {
      total: scored.length,
      page,
      pageSize,
      items,
    };
  }
}

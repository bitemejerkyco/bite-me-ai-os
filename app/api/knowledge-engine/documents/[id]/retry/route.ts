import { z } from "zod";
import { errorResponse, fromUnknownError, successResponse } from "@/lib/api-response";
import { requireKnowledgeWorkspaceAccess } from "@/features/knowledge-engine/services/auth-context";
import { PrismaKnowledgeRepository } from "@/features/knowledge-engine/repositories";
import { KnowledgeIngestionService } from "@/features/knowledge-engine/services/ingestion-service";

const repository = new PrismaKnowledgeRepository();
const ingestion = new KnowledgeIngestionService();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = z.object({ workspaceSlug: z.string().min(2) }).safeParse(body);
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", "workspaceSlug is required.", { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "EDITOR");
    const document = await repository.findDocumentById(auth.workspaceId, id);
    if (!document) return errorResponse("NOT_FOUND", "Document not found.", { status: 404 });
    if (!document.storageKey) {
      return errorResponse("RETRY_UNAVAILABLE", "No stored file is available for retry.", { status: 400 });
    }

    const result = await ingestion.retryStoredDocument({
      workspaceId: auth.workspaceId,
      documentId: document.id,
    });

    return successResponse({ status: result.documentStatus, chunks: result.chunks.length, citations: result.citations.length });
  } catch (error) {
    return fromUnknownError(error, "Unable to retry document processing.");
  }
}

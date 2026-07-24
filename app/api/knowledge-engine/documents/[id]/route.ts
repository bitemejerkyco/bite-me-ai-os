import { z } from "zod";
import { errorResponse, fromUnknownError, successResponse } from "@/lib/api-response";
import { PrismaKnowledgeRepository } from "@/features/knowledge-engine/repositories";
import { requireKnowledgeWorkspaceAccess } from "@/features/knowledge-engine/services/auth-context";

const schema = z.object({
  workspaceSlug: z.string().min(2),
});

const repository = new PrismaKnowledgeRepository();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const parsed = schema.safeParse({ workspaceSlug: url.searchParams.get("workspaceSlug") || "" });
    if (!parsed.success) return errorResponse("INVALID_REQUEST", "workspaceSlug is required.", { status: 400 });

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "VIEWER");
    const document = await repository.findDocumentById(auth.workspaceId, id);
    if (!document) return errorResponse("NOT_FOUND", "Document not found.", { status: 404 });

    const citationCount = 0;
    return successResponse({
      document: {
        id: document.id,
        filename: document.filename,
        originalFilename: document.originalFilename,
        title: document.title,
        author: document.author,
        company: document.company,
        language: document.language,
        mimeType: document.mimeType,
        status: document.status,
        sizeBytes: document.sizeBytes,
        checksum: document.checksum,
        source: document.source ? { id: document.source.id, type: document.source.type, name: document.source.displayName } : null,
        collection: document.collection ? { id: document.collection.id, name: document.collection.name } : null,
        uploadedAt: document.uploadedAt.toISOString(),
        processedAt: document.processedAt?.toISOString() || null,
        failureReason: document.failureReason,
        metadata: document.metadata,
        chunkCount: document._count.chunks,
        citationCount,
        chunks: document.chunks,
        jobs: document.jobs.map((job) => ({
          id: job.id,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          attempt: job.attempt,
          errorCode: job.errorCode,
          errorMessage: job.errorMessage,
          startedAt: job.startedAt?.toISOString() || null,
          completedAt: job.completedAt?.toISOString() || null,
        })),
      },
    });
  } catch (error) {
    return fromUnknownError(error, "Unable to read document details.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = z
      .object({
        workspaceSlug: z.string().min(2),
        action: z.enum(["archive"]),
      })
      .safeParse(body);

    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "), { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "EDITOR");
    const document = await repository.markDocumentArchived(auth.workspaceId, id);
    return successResponse({ id: document.id, status: document.status });
  } catch (error) {
    return fromUnknownError(error, "Unable to update document.");
  }
}

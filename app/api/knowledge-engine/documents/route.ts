import { z } from "zod";
import { errorResponse, fromUnknownError, successResponse } from "@/lib/api-response";
import { PrismaKnowledgeRepository } from "@/features/knowledge-engine/repositories";
import { requireKnowledgeWorkspaceAccess } from "@/features/knowledge-engine/services/auth-context";

const querySchema = z.object({
  workspaceSlug: z.string().min(2),
});

const repository = new PrismaKnowledgeRepository();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ workspaceSlug: url.searchParams.get("workspaceSlug") || "" });
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", "workspaceSlug is required.", { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "VIEWER");
    const documents = await repository.listDocumentsByWorkspace(auth.workspaceId);

    return successResponse({
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        originalFilename: doc.originalFilename,
        title: doc.title,
        mimeType: doc.mimeType,
        status: doc.status,
        sizeBytes: doc.sizeBytes,
        checksum: doc.checksum,
        collectionId: doc.collectionId,
        uploadedAt: doc.uploadedAt.toISOString(),
        processedAt: doc.processedAt?.toISOString() || null,
        failureReason: doc.failureReason,
      })),
    });
  } catch (error) {
    return fromUnknownError(error, "Unable to list documents.");
  }
}

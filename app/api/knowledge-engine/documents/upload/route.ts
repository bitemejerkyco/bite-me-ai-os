import { errorResponse, fromUnknownError, successResponse } from "@/lib/api-response";
import { KnowledgeIngestionService } from "@/features/knowledge-engine/services/ingestion-service";
import { requireKnowledgeWorkspaceAccess } from "@/features/knowledge-engine/services/auth-context";

const ingestion = new KnowledgeIngestionService();

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const workspaceSlug = String(form.get("workspaceSlug") || "");
    const collectionId = form.get("collectionId") ? String(form.get("collectionId")) : undefined;
    const sourceId = form.get("sourceId") ? String(form.get("sourceId")) : undefined;
    const file = form.get("file");

    if (!workspaceSlug) {
      return errorResponse("INVALID_REQUEST", "workspaceSlug is required.", { status: 400 });
    }

    if (!(file instanceof File)) {
      return errorResponse("INVALID_REQUEST", "A file upload is required.", { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(workspaceSlug, "EDITOR");
    const bytes = new Uint8Array(await file.arrayBuffer());

    const result = await ingestion.ingestUpload({
      workspaceId: auth.workspaceId,
      uploadedById: auth.userId,
      sourceId,
      collectionId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });

    return successResponse(
      {
        status: result.documentStatus,
        chunks: result.chunks.length,
        citations: result.citations.length,
        warnings: result.warnings,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes(":")) {
      const [code, ...rest] = error.message.split(":");
      return errorResponse(code, rest.join(":") || "Upload failed.", { status: 400 });
    }
    return fromUnknownError(error, "Unable to ingest document.");
  }
}

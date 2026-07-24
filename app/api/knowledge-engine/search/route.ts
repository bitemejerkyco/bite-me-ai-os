import { z } from "zod";
import { errorResponse, fromUnknownError, successResponse } from "@/lib/api-response";
import { requireKnowledgeWorkspaceAccess } from "@/features/knowledge-engine/services/auth-context";
import { KnowledgeQueryService } from "@/features/knowledge-engine/services/query-service";

const requestSchema = z.object({
  workspaceSlug: z.string().min(2),
  term: z.string().min(1).max(200),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  filters: z
    .object({
      collectionId: z.string().cuid().optional(),
      sourceType: z
        .enum(["UPLOAD", "WEBSITE", "GOOGLE_DRIVE", "DROPBOX", "ONEDRIVE", "NOTION", "CONFLUENCE", "GITHUB", "RSS", "API", "MANUAL"])
        .optional(),
      mimeType: z.string().optional(),
      status: z.enum(["QUEUED", "PROCESSING", "READY", "FAILED", "ARCHIVED"]).optional(),
      uploadedById: z.string().cuid().optional(),
      createdFrom: z.string().datetime().optional(),
      createdTo: z.string().datetime().optional(),
    })
    .default({}),
});

const service = new KnowledgeQueryService();

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "), { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "VIEWER");
    const result = await service.searchDocuments({
      term: parsed.data.term,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      filters: {
        workspaceId: auth.workspaceId,
        collectionId: parsed.data.filters.collectionId,
        sourceType: parsed.data.filters.sourceType,
        mimeType: parsed.data.filters.mimeType,
        status: parsed.data.filters.status,
        uploadedById: parsed.data.filters.uploadedById,
        createdFrom: parsed.data.filters.createdFrom,
        createdTo: parsed.data.filters.createdTo,
      },
    });

    return successResponse(result);
  } catch (error) {
    return fromUnknownError(error, "Unable to search knowledge documents.");
  }
}

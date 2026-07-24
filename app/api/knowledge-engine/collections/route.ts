import { z } from "zod";
import { errorResponse, fromUnknownError, successResponse } from "@/lib/api-response";
import { PrismaKnowledgeRepository } from "@/features/knowledge-engine/repositories";
import { requireKnowledgeWorkspaceAccess } from "@/features/knowledge-engine/services/auth-context";

const listSchema = z.object({
  workspaceSlug: z.string().min(2),
});

const createSchema = z.object({
  workspaceSlug: z.string().min(2),
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(300).optional(),
});

const repository = new PrismaKnowledgeRepository();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = listSchema.safeParse({ workspaceSlug: url.searchParams.get("workspaceSlug") || "" });
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", "workspaceSlug is required.", { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "VIEWER");
    const collections = await repository.listCollectionsByWorkspace(auth.workspaceId);
    return successResponse({ collections });
  } catch (error) {
    return fromUnknownError(error, "Unable to list collections.");
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("INVALID_REQUEST", parsed.error.issues.map((issue) => issue.message).join("; "), { status: 400 });
    }

    const auth = await requireKnowledgeWorkspaceAccess(parsed.data.workspaceSlug, "EDITOR");
    const collection = await repository.createCollection({
      workspaceId: auth.workspaceId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
    });
    return successResponse({ collection }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error, "Unable to create collection.");
  }
}

import { z } from "zod";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";

export const uploadRequestSchema = z.object({
  workspaceSlug: z.string().min(2).max(80),
  collectionId: z.string().cuid().optional(),
  sourceId: z.string().cuid().optional(),
});

export const uploadFileSchema = z.object({
  filename: z.string().min(1).max(KNOWLEDGE_ENGINE_CONFIG.maxUploadFilenameLength),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(KNOWLEDGE_ENGINE_CONFIG.maxFileSizeBytes),
});

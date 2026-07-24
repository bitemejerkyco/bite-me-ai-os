import type { KnowledgeSourceType } from "@prisma/client";
import type { KnowledgeConnector } from "@/features/knowledge-engine/connectors/interface";
import type { ConnectorIngestInput, ConnectorIngestResult, ConnectorSyncResult } from "@/features/knowledge-engine/types";

export class UploadConnector implements KnowledgeConnector {
  readonly id = "upload";
  readonly name = "File Upload";
  readonly sourceType: KnowledgeSourceType = "UPLOAD";

  isConfigured(): boolean {
    return true;
  }

  async sync(): Promise<ConnectorSyncResult> {
    return {
      status: "ready",
      syncedCount: 0,
      message: "Upload connector does not run external sync jobs.",
    };
  }

  async ingest(input: ConnectorIngestInput): Promise<ConnectorIngestResult> {
    if (!input.file) {
      return {
        status: "failed",
        files: [],
        message: "No upload file provided.",
      };
    }

    return {
      status: "ready",
      files: [input.file],
    };
  }
}

export function createPlaceholderConnector(params: {
  id: string;
  name: string;
  sourceType: KnowledgeSourceType;
  configured?: boolean;
}): KnowledgeConnector {
  return {
    id: params.id,
    name: params.name,
    sourceType: params.sourceType,
    isConfigured() {
      return Boolean(params.configured);
    },
    async ingest() {
      return {
        status: params.configured ? "unsupported" : "not-configured",
        files: [],
        message: params.configured
          ? `${params.name} is planned but not implemented in Sprint 3A.`
          : `${params.name} is not configured and is not implemented in Sprint 3A.`,
      };
    },
    async sync() {
      return {
        status: params.configured ? "unsupported" : "not-configured",
        syncedCount: 0,
        message: params.configured
          ? `${params.name} sync is planned but not implemented in Sprint 3A.`
          : `${params.name} sync is not configured and not implemented in Sprint 3A.`,
      };
    },
    async listSources() {
      return [];
    },
  };
}

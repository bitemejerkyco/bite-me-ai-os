import type { KnowledgeSourceType } from "@prisma/client";
import type {
  ConnectorIngestInput,
  ConnectorIngestResult,
  ConnectorSourceDescriptor,
  ConnectorSyncContext,
  ConnectorSyncResult,
} from "@/features/knowledge-engine/types";

export interface KnowledgeConnector {
  readonly id: string;
  readonly name: string;
  readonly sourceType: KnowledgeSourceType;

  isConfigured(): boolean;
  authenticate?(): Promise<void>;
  listSources?(): Promise<ConnectorSourceDescriptor[]>;
  sync?(context: ConnectorSyncContext): Promise<ConnectorSyncResult>;
  ingest(input: ConnectorIngestInput): Promise<ConnectorIngestResult>;
}

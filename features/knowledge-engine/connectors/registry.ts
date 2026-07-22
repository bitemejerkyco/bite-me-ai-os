import type { KnowledgeSourceType } from "@prisma/client";
import type { KnowledgeConnector } from "@/features/knowledge-engine/connectors/interface";

export class ConnectorRegistry {
  private readonly connectors = new Map<string, KnowledgeConnector>();

  register(connector: KnowledgeConnector): void {
    if (this.connectors.has(connector.id)) {
      throw new Error(`Connector with id '${connector.id}' is already registered.`);
    }
    this.connectors.set(connector.id, connector);
  }

  getById(id: string): KnowledgeConnector | undefined {
    return this.connectors.get(id);
  }

  getBySourceType(sourceType: KnowledgeSourceType): KnowledgeConnector[] {
    return Array.from(this.connectors.values())
      .filter((connector) => connector.sourceType === sourceType)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  list(): KnowledgeConnector[] {
    return Array.from(this.connectors.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}

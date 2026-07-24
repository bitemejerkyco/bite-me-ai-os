import { randomUUID } from "node:crypto";
import type {
  ConnectorAuditRecord,
  ConnectorCapabilityRecord,
  ConnectorCheckpointRecord,
  ConnectorConnectionRecord,
  ConnectorCredentialReferenceRecord,
  ConnectorHealthRecord,
  ConnectorProviderRecord,
  ConnectorSyncRunRecord,
} from "@/features/platform/connectors/domain/models";

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

export interface ConnectorRepository {
  saveProvider(input: Omit<ConnectorProviderRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorProviderRecord>;
  listProviders(): Promise<ConnectorProviderRecord[]>;
  getProvider(providerId: string): Promise<ConnectorProviderRecord | null>;

  saveConnection(input: Omit<ConnectorConnectionRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorConnectionRecord>;
  getConnectionById(workspaceId: string, connectionId: string): Promise<ConnectorConnectionRecord | null>;
  listConnections(workspaceId: string): Promise<ConnectorConnectionRecord[]>;

  saveCredentialReference(input: Omit<ConnectorCredentialReferenceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorCredentialReferenceRecord>;
  getCredentialReferenceById(workspaceId: string, credentialReferenceId: string): Promise<ConnectorCredentialReferenceRecord | null>;

  saveSyncRun(input: Omit<ConnectorSyncRunRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorSyncRunRecord>;
  getSyncRunById(workspaceId: string, syncRunId: string): Promise<ConnectorSyncRunRecord | null>;
  listSyncRuns(workspaceId: string, limit?: number): Promise<ConnectorSyncRunRecord[]>;

  saveCheckpoint(input: Omit<ConnectorCheckpointRecord, "id" | "createdAt"> & { id?: string }): Promise<ConnectorCheckpointRecord>;
  getLatestCheckpoint(workspaceId: string, connectionId: string, checkpointKey?: string): Promise<ConnectorCheckpointRecord | null>;

  saveHealth(input: Omit<ConnectorHealthRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorHealthRecord>;
  getLatestHealth(workspaceId: string, connectionId: string): Promise<ConnectorHealthRecord | null>;
  listHealth(workspaceId: string): Promise<ConnectorHealthRecord[]>;

  saveAudit(input: Omit<ConnectorAuditRecord, "id" | "createdAt"> & { id?: string }): Promise<ConnectorAuditRecord>;
  listAudits(workspaceId: string, limit?: number): Promise<ConnectorAuditRecord[]>;

  saveCapability(input: Omit<ConnectorCapabilityRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorCapabilityRecord>;
  listCapabilities(workspaceId: string, connectionId: string): Promise<ConnectorCapabilityRecord[]>;
}

export class InMemoryConnectorRepository implements ConnectorRepository {
  private readonly providers = new Map<string, ConnectorProviderRecord>();
  private readonly connections = new Map<string, ConnectorConnectionRecord>();
  private readonly credentials = new Map<string, ConnectorCredentialReferenceRecord>();
  private readonly syncRuns = new Map<string, ConnectorSyncRunRecord>();
  private readonly checkpoints = new Map<string, ConnectorCheckpointRecord>();
  private readonly healthRecords = new Map<string, ConnectorHealthRecord>();
  private readonly audits = new Map<string, ConnectorAuditRecord>();
  private readonly capabilities = new Map<string, ConnectorCapabilityRecord>();

  private withTimestamps<T extends Record<string, unknown>>(
    row: T,
    current?: { createdAt: string } | null,
  ): T & { createdAt: string; updatedAt: string } {
    const now = new Date().toISOString();
    const createdAt =
      current?.createdAt || (typeof row.createdAt === "string" ? row.createdAt : now);
    const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : now;
    return { ...row, createdAt, updatedAt };
  }

  async saveProvider(input: Omit<ConnectorProviderRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorProviderRecord> {
    const id = input.id || randomUUID();
    const current = this.providers.get(id);
    const row: ConnectorProviderRecord = this.withTimestamps({ id, ...clone(input) }, current as never);
    this.providers.set(id, row);
    return clone(row);
  }

  async listProviders(): Promise<ConnectorProviderRecord[]> {
    return clone([...this.providers.values()].sort((a, b) => a.providerId.localeCompare(b.providerId)));
  }

  async getProvider(providerId: string): Promise<ConnectorProviderRecord | null> {
    return clone([...this.providers.values()].find((x) => x.providerId === providerId) || null);
  }

  async saveConnection(input: Omit<ConnectorConnectionRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorConnectionRecord> {
    const id = input.id || randomUUID();
    const current = this.connections.get(id);
    const row: ConnectorConnectionRecord = this.withTimestamps({ id, ...clone(input) }, current as never);
    this.connections.set(id, row);
    return clone(row);
  }

  async getConnectionById(workspaceId: string, connectionId: string): Promise<ConnectorConnectionRecord | null> {
    const row = this.connections.get(connectionId);
    if (!row || row.workspaceId !== workspaceId) return null;
    return clone(row);
  }

  async listConnections(workspaceId: string): Promise<ConnectorConnectionRecord[]> {
    return clone([...this.connections.values()].filter((x) => x.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  async saveCredentialReference(input: Omit<ConnectorCredentialReferenceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorCredentialReferenceRecord> {
    const id = input.id || randomUUID();
    const current = this.credentials.get(id);
    const row: ConnectorCredentialReferenceRecord = this.withTimestamps({ id, ...clone(input) }, current as never);
    this.credentials.set(id, row);
    return clone(row);
  }

  async getCredentialReferenceById(workspaceId: string, credentialReferenceId: string): Promise<ConnectorCredentialReferenceRecord | null> {
    const row = this.credentials.get(credentialReferenceId);
    if (!row || row.workspaceId !== workspaceId) return null;
    return clone(row);
  }

  async saveSyncRun(input: Omit<ConnectorSyncRunRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorSyncRunRecord> {
    const id = input.id || randomUUID();
    const current = this.syncRuns.get(id);
    const row: ConnectorSyncRunRecord = this.withTimestamps({ id, ...clone(input) }, current as never);
    this.syncRuns.set(id, row);
    return clone(row);
  }

  async getSyncRunById(workspaceId: string, syncRunId: string): Promise<ConnectorSyncRunRecord | null> {
    const row = this.syncRuns.get(syncRunId);
    if (!row || row.workspaceId !== workspaceId) return null;
    return clone(row);
  }

  async listSyncRuns(workspaceId: string, limit = 50): Promise<ConnectorSyncRunRecord[]> {
    return clone(
      [...this.syncRuns.values()]
        .filter((x) => x.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  }

  async saveCheckpoint(input: Omit<ConnectorCheckpointRecord, "id" | "createdAt"> & { id?: string }): Promise<ConnectorCheckpointRecord> {
    const id = input.id || randomUUID();
    const row: ConnectorCheckpointRecord = { id, ...clone(input), createdAt: new Date().toISOString() };
    this.checkpoints.set(id, row);
    return clone(row);
  }

  async getLatestCheckpoint(workspaceId: string, connectionId: string, checkpointKey?: string): Promise<ConnectorCheckpointRecord | null> {
    const rows = [...this.checkpoints.values()]
      .reverse()
      .filter(
        (row) =>
          row.workspaceId === workspaceId &&
          row.connectionId === connectionId &&
          (!checkpointKey || row.checkpointKey === checkpointKey),
      );
    return clone(rows[0] || null);
  }

  async saveHealth(input: Omit<ConnectorHealthRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorHealthRecord> {
    const id = input.id || randomUUID();
    const current = this.healthRecords.get(id);
    const row: ConnectorHealthRecord = this.withTimestamps({ id, ...clone(input) }, current as never);
    this.healthRecords.set(id, row);
    return clone(row);
  }

  async getLatestHealth(workspaceId: string, connectionId: string): Promise<ConnectorHealthRecord | null> {
    const rows = [...this.healthRecords.values()]
      .filter((x) => x.workspaceId === workspaceId && x.connectionId === connectionId)
      .sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt));
    return clone(rows[0] || null);
  }

  async listHealth(workspaceId: string): Promise<ConnectorHealthRecord[]> {
    return clone(
      [...this.healthRecords.values()]
        .filter((x) => x.workspaceId === workspaceId)
        .sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt)),
    );
  }

  async saveAudit(input: Omit<ConnectorAuditRecord, "id" | "createdAt"> & { id?: string }): Promise<ConnectorAuditRecord> {
    const id = input.id || randomUUID();
    const row: ConnectorAuditRecord = { id, ...clone(input), createdAt: new Date().toISOString() };
    this.audits.set(id, row);
    return clone(row);
  }

  async listAudits(workspaceId: string, limit = 100): Promise<ConnectorAuditRecord[]> {
    return clone(
      [...this.audits.values()]
        .filter((x) => x.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  }

  async saveCapability(input: Omit<ConnectorCapabilityRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ConnectorCapabilityRecord> {
    const id = input.id || randomUUID();
    const current = this.capabilities.get(id);
    const row: ConnectorCapabilityRecord = this.withTimestamps({ id, ...clone(input) }, current as never);
    this.capabilities.set(id, row);
    return clone(row);
  }

  async listCapabilities(workspaceId: string, connectionId: string): Promise<ConnectorCapabilityRecord[]> {
    return clone(
      [...this.capabilities.values()].filter(
        (x) => x.workspaceId === workspaceId && x.connectionId === connectionId,
      ),
    );
  }
}
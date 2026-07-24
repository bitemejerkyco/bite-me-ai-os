export type ConnectorConnectionStatus =
  | "CONNECTED"
  | "CONNECTING"
  | "DISCONNECTED"
  | "EXPIRED"
  | "ERROR";
export type ConnectorSyncStatus = "RUNNING" | "COMPLETED" | "PARTIAL_SUCCESS" | "FAILED";

export interface ConnectorProviderRecord {
  id: string;
  providerId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorConnectionRecord {
  id: string;
  workspaceId: string;
  providerId: string;
  status: ConnectorConnectionStatus;
  credentialReferenceId: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorCredentialReferenceRecord {
  id: string;
  workspaceId: string;
  providerId: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorSyncRunRecord {
  id: string;
  workspaceId: string;
  providerId: string;
  connectionId: string;
  triggerType: string;
  mode: string;
  status: ConnectorSyncStatus;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  checkpointId: string | null;
  retriedFromSyncRunId: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorCheckpointRecord {
  id: string;
  workspaceId: string;
  providerId: string;
  connectionId: string;
  syncRunId: string;
  checkpointKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ConnectorHealthRecord {
  id: string;
  workspaceId: string;
  connectionId: string;
  status: string;
  details: Record<string, unknown>;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorAuditRecord {
  id: string;
  workspaceId: string;
  connectionId: string;
  action: string;
  actorId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ConnectorCapabilityRecord {
  id: string;
  workspaceId: string;
  connectionId: string;
  capability: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
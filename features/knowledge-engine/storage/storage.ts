export type SaveKnowledgeFileInput = {
  workspaceId: string;
  documentId: string;
  filename: string;
  bytes: Uint8Array;
  mimeType: string;
};

export type StoredKnowledgeFile = {
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
};

export interface KnowledgeFileStorage {
  save(input: SaveKnowledgeFileInput): Promise<StoredKnowledgeFile>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

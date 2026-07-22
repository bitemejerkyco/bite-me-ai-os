"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";

type Collection = {
  id: string;
  name: string;
  slug: string;
};

type DocumentListItem = {
  id: string;
  filename: string;
  originalFilename: string;
  title: string | null;
  mimeType: string;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  sizeBytes: number;
  checksum: string;
  collectionId: string | null;
  uploadedAt: string;
  processedAt: string | null;
  failureReason: string | null;
};

type InspectorDoc = {
  id: string;
  filename: string;
  originalFilename: string;
  title: string | null;
  author: string | null;
  company: string | null;
  language: string | null;
  mimeType: string;
  status: string;
  sizeBytes: number;
  checksum: string;
  source: { id: string; type: string; name: string } | null;
  collection: { id: string; name: string } | null;
  uploadedAt: string;
  processedAt: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  chunkCount: number;
  citationCount: number;
  chunks: { id: string; stableKey: string; chunkIndex: number; text: string; pageNumber: number | null; heading: string | null }[];
  jobs: { id: string; status: string; stage: string; progress: number; errorCode: string | null; errorMessage: string | null }[];
};

type SearchResultItem = {
  documentId: string;
  chunkId: string;
  chunkStableKey: string;
  title?: string | null;
  filename: string;
  mimeType: string;
  collectionName?: string | null;
  score: number;
  snippet: string;
  citationKeys: string[];
  createdAt: string;
};

function prettyBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusPill(status: string): string {
  if (status === "READY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (status === "FAILED") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  if (status === "PROCESSING" || status === "QUEUED") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (status === "ARCHIVED") return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
}

export function KnowledgeHubClient() {
  const [workspaceSlug, setWorkspaceSlug] = useState("demo-workspace");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<InspectorDoc | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const visibleDocuments = useMemo(() => {
    if (selectedCollectionId === "__uncategorized__") {
      return documents.filter((doc) => !doc.collectionId);
    }
    if (selectedCollectionId) {
      return documents.filter((doc) => doc.collectionId === selectedCollectionId);
    }
    return documents;
  }, [documents, selectedCollectionId]);

  const validateClientFile = useCallback((file: File): string | null => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!extension) return "File extension is required.";
    if (file.size <= 0) return "File is empty.";
    if (file.size > KNOWLEDGE_ENGINE_CONFIG.maxFileSizeBytes) {
      return `File exceeds ${(KNOWLEDGE_ENGINE_CONFIG.maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB limit.`;
    }
    if (KNOWLEDGE_ENGINE_CONFIG.blockedExtensions.includes(extension as (typeof KNOWLEDGE_ENGINE_CONFIG.blockedExtensions)[number])) {
      return `Files with .${extension} extension are blocked.`;
    }
    if (!KNOWLEDGE_ENGINE_CONFIG.supportedExtensions.includes(extension as (typeof KNOWLEDGE_ENGINE_CONFIG.supportedExtensions)[number])) {
      return `File extension .${extension} is not supported.`;
    }
    if (file.type && !KNOWLEDGE_ENGINE_CONFIG.supportedMimeTypes.includes(file.type as (typeof KNOWLEDGE_ENGINE_CONFIG.supportedMimeTypes)[number])) {
      return `MIME type ${file.type} is not supported.`;
    }
    return null;
  }, []);

  const loadCollections = useCallback(async () => {
    const response = await fetch(`/api/knowledge-engine/collections?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json?.error?.message || "Failed to load collections");
    setCollections(json.data.collections || []);
  }, [workspaceSlug]);

  const loadDocuments = useCallback(async () => {
    const response = await fetch(`/api/knowledge-engine/documents?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json?.error?.message || "Failed to load documents");
    setDocuments(json.data.documents || []);
  }, [workspaceSlug]);

  const loadInspector = useCallback(
    async (docId: string) => {
      const response = await fetch(`/api/knowledge-engine/documents/${docId}?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json?.error?.message || "Failed to load document details");
      setSelectedDoc(json.data.document);
    },
    [workspaceSlug]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCollections(), loadDocuments()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, [loadCollections, loadDocuments]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDoc(null);
      return;
    }
    void loadInspector(selectedDocId).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Unable to load document inspector");
    });
  }, [selectedDocId, loadInspector]);

  const onUpload = useCallback(
    async (file: File) => {
      setUploadMessage(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.set("workspaceSlug", workspaceSlug);
        form.set("file", file);
        const response = await fetch("/api/knowledge-engine/documents/upload", {
          method: "POST",
          body: form,
        });
        const json = await response.json();
        if (!response.ok || !json.ok) {
          throw new Error(json?.error?.message || "Upload failed");
        }
        setUploadMessage(`Uploaded successfully. Chunks: ${json.data.chunks}, citations: ${json.data.citations}`);
        setSearchResults([]);
        setSearchTerm("");
        await refresh();
      } catch (e) {
        setUploadMessage(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [refresh, workspaceSlug]
  );

  const runSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      await loadDocuments();
      return;
    }
    setSearchLoading(true);
    try {
      const response = await fetch("/api/knowledge-engine/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          term: searchTerm,
          page: 1,
          pageSize: 30,
          filters: {
            collectionId: selectedCollectionId && selectedCollectionId !== "__uncategorized__" ? selectedCollectionId : undefined,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json?.error?.message || "Search failed");
      setSearchResults(json.data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [loadDocuments, searchTerm, selectedCollectionId, workspaceSlug]);

  const retryDocument = useCallback(
    async (documentId: string) => {
      const response = await fetch(`/api/knowledge-engine/documents/${documentId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setError(json?.error?.message || "Retry failed");
        return;
      }
      await refresh();
      await loadInspector(documentId);
    },
    [loadInspector, refresh, workspaceSlug]
  );

  const archiveDocument = useCallback(
    async (documentId: string) => {
      const response = await fetch(`/api/knowledge-engine/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, action: "archive" }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setError(json?.error?.message || "Archive failed");
        return;
      }
      await refresh();
      if (selectedDocId === documentId) {
        await loadInspector(documentId);
      }
    },
    [loadInspector, refresh, selectedDocId, workspaceSlug]
  );

  return (
    <section className="grid gap-4 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_380px]">
      <aside className="surface-card p-4">
        <h2 className="text-sm font-semibold">Collections</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Knowledge groups for workspace-scoped context.</p>
        <div className="mt-3 space-y-2">
          <button
            onClick={() => setSelectedCollectionId(null)}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedCollectionId === null ? "border-rose-500/40 bg-rose-500/10" : "border-[var(--border)]"}`}
          >
            All Knowledge ({documents.length})
          </button>
          <button
            onClick={() => setSelectedCollectionId("__uncategorized__")}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedCollectionId === "__uncategorized__" ? "border-rose-500/40 bg-rose-500/10" : "border-[var(--border)]"}`}
          >
            Uncategorized ({documents.filter((doc) => !doc.collectionId).length})
          </button>
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => setSelectedCollectionId(collection.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedCollectionId === collection.id ? "border-rose-500/40 bg-rose-500/10" : "border-[var(--border)]"}`}
            >
              {collection.name}
            </button>
          ))}
        </div>
      </aside>

      <main className="surface-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={workspaceSlug}
            onChange={(event) => setWorkspaceSlug(event.target.value)}
            className="h-9 rounded-md border border-[var(--border)] bg-zinc-900 px-3 text-sm"
            placeholder="workspace slug"
          />
          <button onClick={() => void refresh()} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            Load Workspace
          </button>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 flex-1 rounded-md border border-[var(--border)] bg-zinc-900 px-3 text-sm"
            placeholder="Search title, filename, chunk text"
          />
          <button onClick={() => void runSearch()} className="rounded-md bg-rose-600 px-3 py-2 text-sm text-white">
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (!file) return;
            const validationError = validateClientFile(file);
            if (validationError) {
              setUploadMessage(validationError);
              return;
            }
            void onUpload(file);
          }}
          className={`mt-3 rounded-md border border-dashed p-4 ${dragging ? "border-rose-400 bg-rose-500/10" : "border-[var(--border)]"}`}
        >
          <p className="text-sm font-medium">Upload document</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Drag and drop or browse. Max size {(KNOWLEDGE_ENGINE_CONFIG.maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB. Supported: {KNOWLEDGE_ENGINE_CONFIG.supportedExtensions.join(", ")}
          </p>
          <label className="mt-3 inline-flex cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            Browse file
            <input
              type="file"
              className="hidden"
              accept={KNOWLEDGE_ENGINE_CONFIG.supportedExtensions.map((extension) => `.${extension}`).join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const validationError = validateClientFile(file);
                if (validationError) {
                  setUploadMessage(validationError);
                  return;
                }
                void onUpload(file);
              }}
            />
          </label>
          {uploading ? <p className="mt-2 text-xs text-amber-300">Uploading and processing...</p> : null}
          {uploadMessage ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{uploadMessage}</p> : null}
        </div>

        {error ? <p className="mt-3 rounded-md border border-rose-700/40 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        {searchResults.length > 0 ? (
          <div className="mt-4 rounded-md border border-[var(--border)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Search Results</p>
              <p className="text-xs text-[var(--muted-foreground)]">{searchResults.length} lexical matches</p>
            </div>
            <div className="space-y-2">
              {searchResults.map((item) => (
                <button
                  key={item.chunkId}
                  onClick={() => setSelectedDocId(item.documentId)}
                  className="w-full rounded-md border border-[var(--border)] p-3 text-left hover:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.title || item.filename}</p>
                    <span className="text-xs text-[var(--muted-foreground)]">score {item.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.collectionName || "Uncategorized"} · {item.mimeType}</p>
                  <p className="mt-2 text-xs text-zinc-300">{item.snippet}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="py-2 pr-3">Filename</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Collection</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--muted-foreground)]">
                    Loading documents...
                  </td>
                </tr>
              ) : visibleDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--muted-foreground)]">
                    {selectedCollectionId ? "No documents match the selected collection." : "No documents yet. Upload a file to begin building the Knowledge Engine."}
                  </td>
                </tr>
              ) : (
                visibleDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`cursor-pointer border-b border-[var(--border)] hover:bg-zinc-900/60 ${selectedDocId === doc.id ? "bg-zinc-900/60" : ""}`}
                    onClick={() => setSelectedDocId(doc.id)}
                  >
                    <td className="py-2 pr-3">{doc.filename}</td>
                    <td className="py-2 pr-3">{doc.title || "-"}</td>
                    <td className="py-2 pr-3">{doc.collectionId ? collectionById.get(doc.collectionId)?.name || "Collection" : "Uncategorized"}</td>
                    <td className="py-2 pr-3">{doc.mimeType}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${statusPill(doc.status)}`}>{doc.status}</span>
                    </td>
                    <td className="py-2 pr-3">{new Date(doc.uploadedAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <aside className="surface-card p-4 xl:block">
        {!selectedDoc ? (
          <p className="text-sm text-[var(--muted-foreground)]">Select a document to inspect chunks, status, and citations.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <h3 className="text-base font-semibold">{selectedDoc.title || selectedDoc.filename}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">{selectedDoc.originalFilename}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Status</div>
              <div>{selectedDoc.status}</div>
              <div>Source</div>
              <div>{selectedDoc.source?.name || "Upload"}</div>
              <div>Collection</div>
              <div>{selectedDoc.collection?.name || "Uncategorized"}</div>
              <div>MIME</div>
              <div>{selectedDoc.mimeType}</div>
              <div>Size</div>
              <div>{prettyBytes(selectedDoc.sizeBytes)}</div>
              <div>Checksum</div>
              <div className="truncate">{selectedDoc.checksum.slice(0, 16)}...</div>
              <div>Chunks</div>
              <div>{selectedDoc.chunkCount}</div>
              <div>Citations</div>
              <div>{selectedDoc.citationCount}</div>
            </div>
            {selectedDoc.failureReason ? <p className="rounded border border-rose-700/40 bg-rose-900/20 px-2 py-1 text-xs text-rose-200">{selectedDoc.failureReason}</p> : null}

            <div className="flex gap-2">
              <button
                onClick={() => void retryDocument(selectedDoc.id)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
                disabled={selectedDoc.status !== "FAILED"}
              >
                Retry
              </button>
              <button onClick={() => void archiveDocument(selectedDoc.id)} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs">
                Archive
              </button>
            </div>

            <div>
              <p className="mb-1 text-xs uppercase text-[var(--muted-foreground)]">Chunk Preview</p>
              <div className="max-h-72 space-y-2 overflow-auto">
                {selectedDoc.chunks.slice(0, 8).map((chunk) => (
                  <div key={chunk.id} className="rounded-md border border-[var(--border)] p-2 text-xs">
                    <p className="font-semibold">
                      #{chunk.chunkIndex} {chunk.heading ? `- ${chunk.heading}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-4 text-[var(--muted-foreground)]">{chunk.text}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{chunk.stableKey}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}

import { KnowledgeHubClient } from "@/features/knowledge-engine/components/knowledge-hub-client";

export default function KnowledgeHubPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Knowledge Hub</h1>
        <p className="text-muted-foreground">Ingest, inspect, search, and maintain workspace knowledge for grounded assistant responses.</p>
      </header>
      <KnowledgeHubClient />
    </div>
  );
}

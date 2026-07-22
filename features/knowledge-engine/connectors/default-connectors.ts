import { ConnectorRegistry } from "@/features/knowledge-engine/connectors/registry";
import { UploadConnector, createPlaceholderConnector } from "@/features/knowledge-engine/connectors/upload-connector";

export function createDefaultConnectorRegistry() {
  const registry = new ConnectorRegistry();
  registry.register(new UploadConnector());
  registry.register(createPlaceholderConnector({ id: "website", name: "Website Connector", sourceType: "WEBSITE", configured: true }));
  registry.register(
    createPlaceholderConnector({ id: "google-drive", name: "Google Drive Connector", sourceType: "GOOGLE_DRIVE", configured: false })
  );
  registry.register(createPlaceholderConnector({ id: "dropbox", name: "Dropbox Connector", sourceType: "DROPBOX", configured: false }));
  registry.register(createPlaceholderConnector({ id: "onedrive", name: "OneDrive Connector", sourceType: "ONEDRIVE", configured: false }));
  registry.register(createPlaceholderConnector({ id: "notion", name: "Notion Connector", sourceType: "NOTION", configured: false }));
  registry.register(createPlaceholderConnector({ id: "github", name: "GitHub Connector", sourceType: "GITHUB", configured: false }));
  registry.register(createPlaceholderConnector({ id: "rss", name: "RSS Connector", sourceType: "RSS", configured: false }));
  return registry;
}

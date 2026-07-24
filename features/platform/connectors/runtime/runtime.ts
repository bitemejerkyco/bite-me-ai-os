import {
  InMemoryConnectorRepository,
  type ConnectorRepository,
} from "@/features/platform/connectors/repositories/repository";

export type ConnectorTelemetry = {
  retry(workspaceId: string, providerId: string, attempt: number, correlationId: string): void;
  failure(workspaceId: string, providerId: string, code: string, correlationId: string): void;
};

class NoopConnectorTelemetry implements ConnectorTelemetry {
  retry(
    workspaceId: string,
    providerId: string,
    attempt: number,
    correlationId: string,
  ): void {
    void workspaceId;
    void providerId;
    void attempt;
    void correlationId;
  }

  failure(
    workspaceId: string,
    providerId: string,
    code: string,
    correlationId: string,
  ): void {
    void workspaceId;
    void providerId;
    void code;
    void correlationId;
  }
}

const repository: ConnectorRepository = new InMemoryConnectorRepository();
const connectorTelemetry = new NoopConnectorTelemetry();

export const connectorRepository = repository;
export const telemetry = connectorTelemetry;
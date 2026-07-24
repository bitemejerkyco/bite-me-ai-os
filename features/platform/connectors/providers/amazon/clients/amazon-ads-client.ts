type Region = "na" | "eu" | "fe";

export type AmazonAdsClientOptions = {
  workspaceId: string;
  connectionId: string;
  correlationId: string;
  profileId: string;
  region: Region;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  telemetry?: {
    retry?(workspaceId: string, providerId: string, attempt: number, correlationId: string): void;
    failure?(workspaceId: string, providerId: string, code: string, correlationId: string): void;
  };
};

export type AmazonClientResponse<T> = {
  ok: boolean;
  status: number;
  data?: T;
  safeError?: { code: string; message: string };
  headers: Headers;
};

const ADS_HOSTS: Record<Region, string> = {
  na: "https://advertising-api.amazon.com",
  eu: "https://advertising-api-eu.amazon.com",
  fe: "https://advertising-api-fe.amazon.com",
};

const MUTATION_SHAPES = /(?:create|update|delete|archive|bid|budget|activate|pause|enable|disable|negative)/i;

export class AmazonAdsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly host: string;

  constructor(private readonly options: AmazonAdsClientOptions) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.host = ADS_HOSTS[options.region];
  }

  get<T>(path: string): Promise<AmazonClientResponse<T>> {
    return this.request<T>("GET", path);
  }

  requestReport(body: Record<string, unknown>): Promise<AmazonClientResponse<Record<string, unknown>>> {
    // Report creation is a read-path operation for asynchronous report exports.
    return this.request<Record<string, unknown>>("POST", "/reporting/reports", body);
  }

  pollReport(reportId: string): Promise<AmazonClientResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>("GET", `/reporting/reports/${encodeURIComponent(reportId)}`);
  }

  downloadReport(reportId: string): Promise<AmazonClientResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>("GET", `/reporting/reports/${encodeURIComponent(reportId)}/download`);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<AmazonClientResponse<T>> {
    this.assertReadOnlyShape(path);

    const url = new URL(path, this.host).toString();
    const headers = new Headers({
      "content-type": "application/json",
      "amazon-advertising-api-clientId": "sandbox",
      "amazon-advertising-api-scope": this.options.profileId,
      "x-correlation-id": this.options.correlationId,
    });

    const timeoutMs = this.options.timeoutMs ?? 15_000;
    const maxRetries = this.options.maxRetries ?? 2;
    let attempt = 0;
    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (response.ok) {
          const data = (await safeJson(response)) as T | undefined;
          return { ok: true, status: response.status, data, headers: response.headers };
        }

        const message = `Amazon Ads request failed (${response.status})`;
        if (attempt <= maxRetries && response.status >= 500) {
          this.options.telemetry?.retry?.(this.options.workspaceId, "amazon-ads", attempt, this.options.correlationId);
          continue;
        }
        this.options.telemetry?.failure?.(
          this.options.workspaceId,
          "amazon-ads",
          String(response.status),
          this.options.correlationId,
        );
        return {
          ok: false,
          status: response.status,
          safeError: { code: `HTTP_${response.status}`, message },
          headers: response.headers,
        };
      } catch (error) {
        clearTimeout(timer);
        const message = error instanceof Error ? error.message : "Unknown request failure.";
        if (attempt <= maxRetries) {
          this.options.telemetry?.retry?.(this.options.workspaceId, "amazon-ads", attempt, this.options.correlationId);
          continue;
        }
        this.options.telemetry?.failure?.(
          this.options.workspaceId,
          "amazon-ads",
          "REQUEST_ERROR",
          this.options.correlationId,
        );
        return {
          ok: false,
          status: 0,
          safeError: { code: "REQUEST_ERROR", message },
          headers: new Headers(),
        };
      }
    }
  }

  private assertReadOnlyShape(path: string): void {
    const loweredPath = path.toLowerCase();
    if (MUTATION_SHAPES.test(loweredPath)) {
      throw new Error("READ_ONLY_VIOLATION:Amazon Ads client rejected mutation-shaped request path.");
    }
  }
}

async function safeJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
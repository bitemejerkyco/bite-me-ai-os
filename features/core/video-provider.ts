import "server-only";

type VideoProviderStatus = "queued" | "in_progress" | "completed" | "failed";

export type SafeVideoProviderErrorCode =
  | "REPLICATE_NOT_CONFIGURED"
  | "REPLICATE_AUTH_FAILED"
  | "REPLICATE_BILLING_REQUIRED"
  | "REPLICATE_MODEL_NOT_FOUND"
  | "REPLICATE_RATE_LIMITED"
  | "REPLICATE_BAD_REQUEST"
  | "REPLICATE_START_FAILED"
  | "REPLICATE_STATUS_FAILED"
  | "REPLICATE_CANCEL_FAILED"
  | "VIDEO_PROVIDER_UNAVAILABLE";

type VideoProviderJob = {
  providerJobId: string;
  status: VideoProviderStatus;
  progress: number;
  outputUrl?: string | null;
  failureReason?: string | null;
  providerKey: string;
  model: string;
};

const OFFICIAL_REPLICATE_ECONOMY_MODEL = "wan-video/wan-2.2-t2v-fast";

export function mapProviderErrorCodeToMessage(code: SafeVideoProviderErrorCode): string {
  switch (code) {
    case "REPLICATE_NOT_CONFIGURED":
      return "Video generation is not configured. Add the Replicate API token in Vercel.";
    case "REPLICATE_AUTH_FAILED":
      return "The video provider rejected its credentials. Update the Replicate API token.";
    case "REPLICATE_BILLING_REQUIRED":
      return "Replicate billing must be enabled before generating videos.";
    case "REPLICATE_MODEL_NOT_FOUND":
      return "The configured Economy video model is unavailable.";
    case "REPLICATE_RATE_LIMITED":
      return "The video provider is busy. Please retry in a moment.";
    case "REPLICATE_BAD_REQUEST":
      return "The video provider could not start this render. Please retry.";
    case "REPLICATE_START_FAILED":
    case "REPLICATE_STATUS_FAILED":
    case "REPLICATE_CANCEL_FAILED":
    case "VIDEO_PROVIDER_UNAVAILABLE":
    default:
      return "The video provider could not start this render. Please retry.";
  }
}

function providerError(code: SafeVideoProviderErrorCode): never {
  throw new Error(code);
}

function normalizeReplicateStatus(value: unknown): VideoProviderStatus {
  const status = String(value || "").toLowerCase();
  if (status === "succeeded" || status === "completed") return "completed";
  if (status === "processing" || status === "starting" || status === "queued") return "in_progress";
  if (status === "failed" || status === "canceled" || status === "cancelled") return "failed";
  return "queued";
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.trim()) return output.trim();
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (item && typeof item === "object" && "url" in item) {
        const value = (item as { url?: unknown }).url;
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
  }
  if (output && typeof output === "object" && "url" in output) {
    const value = (output as { url?: unknown }).url;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function mapReplicateHttpError(status: number): SafeVideoProviderErrorCode {
  if (status === 401 || status === 403) return "REPLICATE_AUTH_FAILED";
  if (status === 402) return "REPLICATE_BILLING_REQUIRED";
  if (status === 404) return "REPLICATE_MODEL_NOT_FOUND";
  if (status === 408 || status === 429) return "REPLICATE_RATE_LIMITED";
  if (status >= 400 && status < 500) return "REPLICATE_BAD_REQUEST";
  return "REPLICATE_START_FAILED";
}

function extractPredictionId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const direct = String((payload as { id?: unknown }).id || "").trim();
  if (direct) return direct;
  const nested = (payload as { prediction?: { id?: unknown } }).prediction;
  return String(nested?.id || "").trim();
}

function normalizeReplicateModel(value: string): string {
  const normalized = value.trim();
  if (!normalized) return OFFICIAL_REPLICATE_ECONOMY_MODEL;
  if (normalized === "wan-2.2-fast") return OFFICIAL_REPLICATE_ECONOMY_MODEL;
  return normalized;
}

export async function startVideoProviderJob(input: {
  providerKey: string;
  model: string;
  prompt: string;
  seconds: number;
  sourceVideoId?: string | null;
}): Promise<VideoProviderJob> {
  const providerKey = input.providerKey.toUpperCase();
  if (providerKey === "REPLICATE") {
    const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
    const configuredModel = String(process.env.REPLICATE_WAN_22_FAST_MODEL || input.model || "").trim();
    const model = normalizeReplicateModel(configuredModel);
    if (!token || !model) providerError("REPLICATE_NOT_CONFIGURED");

    const safeDuration = Math.max(8, Math.min(15, Math.round(input.seconds)));

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          prompt: input.prompt,
          aspect_ratio: "9:16",
          resolution: "480p",
          duration: safeDuration,
          frames_per_second: 16,
        },
      }),
      cache: "no-store",
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) providerError(mapReplicateHttpError(response.status));

    const predictionId = extractPredictionId(payload);
    if (!predictionId) providerError("REPLICATE_START_FAILED");

    return {
      providerJobId: predictionId,
      status: normalizeReplicateStatus((payload as { status?: unknown }).status),
      progress: 15,
      providerKey: "REPLICATE",
      model,
    };
  }

  providerError("VIDEO_PROVIDER_UNAVAILABLE");
}

export async function fetchVideoProviderJob(input: {
  providerKey: string;
  model: string;
  providerJobId: string;
}): Promise<VideoProviderJob> {
  const providerKey = input.providerKey.toUpperCase();
  if (providerKey === "REPLICATE") {
    const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
    if (!token) providerError("REPLICATE_NOT_CONFIGURED");
    const response = await fetch(`https://api.replicate.com/v1/predictions/${input.providerJobId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || !payload || typeof payload !== "object") {
      providerError(response.ok ? "REPLICATE_STATUS_FAILED" : mapReplicateHttpError(response.status));
    }

    const status = normalizeReplicateStatus((payload as { status?: unknown }).status);
    const outputUrl = extractOutputUrl((payload as { output?: unknown }).output);
    const errorReason = String(
      (payload as { error?: unknown }).error && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error?: string }).error || ""
        : "",
    ).trim();

    return {
      providerJobId: input.providerJobId,
      status,
      progress: status === "completed" ? 100 : status === "failed" ? 0 : 55,
      outputUrl,
      failureReason: status === "failed" ? errorReason || "Video generation failed." : null,
      providerKey: "REPLICATE",
      model: input.model,
    };
  }

  providerError("VIDEO_PROVIDER_UNAVAILABLE");
}

export async function cancelVideoProviderJob(input: {
  providerKey: string;
  providerJobId: string;
}): Promise<void> {
  const providerKey = input.providerKey.toUpperCase();
  if (providerKey === "REPLICATE") {
    const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
    if (!token) return;
    await fetch(`https://api.replicate.com/v1/predictions/${input.providerJobId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }).catch(() => undefined);
    return;
  }

  providerError("REPLICATE_CANCEL_FAILED");
}

export function getVideoProviderUnavailableMessage(): string {
  return mapProviderErrorCodeToMessage("VIDEO_PROVIDER_UNAVAILABLE");
}
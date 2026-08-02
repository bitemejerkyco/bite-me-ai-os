import "server-only";

type VideoProviderStatus = "queued" | "in_progress" | "completed" | "failed";

type VideoProviderJob = {
  providerJobId: string;
  status: VideoProviderStatus;
  progress: number;
  outputUrl?: string | null;
  failureReason?: string | null;
  providerKey: string;
  model: string;
};

function sanitizeProviderError(message: string): string {
  if (!message.trim()) return "Video generation is temporarily unavailable.";
  return "Video generation is temporarily unavailable.";
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
    const model = String(process.env.REPLICATE_WAN_22_FAST_MODEL || input.model || "").trim();
    if (!token || !model) {
      throw new Error("Video generation is temporarily unavailable.");
    }

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
          duration: input.seconds,
          source_video_id: input.sourceVideoId || undefined,
        },
      }),
      cache: "no-store",
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || !payload || typeof payload !== "object") {
      console.error("[video-provider] replicate start failed", {
        status: response.status,
        payload,
      });
      throw new Error("Video generation is temporarily unavailable.");
    }

    const predictionId = String((payload as { id?: string }).id || "").trim();
    if (!predictionId) {
      console.error("[video-provider] replicate start missing prediction id", { payload });
      throw new Error("Video generation is temporarily unavailable.");
    }

    return {
      providerJobId: predictionId,
      status: normalizeReplicateStatus((payload as { status?: unknown }).status),
      progress: 0,
      providerKey: "REPLICATE",
      model,
    };
  }

  throw new Error("Video generation is temporarily unavailable.");
}

export async function fetchVideoProviderJob(input: {
  providerKey: string;
  model: string;
  providerJobId: string;
}): Promise<VideoProviderJob> {
  const providerKey = input.providerKey.toUpperCase();
  if (providerKey === "REPLICATE") {
    const token = String(process.env.REPLICATE_API_TOKEN || "").trim();
    if (!token) {
      throw new Error("Video generation is temporarily unavailable.");
    }
    const response = await fetch(`https://api.replicate.com/v1/predictions/${input.providerJobId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || !payload || typeof payload !== "object") {
      console.error("[video-provider] replicate status failed", {
        status: response.status,
        predictionId: input.providerJobId,
        payload,
      });
      throw new Error("Video generation is temporarily unavailable.");
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
      progress: status === "completed" ? 100 : status === "failed" ? 0 : 50,
      outputUrl,
      failureReason: status === "failed" ? errorReason || "Video generation failed." : null,
      providerKey: "REPLICATE",
      model: input.model,
    };
  }

  throw new Error("Video generation is temporarily unavailable.");
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

  throw new Error("Video generation is temporarily unavailable.");
}

export function getVideoProviderUnavailableMessage(): string {
  return sanitizeProviderError("");
}
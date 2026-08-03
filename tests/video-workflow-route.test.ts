import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const getServerEnvMock = vi.fn();
const loadVideoRouterSettingsMock = vi.fn();
const resolveVideoRouterProfileMock = vi.fn();
const startVideoProviderJobMock = vi.fn();
const fetchVideoProviderJobMock = vi.fn();
const composeVideoWithExactProductMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: getServerEnvMock,
}));

vi.mock("@/features/core/video-router-settings", () => ({
  loadVideoRouterSettings: loadVideoRouterSettingsMock,
}));

vi.mock("@/features/core/video-router", () => ({
  resolveVideoRouterProfile: resolveVideoRouterProfileMock,
}));

vi.mock("@/features/core/video-provider", () => ({
  startVideoProviderJob: startVideoProviderJobMock,
  fetchVideoProviderJob: fetchVideoProviderJobMock,
  getVideoProviderUnavailableMessage: () => "Video generation is temporarily unavailable.",
  mapProviderErrorCodeToMessage: (code: string) => {
    const messages: Record<string, string> = {
      REPLICATE_NOT_CONFIGURED: "Video generation is not configured. Add the Replicate API token in Vercel.",
      REPLICATE_AUTH_FAILED: "The video provider rejected its credentials. Update the Replicate API token.",
      REPLICATE_BILLING_REQUIRED: "Replicate billing must be enabled before generating videos.",
      REPLICATE_MODEL_NOT_FOUND: "The configured Economy video model is unavailable.",
      REPLICATE_RATE_LIMITED: "The video provider is busy. Please retry in a moment.",
      REPLICATE_BAD_REQUEST: "The video provider could not start this render. Please retry.",
      REPLICATE_START_FAILED: "The video provider could not start this render. Please retry.",
      REPLICATE_STATUS_FAILED: "The video provider could not start this render. Please retry.",
      REPLICATE_CANCEL_FAILED: "The video provider could not start this render. Please retry.",
      VIDEO_PROVIDER_UNAVAILABLE: "The video provider could not start this render. Please retry.",
    };
    return messages[code] || messages.VIDEO_PROVIDER_UNAVAILABLE;
  },
}));

vi.mock("@/features/core/video-compositor", () => ({
  composeVideoWithExactProduct: composeVideoWithExactProductMock,
}));

type ProjectRow = {
  id: string;
  workspace_id: string;
  content_draft_id: string | null;
  workflow_key: string | null;
  credit_request_id: string | null;
  title: string;
  channel: string;
  objective: string;
  prompt: string;
  script: string;
  caption: string;
  hashtags: string[];
  call_to_action: string;
  scenes: unknown[];
  duration_seconds: number;
  voice: string;
  music_mode: string;
  provider: string;
  routing_tier: string | null;
  provider_model: string | null;
  provider_job_id: string | null;
  provider_job_status: "queued" | "in_progress" | "completed" | "failed" | null;
  provider_progress: number | null;
  status: string;
  failure_reason: string | null;
  failure_reference_id: string | null;
  workflow_stage: string | null;
  workflow_percentage: number | null;
  credit_status: "NONE" | "RESERVED" | "REFUNDED" | null;
  credit_refunded_at: string | null;
  media_asset_id: string | null;
  video_storage_path: string | null;
  workflow_started_at: string | null;
  workflow_completed_at: string | null;
  updated_at: string;
};

type DraftRow = {
  id: string;
  video_project_id: string;
  media_storage_path: string | null;
};

type MediaRow = {
  id: string;
  workspace_id: string;
  generation_job_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown> | null;
};

function createHarness() {
  const projects = new Map<string, ProjectRow>();
  const drafts = new Map<string, DraftRow>();
  const media = new Map<string, MediaRow>();
  const reserveCalls: Array<{ seconds: number; requestId: string }> = [];
  const refundCalls: string[] = [];
  let mediaInsertCount = 0;
  let draftInsertCount = 0;
  let uploadCount = 0;

  const supabase = {
    auth: {
      getClaims: vi.fn(async () => ({ data: { claims: { sub: "user-1" } } })),
    },
    rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => {
      if (name === "my_primary_workspace_id") {
        return { data: "workspace-1", error: null };
      }
      if (name === "reserve_my_video_credits") {
        reserveCalls.push({
          seconds: Number(args?.video_seconds || 0),
          requestId: String(args?.credit_request_id || ""),
        });
        return { data: [{ charged_credits: 12 }], error: null };
      }
      if (name === "refund_my_video_credits") {
        const requestId = String(args?.credit_request_id || "");
        if (!refundCalls.includes(requestId)) refundCalls.push(requestId);
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => {
          uploadCount += 1;
          return { error: null };
        }),
        createSignedUrl: vi.fn(async (path: string) => ({
          data: { signedUrl: `https://signed.example/${encodeURIComponent(path)}` },
          error: null,
        })),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "video_projects") {
        return {
          select: vi.fn(() => {
            const filters: Record<string, string> = {};
            return {
              eq: vi.fn((fieldA: string, valueA: string) => {
                filters[fieldA] = valueA;
                return {
                  eq: vi.fn((fieldB: string, valueB: string) => {
                    filters[fieldB] = valueB;
                    return {
                      maybeSingle: vi.fn(async () => {
                        if (filters.id) {
                          const row = projects.get(filters.id) || null;
                          return { data: row, error: null };
                        }
                        if (filters.workspace_id && filters.workflow_key) {
                          const row = [...projects.values()].find(
                            (item) =>
                              item.workspace_id === filters.workspace_id
                              && item.workflow_key === filters.workflow_key,
                          ) || null;
                          return { data: row, error: null };
                        }
                        return { data: null, error: null };
                      }),
                    };
                  }),
                  maybeSingle: vi.fn(async () => {
                    if (filters.workspace_id && filters.workflow_key) {
                      const row = [...projects.values()].find(
                        (item) =>
                          item.workspace_id === filters.workspace_id
                          && item.workflow_key === filters.workflow_key,
                      ) || null;
                      return { data: row, error: null };
                    }
                    if (filters.id) {
                      return { data: projects.get(filters.id) || null, error: null };
                    }
                    return { data: null, error: null };
                  }),
                };
              }),
            };
          }),
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            const row: ProjectRow = {
              id: String(payload.id),
              workspace_id: String(payload.workspace_id),
              content_draft_id: payload.content_draft_id ? String(payload.content_draft_id) : null,
              workflow_key: payload.workflow_key ? String(payload.workflow_key) : null,
              credit_request_id: payload.credit_request_id ? String(payload.credit_request_id) : null,
              title: String(payload.title || ""),
              channel: String(payload.channel || "TikTok"),
              objective: String(payload.objective || ""),
              prompt: String(payload.prompt || ""),
              script: String(payload.script || ""),
              caption: String(payload.caption || ""),
              hashtags: Array.isArray(payload.hashtags) ? payload.hashtags.map(String) : [],
              call_to_action: String(payload.call_to_action || ""),
              scenes: Array.isArray(payload.scenes) ? payload.scenes : [],
              duration_seconds: Number(payload.duration_seconds || 12),
              voice: String(payload.voice || "marin"),
              music_mode: String(payload.music_mode || "NONE"),
              provider: String(payload.provider || "REPLICATE"),
              routing_tier: payload.routing_tier ? String(payload.routing_tier) : null,
              provider_model: payload.provider_model ? String(payload.provider_model) : null,
              provider_job_id: payload.provider_job_id ? String(payload.provider_job_id) : null,
              provider_job_status: (payload.provider_job_status as ProjectRow["provider_job_status"]) || null,
              provider_progress: Number(payload.provider_progress || 0),
              status: String(payload.status || "GENERATING"),
              failure_reason: payload.failure_reason ? String(payload.failure_reason) : null,
              failure_reference_id: payload.failure_reference_id ? String(payload.failure_reference_id) : null,
              workflow_stage: payload.workflow_stage ? String(payload.workflow_stage) : null,
              workflow_percentage: Number(payload.workflow_percentage || 0),
              credit_status: (payload.credit_status as ProjectRow["credit_status"]) || "NONE",
              credit_refunded_at: payload.credit_refunded_at ? String(payload.credit_refunded_at) : null,
              media_asset_id: payload.media_asset_id ? String(payload.media_asset_id) : null,
              video_storage_path: payload.video_storage_path ? String(payload.video_storage_path) : null,
              workflow_started_at: payload.workflow_started_at ? String(payload.workflow_started_at) : null,
              workflow_completed_at: payload.workflow_completed_at ? String(payload.workflow_completed_at) : null,
              updated_at: new Date().toISOString(),
            };
            projects.set(row.id, row);
            return { error: null };
          }),
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            const current = projects.get(String(payload.id));
            const merged: ProjectRow = {
              ...(current || {
                id: String(payload.id),
                workspace_id: String(payload.workspace_id),
                content_draft_id: null,
                workflow_key: null,
                credit_request_id: null,
                title: "",
                channel: "TikTok",
                objective: "",
                prompt: "",
                script: "",
                caption: "",
                hashtags: [],
                call_to_action: "",
                scenes: [],
                duration_seconds: 12,
                voice: "marin",
                music_mode: "NONE",
                provider: "REPLICATE",
                routing_tier: null,
                provider_model: null,
                provider_job_id: null,
                provider_job_status: null,
                provider_progress: 0,
                status: "GENERATING",
                failure_reason: null,
                failure_reference_id: null,
                workflow_stage: null,
                workflow_percentage: 0,
                credit_status: "NONE",
                credit_refunded_at: null,
                media_asset_id: null,
                video_storage_path: null,
                workflow_started_at: null,
                workflow_completed_at: null,
                updated_at: new Date().toISOString(),
              }),
              ...current,
              id: String(payload.id),
              workspace_id: String(payload.workspace_id),
              content_draft_id: payload.content_draft_id === undefined
                ? current?.content_draft_id || null
                : payload.content_draft_id
                  ? String(payload.content_draft_id)
                  : null,
              workflow_key: payload.workflow_key ? String(payload.workflow_key) : current?.workflow_key || null,
              credit_request_id: payload.credit_request_id
                ? String(payload.credit_request_id)
                : current?.credit_request_id || null,
              title: String(payload.title || current?.title || ""),
              channel: String(payload.channel || current?.channel || "TikTok"),
              objective: String(payload.objective || current?.objective || ""),
              prompt: String(payload.prompt || current?.prompt || ""),
              script: String(payload.script || current?.script || ""),
              caption: String(payload.caption || current?.caption || ""),
              hashtags: Array.isArray(payload.hashtags) ? payload.hashtags.map(String) : current?.hashtags || [],
              call_to_action: String(payload.call_to_action || current?.call_to_action || ""),
              scenes: Array.isArray(payload.scenes) ? payload.scenes : current?.scenes || [],
              duration_seconds: Number(payload.duration_seconds || current?.duration_seconds || 12),
              voice: String(payload.voice || current?.voice || "marin"),
              music_mode: String(payload.music_mode || current?.music_mode || "NONE"),
              provider: String(payload.provider || current?.provider || "REPLICATE"),
              routing_tier: payload.routing_tier ? String(payload.routing_tier) : current?.routing_tier || null,
              provider_model: payload.provider_model ? String(payload.provider_model) : current?.provider_model || null,
              provider_job_id: payload.provider_job_id ? String(payload.provider_job_id) : current?.provider_job_id || null,
              provider_job_status: (payload.provider_job_status as ProjectRow["provider_job_status"]) || current?.provider_job_status || null,
              provider_progress: Number(payload.provider_progress ?? current?.provider_progress ?? 0),
              status: String(payload.status || current?.status || "GENERATING"),
              failure_reason: payload.failure_reason === undefined
                ? current?.failure_reason || null
                : payload.failure_reason
                  ? String(payload.failure_reason)
                  : null,
              failure_reference_id: payload.failure_reference_id === undefined
                ? current?.failure_reference_id || null
                : payload.failure_reference_id
                  ? String(payload.failure_reference_id)
                  : null,
              workflow_stage: payload.workflow_stage
                ? String(payload.workflow_stage)
                : current?.workflow_stage || null,
              workflow_percentage: Number(payload.workflow_percentage ?? current?.workflow_percentage ?? 0),
              credit_status: (payload.credit_status as ProjectRow["credit_status"]) || current?.credit_status || "NONE",
              credit_refunded_at: payload.credit_refunded_at === undefined
                ? current?.credit_refunded_at || null
                : payload.credit_refunded_at
                  ? String(payload.credit_refunded_at)
                  : null,
              media_asset_id: payload.media_asset_id === undefined
                ? current?.media_asset_id || null
                : payload.media_asset_id
                  ? String(payload.media_asset_id)
                  : null,
              video_storage_path: payload.video_storage_path === undefined
                ? current?.video_storage_path || null
                : payload.video_storage_path
                  ? String(payload.video_storage_path)
                  : null,
              workflow_started_at: payload.workflow_started_at
                ? String(payload.workflow_started_at)
                : current?.workflow_started_at || null,
              workflow_completed_at: payload.workflow_completed_at === undefined
                ? current?.workflow_completed_at || null
                : payload.workflow_completed_at
                  ? String(payload.workflow_completed_at)
                  : null,
              updated_at: new Date().toISOString(),
            };
            projects.set(merged.id, merged);
            return { error: null };
          }),
          update: vi.fn((updates: Record<string, unknown>) => ({
            eq: vi.fn(async (_field: string, value: string) => {
              const current = projects.get(value);
              if (!current) return { error: null };
              projects.set(value, {
                ...current,
                ...Object.fromEntries(
                  Object.entries(updates).map(([key, raw]) => [
                    key,
                    raw,
                  ]),
                ),
                content_draft_id:
                  updates.content_draft_id === undefined
                    ? current.content_draft_id
                    : updates.content_draft_id
                      ? String(updates.content_draft_id)
                      : null,
                provider_progress:
                  updates.provider_progress === undefined
                    ? current.provider_progress
                    : Number(updates.provider_progress),
                workflow_percentage:
                  updates.workflow_percentage === undefined
                    ? current.workflow_percentage
                    : Number(updates.workflow_percentage),
                media_asset_id:
                  updates.media_asset_id === undefined
                    ? current.media_asset_id
                    : updates.media_asset_id
                      ? String(updates.media_asset_id)
                      : null,
                video_storage_path:
                  updates.video_storage_path === undefined
                    ? current.video_storage_path
                    : updates.video_storage_path
                      ? String(updates.video_storage_path)
                      : null,
                updated_at: new Date().toISOString(),
              });
              return { error: null };
            }),
          })),
        };
      }

      if (table === "content_drafts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                const row = [...drafts.values()][0] || null;
                return { data: row ? { id: row.id } : null, error: null };
              }),
            })),
          })),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const id = `draft-${draftInsertCount + 1}`;
                draftInsertCount += 1;
                drafts.set(id, {
                  id,
                  video_project_id: String(payload.video_project_id || ""),
                  media_storage_path: payload.media_storage_path ? String(payload.media_storage_path) : null,
                });
                return { data: { id }, error: null };
              }),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(async (field: string, value: string) => {
              if (field !== "id") return { error: null };
              const current = drafts.get(value);
              if (!current) return { error: null };
              drafts.set(value, {
                ...current,
                media_storage_path: payload.media_storage_path ? String(payload.media_storage_path) : current.media_storage_path,
              });
              return { error: null };
            }),
          })),
        };
      }

      if (table === "media_assets") {
        return {
          select: vi.fn(() => {
            const filters: Record<string, string> = {};
            return {
              eq: vi.fn((fieldA: string, valueA: string) => {
                filters[fieldA] = valueA;
                return {
                  eq: vi.fn((fieldB: string, valueB: string) => {
                    filters[fieldB] = valueB;
                    return {
                      maybeSingle: vi.fn(async () => {
                        if (filters.workspace_id && filters.id) {
                          const byId = [...media.values()].find(
                            (item) =>
                              item.workspace_id === filters.workspace_id
                              && item.id === filters.id,
                          ) || null;
                          return {
                            data: byId
                              ? {
                                  id: byId.id,
                                  storage_path: byId.storage_path,
                                  metadata: byId.metadata,
                                  file_name: byId.file_name,
                                  mime_type: byId.mime_type,
                                  size_bytes: byId.size_bytes,
                                }
                              : null,
                            error: null,
                          };
                        }
                        const row = [...media.values()].find(
                          (item) =>
                            item.workspace_id === filters.workspace_id
                            && item.generation_job_id === filters.generation_job_id,
                        ) || null;
                        return {
                          data: row
                            ? {
                                id: row.id,
                                storage_path: row.storage_path,
                                metadata: row.metadata,
                                file_name: row.file_name,
                                mime_type: row.mime_type,
                                size_bytes: row.size_bytes,
                              }
                            : null,
                          error: null,
                        };
                      }),
                    };
                  }),
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                };
              }),
            };
          }),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                const existing = [...media.values()].find(
                  (item) =>
                    item.workspace_id === String(payload.workspace_id)
                    && item.generation_job_id === String(payload.generation_job_id || ""),
                );
                if (existing) {
                  return { data: { id: existing.id, storage_path: existing.storage_path }, error: null };
                }
                mediaInsertCount += 1;
                const id = `media-${mediaInsertCount}`;
                const row: MediaRow = {
                  id,
                  workspace_id: String(payload.workspace_id),
                  generation_job_id: payload.generation_job_id ? String(payload.generation_job_id) : null,
                  storage_path: String(payload.storage_path),
                  file_name: String(payload.file_name || "video.mp4"),
                  mime_type: payload.mime_type ? String(payload.mime_type) : null,
                  size_bytes: payload.size_bytes ? Number(payload.size_bytes) : null,
                  metadata:
                    payload.metadata && typeof payload.metadata === "object"
                      ? (payload.metadata as Record<string, unknown>)
                      : null,
                };
                media.set(id, row);
                return { data: { id: row.id, storage_path: row.storage_path }, error: null };
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    projects,
    reserveCalls,
    refundCalls,
    drafts,
    media,
    get mediaInsertCount() {
      return mediaInsertCount;
    },
    get draftInsertCount() {
      return draftInsertCount;
    },
    get uploadCount() {
      return uploadCount;
    },
  };
}

describe("video workflow route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getServerEnvMock.mockReturnValue({
      openAiApiKey: "test-key",
      openAiModel: "gpt-5.6-sol",
    });

    loadVideoRouterSettingsMock.mockResolvedValue({
      mode: "AUTO",
      defaultTier: "ECONOMY",
      economyModel: "wan-video/wan-2.2-t2v-fast",
      balancedModel: "sora-2-pro",
      premiumModel: "sora-2-pro",
      economyCostCentsPerSecond: 45,
      balancedCostCentsPerSecond: 70,
      premiumCostCentsPerSecond: 110,
      maxRetries: 2,
      emergencyDisabled: false,
    });

    resolveVideoRouterProfileMock.mockReturnValue({
      tier: "ECONOMY",
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      estimatedCostCentsPerSecond: 45,
      maxRetries: 2,
    });

    startVideoProviderJobMock.mockResolvedValue({
      providerJobId: "prediction-1",
      status: "queued",
      progress: 0,
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
    });

    fetchVideoProviderJobMock.mockResolvedValue({
      providerJobId: "prediction-1",
      status: "in_progress",
      progress: 50,
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      outputUrl: null,
      failureReason: null,
    });

    composeVideoWithExactProductMock.mockImplementation(async ({ providerOutputUrl }: { providerOutputUrl: string }) => ({
      videoBytes: new TextEncoder().encode("composited-video-bytes"),
      manifest: {
        mode: "NONE",
        providerOutputUrl,
        compositor: "passthrough",
        composed: false,
        layers: [],
      },
    }));
  });

  it("falls back to deterministic plan when OpenAI plan response cannot be parsed", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "x-request-id": "req_123" }),
        json: async () => ({
          output: [{ content: [{ type: "tool_call", text: { ignored: true } }] }],
        }),
      })) as unknown as typeof fetch,
    );

    const { POST } = await import("@/app/api/ai/video-workflow/route");

    const response = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "TikTok",
          objective: "Engagement",
          message: "Show product",
          callToAction: "Shop now",
          durationSeconds: 12,
          voice: "marin",
          musicMode: "NONE",
        }),
      }),
    );

    const payload = (await response.json()) as { ok?: boolean; stage?: string; progress?: number };
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.stage).toBe("GENERATING_SCENES");
    expect((payload.progress || 0) < 100).toBe(true);
    expect(startVideoProviderJobMock).toHaveBeenCalledTimes(1);
  });

  it("starts workflow on replicate economy slug and reserves credits once", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    loadVideoRouterSettingsMock.mockResolvedValueOnce({
      mode: "BALANCED",
      defaultTier: "BALANCED",
      economyModel: "wan-video/wan-2.2-t2v-fast",
      balancedModel: "sora-2-pro",
      premiumModel: "sora-2-pro",
      economyCostCentsPerSecond: 45,
      balancedCostCentsPerSecond: 70,
      premiumCostCentsPerSecond: 110,
      maxRetries: 2,
      emergencyDisabled: false,
    });

    getServerEnvMock.mockReturnValueOnce({
      openAiApiKey: "",
      openAiModel: "gpt-5.6-sol",
    });

    const { POST } = await import("@/app/api/ai/video-workflow/route");

    const reqBody = {
      channel: "TikTok",
      objective: "Engagement",
      message: "Show product",
      callToAction: "Shop now",
      durationSeconds: 12,
      voice: "marin",
      musicMode: "NONE",
      workflowKey: "wf-1",
    };

    const first = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
      }),
    );

    const payload = (await first.json()) as { ok?: boolean; workflowKey?: string; stage?: string; progress?: number };
    expect(first.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.workflowKey).toBe("wf-1");
    expect(payload.stage).toBe("GENERATING_SCENES");
    expect((payload.progress || 0) < 100).toBe(true);
    expect(harness.reserveCalls).toHaveLength(1);
    expect(resolveVideoRouterProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestedTier: "ECONOMY" }),
    );
    expect(startVideoProviderJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "wan-video/wan-2.2-t2v-fast" }),
    );

    const second = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...reqBody, retry: true }),
      }),
    );

    expect(second.status).toBe(200);
    expect(harness.reserveCalls).toHaveLength(1);
    expect(startVideoProviderJobMock).toHaveBeenCalledTimes(1);
  });

  it("blocks product-focused generation when selected product image is not approved", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    harness.media.set("product-1", {
      id: "product-1",
      workspace_id: "workspace-1",
      generation_job_id: null,
      storage_path: "workspace-1/user-1/product.png",
      file_name: "product.png",
      mime_type: "image/png",
      size_bytes: 1024,
      metadata: {
        productAsset: {
          productId: "sku-1",
          approvedForGeneration: false,
          locked: true,
        },
      },
    });

    const { POST } = await import("@/app/api/ai/video-workflow/route");

    const response = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "TikTok",
          objective: "Engagement",
          message: "Feature the product",
          callToAction: "Shop now",
          durationSeconds: 12,
          voice: "marin",
          musicMode: "NONE",
          workflowKey: "wf-product-gate",
          productAsset: {
            id: "product-1",
            name: "product.png",
            storagePath: "workspace-1/user-1/product.png",
            productMetadata: { approvedForGeneration: false },
          },
          exactProductMode: true,
        }),
      }),
    );

    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(payload.error).toContain("approved product image");
  });

  it("propagates selected product asset into scenes and keeps the same asset on retry", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    harness.media.set("product-2", {
      id: "product-2",
      workspace_id: "workspace-1",
      generation_job_id: null,
      storage_path: "workspace-1/user-1/product-2.png",
      file_name: "product-2.png",
      mime_type: "image/png",
      size_bytes: 2048,
      metadata: {
        productAsset: {
          productId: "sku-2",
          approvedForGeneration: true,
          locked: true,
          assetRole: "PRIMARY",
          isPrimaryProductImage: true,
          transparentBackground: true,
          originalAssetId: "product-2",
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          output: [
            {
              content: [
                {
                  type: "text",
                  text: {
                    value: JSON.stringify({
                      title: "Trail snack",
                      script: "Script",
                      caption: "Caption",
                      renderPrompt: "Prompt",
                      complianceNote: "Review",
                      hashtags: ["#trail"],
                      callToAction: "Shop now",
                      scenes: [
                        {
                          order: 1,
                          seconds: 12,
                          visual: "Visual",
                          narration: "Narration",
                          onScreenText: "Text",
                        },
                      ],
                    }),
                  },
                },
              ],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    );

    const { POST } = await import("@/app/api/ai/video-workflow/route");
    const requestBody = {
      channel: "TikTok",
      objective: "Engagement",
      message: "Feature the product",
      callToAction: "Shop now",
      durationSeconds: 12,
      voice: "marin",
      musicMode: "NONE",
      workflowKey: "wf-product-scenes",
      productAsset: {
        id: "product-2",
        name: "product-2.png",
        storagePath: "workspace-1/user-1/product-2.png",
      },
      exactProductMode: true,
    };

    const first = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    expect(first.status).toBe(200);
    const project = [...harness.projects.values()].find((item) => item.workflow_key === "wf-product-scenes");
    expect(project).toBeTruthy();
    const scenes = Array.isArray(project?.scenes) ? project?.scenes as Array<Record<string, unknown>> : [];
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((scene) => scene.productAssetId === "product-2")).toBe(true);

    const second = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...requestBody, retry: true }),
      }),
    );
    expect(second.status).toBe(200);
    const projectAfterRetry = [...harness.projects.values()].find((item) => item.workflow_key === "wf-product-scenes");
    const retryScenes = Array.isArray(projectAfterRetry?.scenes)
      ? projectAfterRetry?.scenes as Array<Record<string, unknown>>
      : [];
    expect(retryScenes.every((scene) => scene.productAssetId === "product-2")).toBe(true);
  });

  it("refunds and persists a failed state when provider startup fails", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    harness.projects.set("project-start-fail", {
      id: "project-start-fail",
      workspace_id: "workspace-1",
      content_draft_id: null,
      workflow_key: "wf-start-fail",
      credit_request_id: "credit-start-fail",
      title: "Project",
      channel: "TikTok",
      objective: "Engagement",
      prompt: "Prompt",
      script: "Script",
      caption: "Caption",
      hashtags: [],
      call_to_action: "Shop now",
      scenes: [],
      duration_seconds: 12,
      voice: "marin",
      music_mode: "NONE",
      provider: "REPLICATE",
      routing_tier: "ECONOMY",
      provider_model: null,
      provider_job_id: null,
      provider_job_status: null,
      provider_progress: 0,
      status: "DRAFT",
      failure_reason: null,
      failure_reference_id: null,
      workflow_stage: null,
      workflow_percentage: 0,
      credit_status: "RESERVED",
      credit_refunded_at: null,
      media_asset_id: null,
      video_storage_path: null,
      workflow_started_at: new Date().toISOString(),
      workflow_completed_at: null,
      updated_at: new Date().toISOString(),
    });

    startVideoProviderJobMock.mockRejectedValueOnce(new Error("REPLICATE_RATE_LIMITED"));

    const { POST } = await import("@/app/api/ai/video-workflow/route");

    const response = await POST(
      new Request("https://postmotive.example/api/ai/video-workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "TikTok",
          objective: "Engagement",
          message: "Show product",
          callToAction: "Shop now",
          durationSeconds: 12,
          voice: "marin",
          musicMode: "NONE",
          workflowKey: "wf-start-fail",
          projectId: "project-start-fail",
        }),
      }),
    );

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      errorCode?: string;
      failureReferenceId?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("REPLICATE_RATE_LIMITED");
    expect(payload.error).toBe("The video provider is busy. Please retry in a moment.");
    expect(payload.failureReferenceId).toBeTruthy();
    expect(harness.refundCalls).toEqual(["credit-start-fail"]);

    const stored = harness.projects.get("project-start-fail");
    expect(stored?.status).toBe("FAILED");
    expect(stored?.workflow_stage).toBe("FAILED");
    expect(stored?.provider_job_status).toBe("failed");
    expect(stored?.credit_status).toBe("REFUNDED");
    expect(stored?.failure_reason).toBe("REPLICATE_RATE_LIMITED");
    expect(stored?.failure_reference_id).toBeTruthy();
  });

  it("caps in-progress status below 90 and finalizes completed output once", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    const projectId = "project-1";
    harness.projects.set(projectId, {
      id: projectId,
      workspace_id: "workspace-1",
      content_draft_id: null,
      workflow_key: "wf-2",
      credit_request_id: "credit-1",
      title: "Project",
      channel: "TikTok",
      objective: "Engagement",
      prompt: "Prompt",
      script: "Script",
      caption: "Caption",
      hashtags: ["#trail"],
      call_to_action: "Shop now",
      scenes: [
        {
          order: 1,
          seconds: 12,
          visual: "Keep product centered",
          narration: "Narration",
          onScreenText: "Text",
          productAssetId: "product-3",
          productMode: "EXACT_PRODUCT",
          productPlacement: "center frame",
          productScale: "0.35",
          productOpacity: 1,
          productShadow: true,
          productEntrance: "FADE_IN",
          productExit: "FADE_OUT",
          productZoom: "NONE",
        },
      ],
      duration_seconds: 12,
      voice: "marin",
      music_mode: "NONE",
      provider: "REPLICATE",
      routing_tier: "ECONOMY",
      provider_model: "wan-video/wan-2.2-t2v-fast",
      provider_job_id: "prediction-1",
      provider_job_status: "in_progress",
      provider_progress: 30,
      status: "GENERATING",
      failure_reason: null,
      failure_reference_id: null,
      workflow_stage: "GENERATING_SCENES",
      workflow_percentage: 45,
      credit_status: "RESERVED",
      credit_refunded_at: null,
      media_asset_id: null,
      video_storage_path: null,
      workflow_started_at: new Date().toISOString(),
      workflow_completed_at: null,
      updated_at: new Date().toISOString(),
    });

    harness.media.set("product-3", {
      id: "product-3",
      workspace_id: "workspace-1",
      generation_job_id: null,
      storage_path: "workspace-1/user-1/product-3.png",
      file_name: "product-3.png",
      mime_type: "image/png",
      size_bytes: 3072,
      metadata: {
        productAsset: {
          productId: "sku-3",
          assetRole: "PRIMARY",
          isPrimaryProductImage: true,
          approvedForGeneration: true,
          locked: true,
          transparentBackground: true,
          originalAssetId: "product-3",
        },
      },
    });

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("video-bytes").buffer,
    })) as unknown as typeof fetch);

    composeVideoWithExactProductMock.mockResolvedValueOnce({
      videoBytes: new TextEncoder().encode("final-video"),
      manifest: {
        mode: "EXACT_PRODUCT",
        providerOutputUrl: "https://provider-output.example/video.mp4",
        compositor: "ffmpeg",
        composed: true,
        layers: [
          {
            type: "product",
            assetId: "product-3",
            assetUrl: "https://signed.example/workspace-1%2Fuser-1%2Fproduct-3.png",
            originalAssetId: "product-3",
            locked: true,
            approvedForGeneration: true,
            transparentBackground: true,
            scenes: [
              {
                order: 1,
                startSeconds: 0,
                endSeconds: 12,
                position: "center frame",
                scale: "0.35",
                opacity: 1,
                shadow: true,
                entrance: "FADE_IN",
                exit: "FADE_OUT",
                zoom: "NONE",
              },
            ],
          },
        ],
      },
    });

    const { GET } = await import("@/app/api/ai/video-workflow/route");

    fetchVideoProviderJobMock.mockResolvedValueOnce({
      providerJobId: "prediction-1",
      status: "in_progress",
      progress: 80,
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      outputUrl: null,
      failureReason: null,
    });

    const inProgress = await GET(
      new Request("https://postmotive.example/api/ai/video-workflow?projectId=project-1"),
    );
    const inPayload = (await inProgress.json()) as { progress: number; status: string };
    expect(inProgress.status).toBe(200);
    expect(inPayload.status).toBe("in_progress");
    expect(inPayload.progress).toBeLessThan(90);

    fetchVideoProviderJobMock.mockResolvedValueOnce({
      providerJobId: "prediction-1",
      status: "completed",
      progress: 100,
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      outputUrl: "https://provider-output.example/video.mp4",
      failureReason: null,
    });

    const done = await GET(
      new Request("https://postmotive.example/api/ai/video-workflow?projectId=project-1"),
    );
    const donePayload = (await done.json()) as { status: string; progress: number; draftId?: string; mediaAssetId?: string; videoStoragePath?: string };
    expect(done.status).toBe(200);
    expect(donePayload.status).toBe("completed");
    expect(donePayload.progress).toBe(100);
    expect(donePayload.mediaAssetId).toBeTruthy();
    expect(donePayload.draftId).toBeTruthy();
    expect(donePayload.videoStoragePath).toContain("workspace-1/");
    expect(donePayload.videoStoragePath?.endsWith(".mp4")).toBe(true);
    expect(harness.mediaInsertCount).toBe(1);
    expect(harness.draftInsertCount).toBe(1);
    expect(harness.uploadCount).toBe(1);
    expect(composeVideoWithExactProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutputUrl: "https://provider-output.example/video.mp4",
        productLayer: expect.objectContaining({
          assetId: "product-3",
          assetUrl: "https://signed.example/workspace-1%2Fuser-1%2Fproduct-3.png",
        }),
      }),
    );

    const createdMedia = [...harness.media.values()].find((item) => item.generation_job_id === "prediction-1");
    expect(createdMedia?.metadata).toBeTruthy();
    expect(createdMedia?.storage_path).toBe(donePayload.videoStoragePath);
    expect((createdMedia?.metadata as { compositionManifest?: { mode?: string; layers?: Array<{ assetId?: string }> } }).compositionManifest?.mode).toBe("EXACT_PRODUCT");
    expect((createdMedia?.metadata as { compositionManifest?: { layers?: Array<{ assetId?: string }> } }).compositionManifest?.layers?.[0]?.assetId).toBe("product-3");
    expect(harness.media.get("product-3")?.storage_path).toBe("workspace-1/user-1/product-3.png");

    const storedProject = harness.projects.get(projectId);
    expect(storedProject?.video_storage_path).toBe(createdMedia?.storage_path || null);

    const doneAgain = await GET(
      new Request("https://postmotive.example/api/ai/video-workflow?projectId=project-1"),
    );
    const doneAgainPayload = (await doneAgain.json()) as { status: string };
    expect(doneAgainPayload.status).toBe("completed");
    expect(harness.mediaInsertCount).toBe(1);
    expect(harness.draftInsertCount).toBe(1);
    expect(harness.uploadCount).toBe(1);
  });

  it("returns sanitized failure and refunds once", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    harness.projects.set("project-fail", {
      id: "project-fail",
      workspace_id: "workspace-1",
      content_draft_id: null,
      workflow_key: "wf-fail",
      credit_request_id: "credit-fail",
      title: "Project",
      channel: "TikTok",
      objective: "Engagement",
      prompt: "Prompt",
      script: "Script",
      caption: "Caption",
      hashtags: [],
      call_to_action: "Shop now",
      scenes: [],
      duration_seconds: 12,
      voice: "marin",
      music_mode: "NONE",
      provider: "REPLICATE",
      routing_tier: "ECONOMY",
      provider_model: "wan-video/wan-2.2-t2v-fast",
      provider_job_id: "prediction-fail",
      provider_job_status: "in_progress",
      provider_progress: 22,
      status: "GENERATING",
      failure_reason: null,
      failure_reference_id: null,
      workflow_stage: "GENERATING_SCENES",
      workflow_percentage: 44,
      credit_status: "RESERVED",
      credit_refunded_at: null,
      media_asset_id: null,
      video_storage_path: null,
      workflow_started_at: new Date().toISOString(),
      workflow_completed_at: null,
      updated_at: new Date().toISOString(),
    });

    fetchVideoProviderJobMock.mockResolvedValue({
      providerJobId: "prediction-fail",
      status: "failed",
      progress: 30,
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      outputUrl: null,
      failureReason: "Internal provider detail",
    });

    const { GET } = await import("@/app/api/ai/video-workflow/route");

    const first = await GET(
      new Request("https://postmotive.example/api/ai/video-workflow?projectId=project-fail"),
    );
    const second = await GET(
      new Request("https://postmotive.example/api/ai/video-workflow?projectId=project-fail"),
    );

    const firstPayload = (await first.json()) as { error?: string; refunded?: boolean; failureReferenceId?: string };
    const secondPayload = (await second.json()) as { error?: string; refunded?: boolean };

    expect(first.status).toBe(200);
    expect(firstPayload.error).toBe("Video generation didn't complete.");
    expect(firstPayload.refunded).toBe(true);
    expect(firstPayload.failureReferenceId).toBeTruthy();
    expect(secondPayload.error).toBe("Video generation didn't complete.");
    expect(harness.refundCalls).toEqual(["credit-fail"]);
  });

  it("marks exact product mode blocked when runtime compositor is unavailable and refunds credits", async () => {
    const harness = createHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    harness.projects.set("project-exact-blocked", {
      id: "project-exact-blocked",
      workspace_id: "workspace-1",
      content_draft_id: null,
      workflow_key: "wf-exact-blocked",
      credit_request_id: "credit-exact-blocked",
      title: "Project",
      channel: "TikTok",
      objective: "Engagement",
      prompt: "Prompt",
      script: "Script",
      caption: "Caption",
      hashtags: [],
      call_to_action: "Shop now",
      scenes: [
        {
          order: 1,
          seconds: 12,
          visual: "Product only",
          narration: "Narration",
          onScreenText: "Text",
          productAssetId: "product-4",
          productMode: "EXACT_PRODUCT",
          productPlacement: "center frame",
          productScale: "0.35",
          productOpacity: 1,
          productShadow: true,
          productEntrance: "FADE_IN",
          productExit: "FADE_OUT",
          productZoom: "NONE",
        },
      ],
      duration_seconds: 12,
      voice: "marin",
      music_mode: "NONE",
      provider: "REPLICATE",
      routing_tier: "ECONOMY",
      provider_model: "wan-video/wan-2.2-t2v-fast",
      provider_job_id: "prediction-exact-blocked",
      provider_job_status: "in_progress",
      provider_progress: 66,
      status: "GENERATING",
      failure_reason: null,
      failure_reference_id: null,
      workflow_stage: "RENDERING_FINAL_VIDEO",
      workflow_percentage: 82,
      credit_status: "RESERVED",
      credit_refunded_at: null,
      media_asset_id: null,
      video_storage_path: null,
      workflow_started_at: new Date().toISOString(),
      workflow_completed_at: null,
      updated_at: new Date().toISOString(),
    });

    harness.media.set("product-4", {
      id: "product-4",
      workspace_id: "workspace-1",
      generation_job_id: null,
      storage_path: "workspace-1/user-1/product-4.png",
      file_name: "product-4.png",
      mime_type: "image/png",
      size_bytes: 4096,
      metadata: {
        productAsset: {
          productId: "sku-4",
          approvedForGeneration: true,
          locked: true,
        },
      },
    });

    fetchVideoProviderJobMock.mockResolvedValueOnce({
      providerJobId: "prediction-exact-blocked",
      status: "completed",
      progress: 100,
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      outputUrl: "https://provider-output.example/video.mp4",
      failureReason: null,
    });

    composeVideoWithExactProductMock.mockRejectedValueOnce(new Error("FFMPEG_RUNTIME_UNAVAILABLE"));

    const { GET } = await import("@/app/api/ai/video-workflow/route");

    const response = await GET(
      new Request("https://postmotive.example/api/ai/video-workflow?projectId=project-exact-blocked"),
    );
    const payload = (await response.json()) as {
      status?: string;
      stage?: string;
      blockedExactProduct?: boolean;
      refunded?: boolean;
      error?: string;
      failureReferenceId?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("failed");
    expect(payload.stage).toBe("FAILED");
    expect(payload.blockedExactProduct).toBe(true);
    expect(payload.refunded).toBe(true);
    expect(payload.error).toBe("Exact Product Mode is temporarily unavailable in this runtime. Product image compositing could not run.");
    expect(payload.failureReferenceId).toBeTruthy();
    expect(harness.refundCalls).toEqual(["credit-exact-blocked"]);
    expect(harness.mediaInsertCount).toBe(0);
  });
});

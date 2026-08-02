import { beforeEach, describe, expect, it, vi } from "vitest";

type VideoProjectRow = {
  id: string;
  workspace_id: string;
  workflow_key: string | null;
  credit_request_id: string | null;
  provider_job_id: string | null;
  provider_progress: number | null;
  status: string;
  routing_tier: string | null;
  provider_model: string | null;
  video_storage_path: string | null;
  failure_reason: string | null;
};

const createClientMock = vi.fn();
const loadVideoRouterSettingsMock = vi.fn();
const resolveVideoRouterProfileMock = vi.fn();
const getServerEnvMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/features/core/video-router-settings", () => ({
  loadVideoRouterSettings: loadVideoRouterSettingsMock,
}));

vi.mock("@/features/core/video-router", () => ({
  resolveVideoRouterProfile: resolveVideoRouterProfileMock,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: getServerEnvMock,
}));

function createSupabaseHarness(options?: {
  initialProjects?: VideoProjectRow[];
}) {
  const projects = new Map<string, VideoProjectRow>();
  for (const project of options?.initialProjects || []) {
    projects.set(project.id, { ...project });
  }

  const reserveCalls: Array<{ video_seconds: number; credit_request_id: string }> = [];
  const refundCalls: Array<{ credit_request_id: string; refund_reason: string }> = [];
  let mediaAssetInsertCount = 0;
  let contentDraftInsertCount = 0;

  function getProjectByWorkflow(workspaceId: string, workflowKey: string) {
    for (const project of projects.values()) {
      if (project.workspace_id === workspaceId && project.workflow_key === workflowKey) {
        return project;
      }
    }
    return null;
  }

  function getProjectByIdOrJob(id: string) {
    const byId = projects.get(id);
    if (byId) return byId;
    for (const project of projects.values()) {
      if (project.provider_job_id === id) return project;
    }
    return null;
  }

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
      })),
    },
    rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => {
      if (name === "my_primary_workspace_id") {
        return { data: "workspace-1", error: null };
      }
      if (name === "reserve_my_video_credits") {
        reserveCalls.push({
          video_seconds: Number(args?.video_seconds),
          credit_request_id: String(args?.credit_request_id || ""),
        });
        return {
          data: {
            charged_credits: Number(args?.video_seconds || 0),
            remaining_credits: 100,
            monthly_used_credits: 12,
            monthly_limit_credits: 300,
            billing_exempt: false,
            estimated_provider_cost_cents: 700,
          },
          error: null,
        };
      }
      if (name === "refund_my_video_credits") {
        refundCalls.push({
          credit_request_id: String(args?.credit_request_id || ""),
          refund_reason: String(args?.refund_reason || ""),
        });
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
    from: vi.fn((table: string) => {
      if (table === "video_projects") {
        return {
          select: vi.fn(() => {
            const filters: Record<string, string> = {};
            return {
              eq: vi.fn((field: string, value: string) => {
                filters[field] = value;
                return {
                  eq: vi.fn((field2: string, value2: string) => {
                    filters[field2] = value2;
                    return {
                      maybeSingle: vi.fn(async () => {
                        if (filters.workspace_id && filters.workflow_key) {
                          const row = getProjectByWorkflow(
                            filters.workspace_id,
                            filters.workflow_key,
                          );
                          return { data: row, error: null };
                        }
                        if (filters.id) {
                          const row = projects.get(filters.id) || null;
                          return { data: row, error: null };
                        }
                        if (filters.provider_job_id) {
                          const row =
                            [...projects.values()].find(
                              (item) => item.provider_job_id === filters.provider_job_id,
                            ) || null;
                          return { data: row, error: null };
                        }
                        return { data: null, error: null };
                      }),
                    };
                  }),
                  maybeSingle: vi.fn(async () => {
                    if (filters.id) {
                      const row = projects.get(filters.id) || null;
                      return { data: row, error: null };
                    }
                    if (filters.provider_job_id) {
                      const row =
                        [...projects.values()].find(
                          (item) => item.provider_job_id === filters.provider_job_id,
                        ) || null;
                      return { data: row, error: null };
                    }
                    return { data: null, error: null };
                  }),
                };
              }),
            };
          }),
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            const row: VideoProjectRow = {
              id: String(payload.id),
              workspace_id: String(payload.workspace_id),
              workflow_key: payload.workflow_key ? String(payload.workflow_key) : null,
              credit_request_id: payload.credit_request_id
                ? String(payload.credit_request_id)
                : null,
              provider_job_id: payload.provider_job_id
                ? String(payload.provider_job_id)
                : null,
              provider_progress: Number(payload.provider_progress || 0),
              status: String(payload.status || "GENERATING"),
              routing_tier: payload.routing_tier ? String(payload.routing_tier) : null,
              provider_model: payload.provider_model
                ? String(payload.provider_model)
                : null,
              video_storage_path: payload.video_storage_path
                ? String(payload.video_storage_path)
                : null,
              failure_reason: payload.failure_reason
                ? String(payload.failure_reason)
                : null,
            };
            projects.set(row.id, row);
            return { error: null };
          }),
          update: vi.fn((updates: Record<string, unknown>) => ({
            eq: vi.fn(async (_field: string, value: string) => {
              const current = projects.get(value);
              if (!current) return { error: null };
              const next: VideoProjectRow = {
                ...current,
                provider_job_id:
                  updates.provider_job_id === undefined
                    ? current.provider_job_id
                    : (updates.provider_job_id as string | null),
                provider_progress:
                  updates.provider_progress === undefined
                    ? current.provider_progress
                    : Number(updates.provider_progress),
                status:
                  updates.status === undefined
                    ? current.status
                    : String(updates.status),
                failure_reason:
                  updates.failure_reason === undefined
                    ? current.failure_reason
                    : updates.failure_reason
                      ? String(updates.failure_reason)
                      : null,
                video_storage_path:
                  updates.video_storage_path === undefined
                    ? current.video_storage_path
                    : updates.video_storage_path
                      ? String(updates.video_storage_path)
                      : null,
              };
              projects.set(value, next);
              return { error: null };
            }),
          })),
        };
      }

      if (table === "media_assets") {
        return {
          insert: vi.fn(async () => {
            mediaAssetInsertCount += 1;
            return { error: null };
          }),
        };
      }

      if (table === "content_drafts") {
        return {
          insert: vi.fn(async () => {
            contentDraftInsertCount += 1;
            return { error: null };
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    reserveCalls,
    refundCalls,
    projects,
    get mediaAssetInsertCount() {
      return mediaAssetInsertCount;
    },
    get contentDraftInsertCount() {
      return contentDraftInsertCount;
    },
  };
}

describe("legacy video render route idempotency and sanitization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    loadVideoRouterSettingsMock.mockResolvedValue({
      mode: "AUTO",
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

    resolveVideoRouterProfileMock.mockReturnValue({
      tier: "ECONOMY",
      providerKey: "OPENAI",
      model: "sora-2-pro",
      estimatedCostCentsPerSecond: 70,
      maxRetries: 2,
    });

    getServerEnvMock.mockReturnValue({
      openAiApiKey: "test-key",
      openAiModel: "gpt-test",
    });
  });

  it("reserves credits once for identical POST retries and reuses workflow job", async () => {
    const harness = createSupabaseHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ id: "provider-job-1" }),
      })) as unknown as typeof fetch,
    );

    const { POST } = await import("@/app/api/ai/video-render/route");

    const request = new Request("https://postmotive.example/api/ai/video-render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Create a 9:16 clip",
        seconds: 12,
      }),
    });

    const response1 = await POST(request);
    const payload1 = (await response1.json()) as {
      projectId: string;
      workflowKey: string;
    };

    const response2 = await POST(
      new Request("https://postmotive.example/api/ai/video-render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Create a 9:16 clip",
          seconds: 12,
        }),
      }),
    );
    const payload2 = (await response2.json()) as {
      projectId: string;
      workflowKey: string;
    };

    expect(harness.reserveCalls).toHaveLength(1);
    expect(payload2.projectId).toBe(payload1.projectId);
    expect(payload2.workflowKey).toBe(payload1.workflowKey);

    const savedProject = harness.projects.get(payload1.projectId);
    expect(savedProject?.credit_request_id).toBe(harness.reserveCalls[0].credit_request_id);
  });

  it("duplicate completion checks do not create duplicate assets or drafts", async () => {
    const harness = createSupabaseHarness({
      initialProjects: [
        {
          id: "project-1",
          workspace_id: "workspace-1",
          workflow_key: "workflow-1",
          credit_request_id: "credit-1",
          provider_job_id: "provider-job-1",
          provider_progress: 50,
          status: "GENERATING",
          routing_tier: "ECONOMY",
          provider_model: "sora-2-pro",
          video_storage_path: null,
          failure_reason: null,
        },
      ],
    });
    createClientMock.mockResolvedValue(harness.supabase);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "completed", progress: 100 }),
      })) as unknown as typeof fetch,
    );

    const { GET } = await import("@/app/api/ai/video-render/route");

    const url = "https://postmotive.example/api/ai/video-render?id=provider-job-1";
    const response1 = await GET(new Request(url));
    const response2 = await GET(new Request(url));

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(harness.mediaAssetInsertCount).toBe(0);
    expect(harness.contentDraftInsertCount).toBe(0);
  });

  it("sanitizes provider errors and strips billing URLs from API responses", async () => {
    const harness = createSupabaseHarness();
    createClientMock.mockResolvedValue(harness.supabase);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message:
              "Provider failed. See https://api.openai.com/v1/videos and https://billing.stripe.com/p/session/test with model sora-2-pro",
          },
        }),
      })) as unknown as typeof fetch,
    );

    const { POST } = await import("@/app/api/ai/video-render/route");
    const response = await POST(
      new Request("https://postmotive.example/api/ai/video-render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Render clip", seconds: 8 }),
      }),
    );

    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe(
      "Video generation is temporarily unavailable. Your credits were not charged.",
    );
    expect(payload.error.toLowerCase()).not.toContain("http");
    expect(payload.error.toLowerCase()).not.toContain("openai");
    expect(payload.error.toLowerCase()).not.toContain("billing");
  });

  it("refunds a failed generation only once across repeated status checks", async () => {
    const harness = createSupabaseHarness({
      initialProjects: [
        {
          id: "project-2",
          workspace_id: "workspace-1",
          workflow_key: "workflow-2",
          credit_request_id: "credit-2",
          provider_job_id: "provider-job-2",
          provider_progress: 30,
          status: "GENERATING",
          routing_tier: "ECONOMY",
          provider_model: "sora-2-pro",
          video_storage_path: null,
          failure_reason: null,
        },
      ],
    });
    createClientMock.mockResolvedValue(harness.supabase);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: "failed",
          progress: 40,
          error: {
            message: "Upstream error with https://api.openai.com and model sora-2-pro",
          },
        }),
      })) as unknown as typeof fetch,
    );

    const { GET } = await import("@/app/api/ai/video-render/route");

    const url = "https://postmotive.example/api/ai/video-render?id=provider-job-2";
    const first = await GET(new Request(url));
    const second = await GET(new Request(url));

    const firstPayload = (await first.json()) as { error?: { message?: string } };
    const secondPayload = (await second.json()) as { error?: { message?: string } };

    expect(firstPayload.error?.message).toBe(
      "Video generation is temporarily unavailable. Your credits were not charged.",
    );
    expect(secondPayload.error?.message).toBe(
      "Video generation is temporarily unavailable. Your credits were not charged.",
    );
    expect(harness.refundCalls).toHaveLength(1);
    expect(harness.refundCalls[0].credit_request_id).toBe("credit-2");
  });
});

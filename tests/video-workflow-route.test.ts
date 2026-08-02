import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const getServerEnvMock = vi.fn();
const loadVideoRouterSettingsMock = vi.fn();
const resolveVideoRouterProfileMock = vi.fn();
const startVideoProviderJobMock = vi.fn();

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
  getVideoProviderUnavailableMessage: () => "Video generation is temporarily unavailable.",
}));

type VideoProjectRow = {
  id: string;
  workspace_id: string;
  workflow_key: string | null;
  content_draft_id: string | null;
  credit_request_id: string | null;
  status: string;
};

function createWorkflowSupabaseHarness() {
  const projects = new Map<string, VideoProjectRow>();

  const supabase = {
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims: { sub: "user-1" } },
      })),
    },
    rpc: vi.fn(async (name: string) => {
      if (name === "my_primary_workspace_id") {
        return { data: "workspace-1", error: null };
      }
      if (name === "reserve_my_video_credits") {
        return { data: { charged_credits: 12 }, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
    from: vi.fn((table: string) => {
      if (table === "video_projects") {
        return {
          select: vi.fn(() => {
            const filters: Record<string, string> = {};
            return {
              eq: vi.fn((field1: string, value1: string) => {
                filters[field1] = value1;
                return {
                  eq: vi.fn((field2: string, value2: string) => {
                    filters[field2] = value2;
                    return {
                      maybeSingle: vi.fn(async () => {
                        if (filters.workspace_id && filters.workflow_key) {
                          const existing = [...projects.values()].find(
                            (row) =>
                              row.workspace_id === filters.workspace_id
                              && row.workflow_key === filters.workflow_key,
                          );
                          return { data: existing || null, error: null };
                        }
                        return { data: null, error: null };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            const row: VideoProjectRow = {
              id: String(payload.id),
              workspace_id: String(payload.workspace_id),
              workflow_key: payload.workflow_key ? String(payload.workflow_key) : null,
              content_draft_id: payload.content_draft_id ? String(payload.content_draft_id) : null,
              credit_request_id: payload.credit_request_id ? String(payload.credit_request_id) : null,
              status: String(payload.status || "GENERATING"),
            };
            projects.set(row.id, row);
            return { error: null };
          }),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(async (_field: string, value: string) => {
              const current = projects.get(value);
              if (current) {
                projects.set(value, {
                  ...current,
                  content_draft_id:
                    payload.content_draft_id === undefined
                      ? current.content_draft_id
                      : payload.content_draft_id
                        ? String(payload.content_draft_id)
                        : null,
                  status:
                    payload.status === undefined ? current.status : String(payload.status),
                });
              }
              return { error: null };
            }),
          })),
        };
      }

      if (table === "content_drafts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "draft-1" }, error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase };
}

describe("video workflow planning route", () => {
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
  });

  it("returns a sanitized 503 when planning text cannot be parsed", async () => {
    const harness = createWorkflowSupabaseHarness();
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

    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(503);
    expect(payload.error).toBe("Video generation is temporarily unavailable.");
    expect(startVideoProviderJobMock).not.toHaveBeenCalled();
  });

  it("continues beyond planning when OpenAI text content contains nested value JSON", async () => {
    const harness = createWorkflowSupabaseHarness();
    createClientMock.mockResolvedValue(harness.supabase);

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

    const payload = (await response.json()) as { ok?: boolean; providerJobId?: string };
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.providerJobId).toBe("prediction-1");
    expect(startVideoProviderJobMock).toHaveBeenCalledTimes(1);
  });
});

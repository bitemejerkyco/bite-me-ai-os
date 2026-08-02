import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  mapProviderErrorCodeToMessage,
  startVideoProviderJob,
} from "@/features/core/video-provider";

describe("video provider model selection", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_WAN_22_FAST_MODEL;
  });

  it("uses official full model slug when no env override is configured", async () => {
    process.env.REPLICATE_API_TOKEN = "token";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "prediction_1", status: "starting" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await startVideoProviderJob({
      providerKey: "REPLICATE",
      model: "wan-2.2-fast",
      prompt: "Prompt",
      seconds: 8,
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as { model: string };
    expect(body.model).toBe("wan-video/wan-2.2-t2v-fast");
  });

  it("prefers REPLICATE_WAN_22_FAST_MODEL override", async () => {
    process.env.REPLICATE_API_TOKEN = "token";
    process.env.REPLICATE_WAN_22_FAST_MODEL = "custom/wan-fast";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "prediction_2", status: "starting" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await startVideoProviderJob({
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      prompt: "Prompt",
      seconds: 9,
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as { model: string };
    expect(body.model).toBe("custom/wan-fast");
  });

  it("normalizes short alias from env override to official slug", async () => {
    process.env.REPLICATE_API_TOKEN = "token";
    process.env.REPLICATE_WAN_22_FAST_MODEL = "wan-2.2-fast";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "prediction_3", status: "starting" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await startVideoProviderJob({
      providerKey: "REPLICATE",
      model: "wan-2.2-fast",
      prompt: "Prompt",
      seconds: 10,
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as { model: string };
    expect(body.model).toBe("wan-video/wan-2.2-t2v-fast");
  });

  it("sends supported replicate input payload fields", async () => {
    process.env.REPLICATE_API_TOKEN = "token";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "prediction_4", status: "queued" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await startVideoProviderJob({
      providerKey: "REPLICATE",
      model: "wan-video/wan-2.2-t2v-fast",
      prompt: "Prompt",
      seconds: 22,
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      input: {
        prompt: string;
        aspect_ratio: string;
        resolution: string;
        duration: number;
        frames_per_second: number;
      };
    };

    expect(body.input.prompt).toBe("Prompt");
    expect(body.input.aspect_ratio).toBe("9:16");
    expect(body.input.resolution).toBe("480p");
    expect(body.input.duration).toBe(15);
    expect(body.input.frames_per_second).toBe(16);
  });

  it("maps provider codes to safe actionable user messages", () => {
    expect(mapProviderErrorCodeToMessage("REPLICATE_NOT_CONFIGURED")).toContain("not configured");
    expect(mapProviderErrorCodeToMessage("REPLICATE_BILLING_REQUIRED")).toContain("billing");
    expect(mapProviderErrorCodeToMessage("REPLICATE_AUTH_FAILED")).toContain("credentials");
    expect(mapProviderErrorCodeToMessage("REPLICATE_RATE_LIMITED")).toContain("busy");
  });
});

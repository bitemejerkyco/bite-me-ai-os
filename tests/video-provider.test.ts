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
    const body = JSON.parse(String(requestInit.body)) as { version: string; model?: string };
    expect(body.version).toBe("wan-video/wan-2.2-t2v-fast");
    expect(body.model).toBeUndefined();
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
    const body = JSON.parse(String(requestInit.body)) as { version: string };
    expect(body.version).toBe("custom/wan-fast");
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
    const body = JSON.parse(String(requestInit.body)) as { version: string };
    expect(body.version).toBe("wan-video/wan-2.2-t2v-fast");
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
      version: string;
      input: {
        prompt: string;
        aspect_ratio: string;
        resolution: string;
        duration: number;
        frames_per_second: number;
      };
    };

    expect(body.version).toBe("wan-video/wan-2.2-t2v-fast");
    expect(body.input.prompt).toBe("Prompt");
    expect(body.input.aspect_ratio).toBe("9:16");
    expect(body.input.resolution).toBe("480p");
    expect(body.input.duration).toBe(15);
    expect(body.input.frames_per_second).toBe(16);
  });

  it("logs safe metadata and hides provider payload details on failure", async () => {
    process.env.REPLICATE_API_TOKEN = "token";

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 402,
      json: async () => ({
        error: "token=secret prompt=hidden",
        body: { prompt: "hidden" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(
      startVideoProviderJob({
        providerKey: "REPLICATE",
        model: "wan-video/wan-2.2-t2v-fast",
        prompt: "Prompt",
        seconds: 8,
      }),
    ).rejects.toThrow("REPLICATE_BILLING_REQUIRED");

    expect(infoSpy).toHaveBeenCalledWith(
      "[video-workflow] provider-start-attempt",
      expect.objectContaining({
        providerKey: "REPLICATE",
        model: "wan-video/wan-2.2-t2v-fast",
        duration: 8,
        aspectRatio: "9:16",
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[video-workflow] provider-start-failure",
      expect.objectContaining({
        providerKey: "REPLICATE",
        model: "wan-video/wan-2.2-t2v-fast",
        status: 402,
        safeErrorCode: "REPLICATE_BILLING_REQUIRED",
      }),
    );

    const loggedText = `${JSON.stringify(infoSpy.mock.calls)} ${JSON.stringify(errorSpy.mock.calls)}`;
    expect(loggedText).not.toContain("secret");
    expect(loggedText).not.toContain("Prompt");
    expect(loggedText).not.toContain("hidden");

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("maps provider codes to safe actionable user messages", () => {
    expect(mapProviderErrorCodeToMessage("REPLICATE_NOT_CONFIGURED")).toContain("not configured");
    expect(mapProviderErrorCodeToMessage("REPLICATE_BILLING_REQUIRED")).toContain("billing");
    expect(mapProviderErrorCodeToMessage("REPLICATE_AUTH_FAILED")).toContain("credentials");
    expect(mapProviderErrorCodeToMessage("REPLICATE_RATE_LIMITED")).toContain("busy");
  });
});

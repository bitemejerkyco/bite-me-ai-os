import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedStaticFfmpegPath = vi.hoisted(
  () => `${process.env.TEMP || process.env.TMP || (process.platform === "win32" ? "C:/Windows/Temp" : "/tmp")}/vitest-ffmpeg-static-bin`,
);
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("ffmpeg-static", () => ({
  default: mockedStaticFfmpegPath,
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

function ensureFile(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "ffmpeg-binary");
}

function listComposeTempDirs(): string[] {
  return readdirSync(tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("video-compose-"))
    .map((entry) => entry.name)
    .sort();
}

function createResponse(bytes: Uint8Array, contentType: string): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
  });
}

describe("video compositor runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FFMPEG_PATH = "";
    delete process.env.VIDEO_COMPOSITOR_TIMEOUT_MS;
    ensureFile(mockedStaticFfmpegPath);
  });

  it("prefers FFMPEG_PATH when explicitly configured", async () => {
    const configuredPath = join(tmpdir(), "vitest-custom-ffmpeg");
    ensureFile(configuredPath);
    process.env.FFMPEG_PATH = configuredPath;

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      child.stderr = new EventEmitter();
      setTimeout(() => {
        writeFileSync(args[args.length - 1], new Uint8Array([1, 2, 3]));
        child.emit("exit", 0);
      }, 0);
      return child;
    });

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      if (String(url).includes("provider")) {
        return createResponse(new Uint8Array([0, 0, 0, 1]), "video/mp4");
      }
      return createResponse(new Uint8Array([137, 80, 78, 71]), "image/png");
    }) as unknown as typeof fetch);

    const { composeVideoWithExactProduct } = await import("@/features/core/video-compositor");

    await composeVideoWithExactProduct({
      providerOutputUrl: "https://provider.example/video.mp4",
      expectedDurationSeconds: 1,
      productLayer: {
        assetId: "product-1",
        assetUrl: "https://signed.example/product.png",
        assetMimeType: "image/png",
        scenes: [{ order: 1, startSeconds: 0, endSeconds: 1 }],
      },
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0]?.[0]).toBe(configuredPath);
  });

  it("falls back to bundled ffmpeg-static when FFMPEG_PATH is unset", async () => {
    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      child.stderr = new EventEmitter();
      setTimeout(() => {
        writeFileSync(args[args.length - 1], new Uint8Array([9, 8, 7]));
        child.emit("exit", 0);
      }, 0);
      return child;
    });

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      if (String(url).includes("provider")) {
        return createResponse(new Uint8Array([0, 0, 0, 1]), "video/mp4");
      }
      return createResponse(new Uint8Array([255, 216, 255]), "image/jpeg");
    }) as unknown as typeof fetch);

    const { composeVideoWithExactProduct } = await import("@/features/core/video-compositor");

    await composeVideoWithExactProduct({
      providerOutputUrl: "https://provider.example/video.mp4",
      expectedDurationSeconds: 1,
      productLayer: {
        assetId: "product-2",
        assetUrl: "https://signed.example/product.jpg",
        assetMimeType: "image/jpeg",
        scenes: [{ order: 1, startSeconds: 0, endSeconds: 1 }],
      },
    });

    expect(spawnMock.mock.calls[0]?.[0]).toBe(mockedStaticFfmpegPath);
  });

  it("fails safely when neither configured nor bundled ffmpeg path is usable", async () => {
    if (existsSync(mockedStaticFfmpegPath)) {
      unlinkSync(mockedStaticFfmpegPath);
    }

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      if (String(url).includes("provider")) {
        return createResponse(new Uint8Array([0, 1]), "video/mp4");
      }
      return createResponse(new Uint8Array([137, 80, 78, 71]), "image/png");
    }) as unknown as typeof fetch);

    const { composeVideoWithExactProduct } = await import("@/features/core/video-compositor");

    await expect(
      composeVideoWithExactProduct({
        providerOutputUrl: "https://provider.example/video.mp4",
        productLayer: {
          assetId: "product-3",
          assetUrl: "https://signed.example/product.png",
          scenes: [{ order: 1, startSeconds: 0, endSeconds: 1 }],
        },
      }),
    ).rejects.toThrow("FFMPEG_RUNTIME_UNAVAILABLE");
  });

  it("invokes ffmpeg with a safe argument array and no shell interpolation", async () => {
    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      child.stderr = new EventEmitter();
      setTimeout(() => {
        writeFileSync(args[args.length - 1], new Uint8Array([3, 3, 3]));
        child.emit("exit", 0);
      }, 0);
      return child;
    });

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      if (String(url).includes("provider")) {
        return createResponse(new Uint8Array([0, 0, 1]), "video/mp4");
      }
      return createResponse(new Uint8Array([137, 80, 78, 71]), "image/png");
    }) as unknown as typeof fetch);

    const { composeVideoWithExactProduct } = await import("@/features/core/video-compositor");

    await composeVideoWithExactProduct({
      providerOutputUrl: "https://provider.example/video.mp4",
      expectedDurationSeconds: 2,
      productLayer: {
        assetId: "product-4",
        assetUrl: "https://signed.example/product.png",
        scenes: [{ order: 1, startSeconds: 0.2, endSeconds: 1.8, position: "bottom right", scale: "35%", opacity: 0.85 }],
      },
    });

    const spawnCall = spawnMock.mock.calls[0];
    expect(Array.isArray(spawnCall?.[1])).toBe(true);
    expect((spawnCall?.[2] as { shell?: boolean })?.shell).not.toBe(true);
    const args = spawnCall?.[1] as string[];
    expect(args).toContain("-filter_complex");
    expect(args).toContain("-movflags");
    expect(args).toContain("+faststart");
  });

  it("encodes timing, opacity, and rotation overlay controls into filter graph", async () => {
    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      child.stderr = new EventEmitter();
      setTimeout(() => {
        writeFileSync(args[args.length - 1], new Uint8Array([7, 7, 7]));
        child.emit("exit", 0);
      }, 0);
      return child;
    });

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      if (String(url).includes("provider")) {
        return createResponse(new Uint8Array([0, 0, 1]), "video/mp4");
      }
      return createResponse(new Uint8Array([82, 73, 70, 70]), "image/webp");
    }) as unknown as typeof fetch);

    const { composeVideoWithExactProduct } = await import("@/features/core/video-compositor");

    await composeVideoWithExactProduct({
      providerOutputUrl: "https://provider.example/video.mp4",
      expectedDurationSeconds: 3,
      productLayer: {
        assetId: "product-5",
        assetUrl: "https://signed.example/product.webp",
        assetMimeType: "image/webp",
        scenes: [
          {
            order: 1,
            startSeconds: 1,
            endSeconds: 2.5,
            opacity: 0.9,
            rotationDegrees: 6,
            entrance: "FADE_IN",
            exit: "FADE_OUT",
            zoom: "ZOOM_IN",
          },
        ],
      },
    });

    const args = spawnMock.mock.calls[0]?.[1] as string[];
    const filterGraph = args[args.indexOf("-filter_complex") + 1];
    expect(filterGraph).toContain("between(t,1.000,2.500)");
    expect(filterGraph).toContain("rotate='");
    expect(filterGraph).toContain("colorchannelmixer=aa='");
  });

  it("cleans up temporary compose directories in finally", async () => {
    const before = listComposeTempDirs();

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      child.stderr = new EventEmitter();
      setTimeout(() => {
        writeFileSync(args[args.length - 1], new Uint8Array([4, 4, 4]));
        child.emit("exit", 0);
      }, 0);
      return child;
    });

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      if (String(url).includes("provider")) {
        return createResponse(new Uint8Array([0, 1]), "video/mp4");
      }
      return createResponse(new Uint8Array([137, 80, 78, 71]), "image/png");
    }) as unknown as typeof fetch);

    const { composeVideoWithExactProduct } = await import("@/features/core/video-compositor");

    await composeVideoWithExactProduct({
      providerOutputUrl: "https://provider.example/video.mp4",
      productLayer: {
        assetId: "product-6",
        assetUrl: "https://signed.example/product.png",
        scenes: [{ order: 1, startSeconds: 0, endSeconds: 1 }],
      },
    });

    const after = listComposeTempDirs();
    expect(after).toEqual(before);
  });
});

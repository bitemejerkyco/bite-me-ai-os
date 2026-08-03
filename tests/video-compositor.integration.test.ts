import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const tinyTransparentPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7W1YkAAAAASUVORK5CYII=";

describe("video compositor integration", () => {
  it("composites a tiny fixture video with real ffmpeg runtime when supported", async () => {
    const compositorModule = await import("@/features/core/video-compositor");
    let ffmpegPath = "";
    try {
      ffmpegPath = compositorModule.resolveFfmpegExecutablePath();
    } catch {
      return;
    }
    const check = spawnSync(ffmpegPath, ["-version"], { stdio: "ignore" });
    if (check.status !== 0) {
      return;
    }

    const root = mkdtempSync(join(tmpdir(), "video-compositor-fixture-"));
    const sourceVideoPath = join(root, "source.mp4");
    const productImagePath = join(root, "product.png");

    try {
      writeFileSync(productImagePath, Buffer.from(tinyTransparentPngBase64, "base64"));

      const generate = spawnSync(
        ffmpegPath,
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=black:s=1080x1920:d=1",
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=48000",
          "-shortest",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          sourceVideoPath,
        ],
        { stdio: "ignore" },
      );
      expect(generate.status).toBe(0);

      const sourceBytes = readFileSync(sourceVideoPath);
      const productBytes = readFileSync(productImagePath);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("provider")) {
          return new Response(sourceBytes, {
            status: 200,
            headers: {
              "content-type": "video/mp4",
              "content-length": String(sourceBytes.byteLength),
            },
          });
        }
        return new Response(productBytes, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(productBytes.byteLength),
          },
        });
      }) as typeof fetch;

      try {
        const result = await compositorModule.composeVideoWithExactProduct({
          providerOutputUrl: "https://provider.example/source.mp4",
          expectedDurationSeconds: 1,
          productLayer: {
            assetId: "fixture-product",
            assetUrl: "https://signed.example/product.png",
            assetMimeType: "image/png",
            scenes: [
              {
                order: 1,
                startSeconds: 0,
                endSeconds: 1,
                position: "center",
                scale: "35%",
                opacity: 1,
                entrance: "NONE",
                exit: "NONE",
              },
            ],
          },
        });

        expect(result.videoBytes.byteLength).toBeGreaterThan(1000);
        expect(result.manifest.mode).toBe("EXACT_PRODUCT");
        expect(result.manifest.composed).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});

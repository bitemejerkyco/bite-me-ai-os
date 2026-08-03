import "server-only";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessSync } from "node:fs";
import ffmpegStaticPath from "ffmpeg-static";

const MAX_PROVIDER_VIDEO_BYTES = 250 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_COMPOSITED_VIDEO_BYTES = 300 * 1024 * 1024;
const DEFAULT_COMPOSITION_TIMEOUT_MS = 45_000;
const SUPPORTED_PRODUCT_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ProductLayerScene = {
  order: number;
  startSeconds: number;
  endSeconds: number;
  position?: string;
  scale?: string;
  opacity?: number;
  shadow?: boolean;
  rotationDegrees?: number;
  entrance?: "NONE" | "FADE_IN" | "SLIDE_UP";
  exit?: "NONE" | "FADE_OUT";
  zoom?: "NONE" | "ZOOM_IN" | "ZOOM_OUT";
};

export type VideoCompositionManifest = {
  mode: "NONE" | "EXACT_PRODUCT" | "AI_PRODUCT_MOTION";
  providerOutputUrl: string;
  compositor: "passthrough" | "ffmpeg";
  composed: boolean;
  layers: Array<{
    type: "product";
    assetId: string;
    assetUrl: string;
    originalAssetId?: string;
    locked?: boolean;
    approvedForGeneration?: boolean;
    transparentBackground?: boolean;
    scenes: ProductLayerScene[];
  }>;
};

export type ComposeVideoInput = {
  providerOutputUrl: string;
  providerOutputMimeType?: string;
  providerOutputSizeBytes?: number;
  expectedDurationSeconds?: number;
  productLayer?: {
    assetId: string;
    assetUrl: string;
    assetMimeType?: string;
    assetSizeBytes?: number;
    originalAssetId?: string;
    locked?: boolean;
    approvedForGeneration?: boolean;
    transparentBackground?: boolean;
    scenes: ProductLayerScene[];
  };
};

export type ComposeVideoResult = {
  videoBytes: Uint8Array;
  manifest: VideoCompositionManifest;
};

export function resolveFfmpegExecutablePath(): string {
  const configuredPath = String(process.env.FFMPEG_PATH || "").trim();
  const bundledPath = typeof ffmpegStaticPath === "string" ? ffmpegStaticPath.trim() : "";
  const selected = configuredPath || bundledPath;
  if (!selected) {
    throw new Error("FFMPEG_RUNTIME_UNAVAILABLE");
  }
  try {
    accessSync(selected, fsConstants.F_OK);
  } catch {
    throw new Error("FFMPEG_RUNTIME_UNAVAILABLE");
  }
  return selected;
}

function isForbiddenHostname(hostname: string): boolean {
  const value = hostname.trim().toLowerCase();
  if (!value) return true;
  if (value === "localhost" || value === "127.0.0.1" || value === "::1") return true;
  if (/^0\./.test(value)) return true;
  if (/^10\./.test(value)) return true;
  if (/^192\.168\./.test(value)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true;
  if (/^169\.254\./.test(value)) return true;
  if (/^fc|^fd|^fe80:/.test(value)) return true;
  return false;
}

function assertSafeRemoteUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("COMPOSITION_URL_INVALID");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("COMPOSITION_URL_PROTOCOL_UNSUPPORTED");
  }
  if (isForbiddenHostname(parsed.hostname)) {
    throw new Error("COMPOSITION_URL_HOST_FORBIDDEN");
  }
  return parsed;
}

async function fetchBinaryWithLimit(input: {
  url: string;
  maxBytes: number;
  expectedMimeTypePrefix?: string;
}): Promise<Uint8Array> {
  const safeUrl = assertSafeRemoteUrl(input.url);
  const response = await fetch(safeUrl, {
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error("COMPOSITION_FETCH_FAILED");
  }
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > input.maxBytes) {
    throw new Error("COMPOSITION_INPUT_TOO_LARGE");
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (input.expectedMimeTypePrefix && !contentType.startsWith(input.expectedMimeTypePrefix)) {
    throw new Error("COMPOSITION_INPUT_MIME_UNSUPPORTED");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > input.maxBytes) {
    throw new Error("COMPOSITION_INPUT_TOO_LARGE");
  }
  return bytes;
}

function parseScaleFactor(value?: string): number {
  if (!value) return 0.35;
  const direct = Number(value);
  if (Number.isFinite(direct)) {
    return Math.max(0.08, Math.min(0.9, direct));
  }
  const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) {
    const parsed = Number(match[1]) / 100;
    return Math.max(0.08, Math.min(0.9, parsed));
  }
  if (/small/i.test(value)) return 0.2;
  if (/medium/i.test(value)) return 0.3;
  if (/large/i.test(value)) return 0.42;
  return 0.35;
}

function parseOpacity(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.05, Math.min(1, parsed));
}

function parseRotationDegrees(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-12, Math.min(12, parsed));
}

function parsePositionExpressions(position?: string): { x: string; y: string } {
  const normalized = (position || "center").toLowerCase();
  if (normalized.includes("top") && normalized.includes("left")) return { x: "20", y: "20" };
  if (normalized.includes("top") && normalized.includes("right")) return { x: "W-w-20", y: "20" };
  if (normalized.includes("bottom") && normalized.includes("left")) return { x: "20", y: "H-h-20" };
  if (normalized.includes("bottom") && normalized.includes("right")) return { x: "W-w-20", y: "H-h-20" };
  if (normalized.includes("top")) return { x: "(W-w)/2", y: "20" };
  if (normalized.includes("bottom")) return { x: "(W-w)/2", y: "H-h-20" };
  if (normalized.includes("left")) return { x: "20", y: "(H-h)/2" };
  if (normalized.includes("right")) return { x: "W-w-20", y: "(H-h)/2" };
  return { x: "(W-w)/2", y: "(H-h)/2" };
}

function progressExpr(start: number, end: number): string {
  const span = Math.max(0.01, end - start);
  return `if(lt(t,${start.toFixed(3)}),0,if(gt(t,${end.toFixed(3)}),1,(t-${start.toFixed(3)})/${span.toFixed(3)}))`;
}

function buildFilterGraph(scenes: ProductLayerScene[]): string {
  const sceneCount = Math.max(1, scenes.length);
  const chunks: string[] = [];
  chunks.push(`[1:v]format=rgba,split=${sceneCount}${Array.from({ length: sceneCount }, (_, idx) => `[pi${idx}]`).join("")}`);

  let baseLabel = "[0:v]";

  scenes.forEach((scene, index) => {
    const start = Math.max(0, scene.startSeconds);
    const end = Math.max(start + 0.01, scene.endSeconds);
    const duration = Math.max(0.01, end - start);
    const scale = parseScaleFactor(scene.scale);
    const baseWidth = Math.max(80, Math.round(1080 * scale));
    const opacity = parseOpacity(scene.opacity);
    const rotationDegrees = parseRotationDegrees(scene.rotationDegrees);
    const rotationRadians = (rotationDegrees * Math.PI) / 180;

    const zoomMode = scene.zoom || "NONE";
    const timelineProgress = progressExpr(start, end);
    const zoomMultiplier = zoomMode === "ZOOM_IN"
      ? `(1+0.05*${timelineProgress})`
      : zoomMode === "ZOOM_OUT"
        ? `(1+0.05*(1-${timelineProgress}))`
        : "1";
    const widthExpr = `${baseWidth}*${zoomMultiplier}`;

    const entranceMode = scene.entrance || "NONE";
    const exitMode = scene.exit || "NONE";

    const entranceWindowEnd = start + Math.min(0.6, duration * 0.35);
    const entranceProgress = progressExpr(start, entranceWindowEnd);

    const exitWindowStart = end - Math.min(0.6, duration * 0.35);
    const exitProgress = progressExpr(exitWindowStart, end);

    let alphaExpr = `${opacity}`;
    if (entranceMode === "FADE_IN") {
      alphaExpr = `(${alphaExpr})*${entranceProgress}`;
    }
    if (exitMode === "FADE_OUT") {
      alphaExpr = `(${alphaExpr})*(1-${exitProgress})`;
    }

    const position = parsePositionExpressions(scene.position);
    const xExpr = position.x;
    let yExpr = position.y;
    if (entranceMode === "SLIDE_UP") {
      yExpr = `(${yExpr})+((1-${entranceProgress})*80)`;
    }

    const mainLabel = `[main${index}]`;
    const shadowLabel = `[shadow${index}]`;
    const preparedBaseLabel = `[prepared${index}]`;
    const rotatedLabel = `[preparedRotated${index}]`;
    const withShadowLabel = `[baseShadow${index}]`;
    const nextBaseLabel = `[base${index + 1}]`;
    const preparedLabel = Math.abs(rotationDegrees) > 0.01 ? rotatedLabel : preparedBaseLabel;

    chunks.push(
      `[pi${index}]scale='max(2,trunc((${widthExpr})/2)*2)':-1:eval=frame,colorchannelmixer=aa='${alphaExpr}'${preparedBaseLabel}`,
    );

    if (Math.abs(rotationDegrees) > 0.01) {
      chunks.push(
        `${preparedBaseLabel}rotate='${rotationRadians.toFixed(6)}':fillcolor=none:ow='rotw(iw)':oh='roth(ih)'${rotatedLabel}`,
      );
    }

    if (scene.shadow) {
      const shadowOpacity = Math.max(0.08, Math.min(0.7, opacity * 0.45));
      chunks.push(
        `${preparedLabel}split=2${mainLabel}${shadowLabel}`,
        `${shadowLabel}colorchannelmixer=rr=0:gg=0:bb=0:aa='${shadowOpacity}',boxblur=4:1${shadowLabel}`,
        `${baseLabel}${shadowLabel}overlay=x='${xExpr}+10':y='${yExpr}+10':enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'${withShadowLabel}`,
        `${withShadowLabel}${mainLabel}overlay=x='${xExpr}':y='${yExpr}':enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'${nextBaseLabel}`,
      );
    } else {
      chunks.push(
        `${baseLabel}${preparedLabel}overlay=x='${xExpr}':y='${yExpr}':enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'${nextBaseLabel}`,
      );
    }

    baseLabel = nextBaseLabel;
  });

  chunks.push(`${baseLabel}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p[vout]`);
  return chunks.join(";");
}

async function runFfmpegCompose(input: {
  baseVideoBytes: Uint8Array;
  productImageBytes: Uint8Array;
  scenes: ProductLayerScene[];
  expectedDurationSeconds?: number;
}): Promise<Uint8Array> {
  const ffmpegPath = resolveFfmpegExecutablePath();
  const timeoutMs = Math.max(10_000, Number(process.env.VIDEO_COMPOSITOR_TIMEOUT_MS || DEFAULT_COMPOSITION_TIMEOUT_MS));
  const tempRoot = await mkdtemp(join(tmpdir(), "video-compose-"));
  const inVideoPath = join(tempRoot, "provider.mp4");
  const inImagePath = join(tempRoot, "product.png");
  const compositionManifestPath = join(tempRoot, "composition-manifest.json");
  const outVideoPath = join(tempRoot, `composited-${randomUUID()}.mp4`);

  try {
    await writeFile(inVideoPath, input.baseVideoBytes);
    await writeFile(inImagePath, input.productImageBytes);
    await writeFile(
      compositionManifestPath,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        output: "mp4-h264-yuv420p-faststart",
        durationSeconds: input.expectedDurationSeconds,
        scenes: input.scenes,
      }),
    );

    const filterGraph = buildFilterGraph(input.scenes);

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-y",
        "-i",
        inVideoPath,
        "-loop",
        "1",
        "-i",
        inImagePath,
        "-filter_complex",
        filterGraph,
        "-map",
        "[vout]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-level:v",
        "4.1",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-max_muxing_queue_size",
        "2048",
        ...(Number.isFinite(input.expectedDurationSeconds)
          ? ["-t", String(Math.max(0.2, Number(input.expectedDurationSeconds)))]
          : []),
        "-shortest",
        outVideoPath,
      ];

      const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, timeoutMs);
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message.includes("ENOENT") ? "FFMPEG_NOT_AVAILABLE" : "FFMPEG_START_FAILED"));
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (code === null) {
          reject(new Error("FFMPEG_TIMEOUT"));
          return;
        }
        if (code === 0) {
          resolve();
          return;
        }
        const reason = /Cannot allocate memory|Out of memory/i.test(stderr)
          ? "FFMPEG_MEMORY_LIMIT"
          : "FFMPEG_COMPOSE_FAILED";
        reject(new Error(reason));
      });
    });
    const outputBytes = new Uint8Array(await readFile(outVideoPath));
    if (outputBytes.byteLength > MAX_COMPOSITED_VIDEO_BYTES) {
      throw new Error("COMPOSITION_OUTPUT_TOO_LARGE");
    }
    return outputBytes;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function composeVideoWithExactProduct(
  input: ComposeVideoInput,
): Promise<ComposeVideoResult> {
  if (input.providerOutputSizeBytes && input.providerOutputSizeBytes > MAX_PROVIDER_VIDEO_BYTES) {
    throw new Error("VIDEO_OUTPUT_TOO_LARGE");
  }
  const baseVideoBytes = await fetchBinaryWithLimit({
    url: input.providerOutputUrl,
    maxBytes: MAX_PROVIDER_VIDEO_BYTES,
    expectedMimeTypePrefix: "video/",
  });

  if (!input.productLayer) {
    return {
      videoBytes: baseVideoBytes,
      manifest: {
        mode: "NONE",
        providerOutputUrl: input.providerOutputUrl,
        compositor: "passthrough",
        composed: false,
        layers: [],
      },
    };
  }

  const productMimeType = String(input.productLayer.assetMimeType || "").toLowerCase();
  if (productMimeType && !SUPPORTED_PRODUCT_IMAGE_MIME_TYPES.has(productMimeType)) {
    throw new Error("PRODUCT_ASSET_MIME_UNSUPPORTED");
  }
  if (input.productLayer.assetSizeBytes && input.productLayer.assetSizeBytes > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("PRODUCT_ASSET_TOO_LARGE");
  }
  const productImageBytes = await fetchBinaryWithLimit({
    url: input.productLayer.assetUrl,
    maxBytes: MAX_PRODUCT_IMAGE_BYTES,
    expectedMimeTypePrefix: "image/",
  });

  const scenes: ProductLayerScene[] = input.productLayer.scenes.length
    ? input.productLayer.scenes
    : [{
        order: 1,
        startSeconds: 0,
        endSeconds: 15,
        position: "center",
        scale: "0.35",
        opacity: 1,
        shadow: true,
        entrance: "FADE_IN",
        exit: "FADE_OUT",
        zoom: "NONE",
      }];

  const videoBytes = await runFfmpegCompose({
    baseVideoBytes,
    productImageBytes,
    scenes,
    expectedDurationSeconds: input.expectedDurationSeconds,
  });

  return {
    videoBytes,
    manifest: {
      mode: "EXACT_PRODUCT",
      providerOutputUrl: input.providerOutputUrl,
      compositor: "ffmpeg",
      composed: true,
      layers: [
        {
          type: "product",
          assetId: input.productLayer.assetId,
          assetUrl: input.productLayer.assetUrl,
          originalAssetId: input.productLayer.originalAssetId,
          locked: input.productLayer.locked,
          approvedForGeneration: input.productLayer.approvedForGeneration,
          transparentBackground: input.productLayer.transparentBackground,
          scenes,
        },
      ],
    },
  };
}

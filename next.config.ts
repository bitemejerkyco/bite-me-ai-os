import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const repoRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingIncludes: {
    "/api/ai/video-workflow": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;

import { NextRequest, NextResponse } from "next/server";
import { assertTikTokConfigured } from "@/features/integrations/tiktok/config";
import {
  decryptTikTokToken,
  redactTikTokSecrets,
} from "@/features/integrations/tiktok/token-crypto";

export async function GET(request: NextRequest) {
  try {
    const config = assertTikTokConfigured();
    const token = request.nextUrl.searchParams.get("token") || "";
    if (!token || token.length > 4096) {
      throw new Error("TIKTOK_MEDIA_INVALID:Media token is missing.");
    }
    const payload = JSON.parse(
      decryptTikTokToken(token, config.encryptionKey),
    ) as { url?: unknown; expiresAt?: unknown };
    const sourceUrl = new URL(String(payload.url || ""));
    const allowedHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host;
    if (
      sourceUrl.protocol !== "https:" ||
      sourceUrl.host !== allowedHost ||
      !sourceUrl.pathname.startsWith("/storage/v1/object/sign/brand-media/") ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      throw new Error("TIKTOK_MEDIA_INVALID:Media token is invalid or expired.");
    }
    const headers = new Headers();
    const range = request.headers.get("range");
    if (range) headers.set("range", range);
    const response = await fetch(sourceUrl, {
      headers,
      cache: "no-store",
    });
    if (!response.ok || !response.body) {
      throw new Error(`TIKTOK_MEDIA_FAILED:Video returned ${response.status}.`);
    }
    const outputHeaders = new Headers({
      "cache-control": "private, no-store",
      "content-type": response.headers.get("content-type") || "video/mp4",
      "x-content-type-options": "nosniff",
    });
    for (const name of ["content-length", "content-range", "accept-ranges"]) {
      const value = response.headers.get(name);
      if (value) outputHeaders.set(name, value);
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers: outputHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: redactTikTokSecrets(
          error instanceof Error ? error.message : String(error),
        ),
      },
      { status: 403 },
    );
  }
}

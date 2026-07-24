import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AmazonAdsIntegrationActor } from "@/features/marketing/providers/amazon-ads/live/types";
import { redactSecrets } from "@/features/marketing/providers/amazon-ads/live/token-crypto";

const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SAFE_CSRF = /^[A-Za-z0-9_-]{20,200}$/;
const SESSION_COOKIE_NAME = "biteme-auth-session";
const TEST_ACTOR_HEADER = "x-biteme-test-actor";
const TEST_CSRF_HEADER = "x-biteme-test-csrf";
const AUTH_SESSION_TTL_SECONDS = 30 * 60;

type AuthSessionPayload = {
  workspaceId: string;
  userId: string;
  csrfToken: string;
  expiresAt: string;
};

export type ResolvedAuthSession = {
  actor: AmazonAdsIntegrationActor;
  csrfToken: string;
  setCookieValue?: string;
};

export type AuthenticatedActorResolverResult = {
  session: ResolvedAuthSession | null;
  reason: string | null;
};

export type AuthenticatedActorResolver = {
  id: string;
  mode: "test" | "development-session" | "external" | "unconfigured";
  productionReady: boolean;
  resolve(request: NextRequest): AuthenticatedActorResolverResult;
};

let runtimeResolver: AuthenticatedActorResolver | null = null;

function normalizeEnvValue(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function assertSafeActor(actor: AmazonAdsIntegrationActor): void {
  if (!SAFE_ID.test(actor.workspaceId) || !SAFE_ID.test(actor.userId)) {
    throw new Error("AUTH_INVALID:workspaceId and userId must be safe identifiers.");
  }
}

function signPayload(payloadBase64Url: string, key: string): string {
  return createHmac("sha256", key).update(payloadBase64Url).digest("base64url");
}

function encodeSessionCookie(payload: AuthSessionPayload, key: string): string {
  const base64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(base64, key);
  return `v1.${base64}.${signature}`;
}

function decodeSessionCookie(value: string, key: string): AuthSessionPayload {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("AUTH_INVALID:Session cookie format is invalid.");
  }
  const payloadBase64 = parts[1];
  const receivedSignature = parts[2];
  const expectedSignature = signPayload(payloadBase64, key);
  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("AUTH_INVALID:Session signature mismatch.");
  }
  const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as AuthSessionPayload;
  if (!payload || typeof payload !== "object") {
    throw new Error("AUTH_INVALID:Session payload is invalid.");
  }
  if (!SAFE_ID.test(payload.workspaceId) || !SAFE_ID.test(payload.userId) || !SAFE_CSRF.test(payload.csrfToken)) {
    throw new Error("AUTH_INVALID:Session payload values are invalid.");
  }
  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error("AUTH_EXPIRED:Session has expired.");
  }
  return payload;
}

function parseTestActor(request: NextRequest): ResolvedAuthSession {
  const raw = request.headers.get(TEST_ACTOR_HEADER);
  if (!raw) {
    throw new Error("AUTH_REQUIRED:Missing test actor header.");
  }
  const parsed = JSON.parse(raw) as { workspaceId?: string; userId?: string };
  const actor = {
    workspaceId: normalizeEnvValue(parsed.workspaceId),
    userId: normalizeEnvValue(parsed.userId),
  };
  assertSafeActor(actor);
  const csrfToken = normalizeEnvValue(request.headers.get(TEST_CSRF_HEADER)) || randomBytes(24).toString("base64url");
  if (!SAFE_CSRF.test(csrfToken)) {
    throw new Error("AUTH_INVALID:Test CSRF token is invalid.");
  }
  return { actor, csrfToken };
}

function createDefaultResolver(): AuthenticatedActorResolver {
  if (process.env.NODE_ENV === "test") {
    return {
      id: "test-header-resolver",
      mode: "test",
      productionReady: false,
      resolve(request) {
        if (!request.headers.has(TEST_ACTOR_HEADER)) {
          return {
            session: null,
            reason: "AUTH_REQUIRED:Test actor headers are required in test mode.",
          };
        }
        return {
          session: parseTestActor(request),
          reason: null,
        };
      },
    };
  }

  if (process.env.NODE_ENV === "development") {
    return {
      id: "development-signed-session-resolver",
      mode: "development-session",
      productionReady: false,
      resolve(request) {
        const signingKey = normalizeEnvValue(process.env.BITEME_AUTH_SESSION_SIGNING_KEY);
        if (!signingKey) {
          return {
            session: null,
            reason: "AUTH_SETUP_REQUIRED:Authentication setup required.",
          };
        }

        const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
        if (cookie) {
          const payload = decodeSessionCookie(cookie, signingKey);
          return {
            session: {
              actor: { workspaceId: payload.workspaceId, userId: payload.userId },
              csrfToken: payload.csrfToken,
            },
            reason: null,
          };
        }

        const workspaceId = normalizeEnvValue(process.env.AMAZON_ADS_DEV_WORKSPACE_ID);
        const userId = normalizeEnvValue(process.env.AMAZON_ADS_DEV_USER_ID);
        if (!workspaceId || !userId) {
          return {
            session: null,
            reason: "AUTH_SETUP_REQUIRED:Authentication setup required.",
          };
        }
        const actor = { workspaceId, userId };
        assertSafeActor(actor);
        const csrfToken = randomBytes(24).toString("base64url");
        const payload: AuthSessionPayload = {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          csrfToken,
          expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000).toISOString(),
        };
        return {
          session: {
            actor,
            csrfToken,
            setCookieValue: encodeSessionCookie(payload, signingKey),
          },
          reason: null,
        };
      },
    };
  }

  return {
    id: "production-unconfigured-auth-resolver",
    mode: "unconfigured",
    productionReady: false,
    resolve() {
      return {
        session: null,
        reason: "AUTH_SETUP_REQUIRED:Authentication setup required.",
      };
    },
  };
}

export function getAuthenticatedActorResolver(): AuthenticatedActorResolver {
  return runtimeResolver ?? createDefaultResolver();
}

export function setAuthenticatedActorResolverForRuntime(resolver: AuthenticatedActorResolver | null): void {
  runtimeResolver = resolver;
}

export function resolveAuthenticationSessionOrNull(request: NextRequest): AuthenticatedActorResolverResult {
  const resolver = getAuthenticatedActorResolver();
  try {
    return resolver.resolve(request);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export function resolveAuthenticatedSession(request: NextRequest): ResolvedAuthSession {
  const resolved = resolveAuthenticationSessionOrNull(request);
  if (!resolved.session) {
    throw new Error(resolved.reason || "AUTH_REQUIRED:Authenticated server-side session is required.");
  }
  return resolved.session;
}

export function attachSessionCookie(response: NextResponse, session: ResolvedAuthSession): void {
  if (!session.setCookieValue) return;
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.setCookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: AUTH_SESSION_TTL_SECONDS,
  });
}

export function assertTrustedPostRequest(request: NextRequest): void {
  const contentType = normalizeEnvValue(request.headers.get("content-type")).toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new Error("REQUEST_INVALID:POST content-type must be application/json.");
  }
  const requestUrl = new URL(request.url);
  const origin = normalizeEnvValue(request.headers.get("origin"));
  const host = normalizeEnvValue(request.headers.get("host"));
  if (!origin || origin !== requestUrl.origin) {
    throw new Error("CSRF_ORIGIN_INVALID:Origin header does not match request host.");
  }
  if (!host || host !== requestUrl.host) {
    throw new Error("CSRF_HOST_INVALID:Host header does not match request host.");
  }
}

export function assertCsrfToken(request: NextRequest, expectedCsrfToken: string): void {
  const provided = normalizeEnvValue(request.headers.get("x-csrf-token"));
  if (!provided || !SAFE_CSRF.test(provided)) {
    throw new Error("CSRF_TOKEN_INVALID:Missing or malformed CSRF token.");
  }
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expectedCsrfToken, "utf8");
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("CSRF_TOKEN_MISMATCH:CSRF token does not match active session.");
  }
}

export function safeErrorResponse(error: unknown, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    {
      ok: false,
      error: redactSecrets(message),
    },
    { status },
  );
}

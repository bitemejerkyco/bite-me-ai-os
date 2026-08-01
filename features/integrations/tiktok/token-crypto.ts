import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
export const TIKTOK_OAUTH_STATE_COOKIE_NAME = "pm_tiktok_oauth_state";
export const TIKTOK_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("TIKTOK_SETUP_REQUIRED:Token encryption key is missing.");
  }
  const base64 = Buffer.from(trimmed, "base64");
  if (
    base64.length === 32 &&
    base64.toString("base64").replace(/=+$/u, "") ===
      trimmed.replace(/=+$/u, "")
  ) {
    return base64;
  }
  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) return utf8;
  throw new Error(
    "TIKTOK_SETUP_REQUIRED:TIKTOK_TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes.",
  );
}

export function encryptTikTokToken(token: string, rawKey: string): string {
  if (!token) throw new Error("TIKTOK_TOKEN_INVALID:Token is missing.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, parseKey(rawKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptTikTokToken(payload: string, rawKey: string): string {
  const [version, iv, authTag, ciphertext, ...extra] = payload.split(".");
  if (
    version !== VERSION ||
    !iv ||
    !authTag ||
    !ciphertext ||
    extra.length > 0
  ) {
    throw new Error("TIKTOK_TOKEN_INVALID:Encrypted token is malformed.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    parseKey(rawKey),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashOAuthState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

type TikTokOAuthStatePayload = {
  userId: string;
  workspaceId: string;
  expiresAt: number;
  nonce: string;
};

export type TikTokOAuthState = TikTokOAuthStatePayload;

export function createTikTokOAuthState(
  input: Omit<TikTokOAuthStatePayload, "nonce">,
  rawKey: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      nonce: randomBytes(16).toString("base64url"),
    } satisfies TikTokOAuthStatePayload),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", parseKey(rawKey))
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function createTikTokOAuthStateCookie(
  input: Omit<TikTokOAuthStatePayload, "nonce">,
  rawKey: string,
) {
  const value = createTikTokOAuthState(input, rawKey);
  return {
    name: TIKTOK_OAUTH_STATE_COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: TIKTOK_OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/api/integrations/tiktok/callback",
    },
  };
}

export function verifyTikTokOAuthState(
  state: string,
  rawKey: string,
): TikTokOAuthStatePayload {
  const [payload, signature, ...extra] = state.split(".");
  if (!payload || !signature || extra.length > 0) {
    throw new Error("TIKTOK_STATE_INVALID:Authorization state is malformed.");
  }
  const expected = createHmac("sha256", parseKey(rawKey))
    .update(payload)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("TIKTOK_STATE_INVALID:Authorization state signature is invalid.");
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<TikTokOAuthStatePayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.workspaceId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.nonce !== "string"
    ) {
      throw new Error("invalid payload");
    }
    return parsed as TikTokOAuthStatePayload;
  } catch {
    throw new Error("TIKTOK_STATE_INVALID:Authorization state payload is invalid.");
  }
}

export function validateTikTokOAuthState(
  cookieState: string,
  requestState: string,
  rawKey: string,
  input: {
    userId: string;
    workspaceId: string;
    now?: number;
  },
): TikTokOAuthStatePayload {
  const state = verifyTikTokOAuthState(cookieState, rawKey);
  if (cookieState !== requestState) {
    throw new Error("TIKTOK_STATE_INVALID:Authorization state does not match the cookie.");
  }
  const now = input.now ?? Date.now();
  if (
    state.userId !== input.userId ||
    state.workspaceId !== input.workspaceId ||
    state.expiresAt <= now
  ) {
    throw new Error("TIKTOK_STATE_INVALID:Authorization state is invalid or expired.");
  }
  return state;
}

export function redactTikTokSecrets(input: string): string {
  return input
    .replace(
      /(access_token|refresh_token|client_secret|code)=([^&\s]+)/giu,
      "$1=[REDACTED]",
    )
    .replace(/(bearer\s+)[a-z0-9\-._~+/]+=*/giu, "$1[REDACTED]");
}

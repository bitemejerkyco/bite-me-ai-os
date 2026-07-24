import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_FORMAT_VERSION = "v1";

function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("CONFIG_MISSING:AMAZON_ADS_TOKEN_ENCRYPTION_KEY is required.");
  }

  const base64Candidate = Buffer.from(trimmed, "base64");
  if (base64Candidate.length === 32 && base64Candidate.toString("base64").replace(/=+$/g, "") === trimmed.replace(/=+$/g, "")) {
    return base64Candidate;
  }

  const utf8Candidate = Buffer.from(trimmed, "utf8");
  if (utf8Candidate.length === 32) {
    return utf8Candidate;
  }

  throw new Error("CONFIG_INVALID:AMAZON_ADS_TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes.");
}

export function encryptRefreshToken(plaintext: string, encryptionKey: string): string {
  if (!plaintext) {
    throw new Error("TOKEN_INVALID:Refresh token is required.");
  }
  const key = parseEncryptionKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [ENCRYPTION_FORMAT_VERSION, iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptRefreshToken(payload: string, encryptionKey: string): string {
  const parts = payload.split(".");
  const legacy = parts.length === 3;
  const [version, ivPart, authTagPart, encryptedPart] = legacy
    ? [ENCRYPTION_FORMAT_VERSION, parts[0], parts[1], parts[2]]
    : parts;
  if (!legacy && version !== ENCRYPTION_FORMAT_VERSION) {
    throw new Error(`TOKEN_INVALID:Unsupported encrypted token format version (${version || "unknown"}).`);
  }
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("TOKEN_INVALID:Encrypted token payload is malformed.");
  }
  const key = parseEncryptionKey(encryptionKey);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(authTagPart, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function fingerprintToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function redactSecrets(input: string): string {
  return input
    .replace(/(access_token|refresh_token|client_secret|authorization_code)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/(bearer\s+)[a-z0-9\-._~+/]+=*/gi, "$1[REDACTED]");
}

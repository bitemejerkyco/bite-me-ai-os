type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const SECRET_KEYS = ["password", "token", "secret", "apikey", "api_key", "authorization", "cookie"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (!isObject(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (SECRET_KEYS.some((secret) => normalized.includes(secret))) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redactValue(item);
  }
  return output;
}

function write(level: LogLevel, message: string, meta?: LogMeta) {
  if (process.env.NODE_ENV === "production" && level === "info") return;

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: redactValue(meta) } : {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    write("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write("warn", message, meta);
  },
  error(message: string, meta?: LogMeta) {
    write("error", message, meta);
  },
};

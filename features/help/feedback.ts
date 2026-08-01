export function redactFeedbackDescription(value: string): string {
  return value
    .replace(/bearer\s+[a-z0-9._-]+/giu, "[redacted-token]")
    .replace(/sk_(live|test)_[a-z0-9]+/giu, "[redacted-key]")
    .replace(/pk_(live|test)_[a-z0-9]+/giu, "[redacted-key]")
    .replace(/api[_-]?key\s*[:=]\s*[^\s,;&]+/giu, "api_key=[redacted]")
    .replace(/token\s*[:=]\s*[^\s,;&]+/giu, "token=[redacted]")
    .replace(/password\s*[:=]\s*[^\s,;&]+/giu, "password=[redacted]")
    .slice(0, 2000);
}

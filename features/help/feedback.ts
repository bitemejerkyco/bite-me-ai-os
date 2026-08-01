export function redactFeedbackDescription(value: string): string {
  return value
    .replace(/bearer\s+[a-z0-9._-]+/giu, "[redacted-token]")
    .replace(/sk_(live|test)_[a-z0-9]+/giu, "[redacted-key]")
    .replace(/pk_(live|test)_[a-z0-9]+/giu, "[redacted-key]")
    .slice(0, 2000);
}

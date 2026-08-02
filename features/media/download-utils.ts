export function extractFileNameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = disposition.match(/filename="?([^\";]+)"?/i);
  return plainMatch?.[1] || null;
}

export function isLikelyExpiredSignedUrlFailure(status: number, bodyText: string): boolean {
  if (status !== 401 && status !== 403) return false;
  const normalized = bodyText.toLowerCase();
  return (
    normalized.includes("expired")
    || normalized.includes("token")
    || normalized.includes("signature")
    || normalized.includes("jwt")
    || normalized.includes("authorization")
  );
}

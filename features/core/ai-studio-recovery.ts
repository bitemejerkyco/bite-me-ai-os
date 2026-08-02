import type { ContentDraft } from "@/features/core/local-os";

const RECOVERY_KEY_PREFIX = "postmotive:ai-studio:recovery";

export type AIStudioRecoveryState = {
  entryType: "POST" | "AD";
  channel: string;
  objective: string;
  offer: string;
  callToAction: string;
  result: ContentDraft | null;
  savedAt: string;
};

export function aiStudioRecoveryKey(workspaceId?: string | null): string {
  return workspaceId
    ? `${RECOVERY_KEY_PREFIX}:${workspaceId}`
    : RECOVERY_KEY_PREFIX;
}

export function saveAIStudioRecovery(
  state: AIStudioRecoveryState,
  workspaceId?: string | null,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(aiStudioRecoveryKey(workspaceId), JSON.stringify(state));
}

export function loadAIStudioRecovery(
  workspaceId?: string | null,
): AIStudioRecoveryState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(aiStudioRecoveryKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AIStudioRecoveryState>;
    if (
      !parsed
      || (parsed.entryType !== "POST" && parsed.entryType !== "AD")
      || typeof parsed.channel !== "string"
      || typeof parsed.objective !== "string"
      || typeof parsed.offer !== "string"
      || typeof parsed.callToAction !== "string"
      || typeof parsed.savedAt !== "string"
    ) {
      return null;
    }

    return {
      entryType: parsed.entryType,
      channel: parsed.channel,
      objective: parsed.objective,
      offer: parsed.offer,
      callToAction: parsed.callToAction,
      result: (parsed.result as ContentDraft | null) || null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearAIStudioRecovery(workspaceId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(aiStudioRecoveryKey(workspaceId));
}

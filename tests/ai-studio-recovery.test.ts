import { beforeEach, describe, expect, it } from "vitest";
import {
  aiStudioRecoveryKey,
  clearAIStudioRecovery,
  loadAIStudioRecovery,
  saveAIStudioRecovery,
} from "@/features/core/ai-studio-recovery";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: localStorageMock,
    },
  });
});

describe("ai studio recovery", () => {
  it("builds workspace-scoped recovery keys", () => {
    expect(aiStudioRecoveryKey("workspace-1")).toBe("postmotive:ai-studio:recovery:workspace-1");
    expect(aiStudioRecoveryKey()).toBe("postmotive:ai-studio:recovery");
  });

  it("saves and restores recovery payload", () => {
    saveAIStudioRecovery(
      {
        entryType: "POST",
        channel: "instagram",
        objective: "Drive engagement",
        offer: "Free shipping",
        callToAction: "Shop now",
        result: null,
        savedAt: "2026-08-02T10:00:00.000Z",
      },
      "workspace-1",
    );

    expect(loadAIStudioRecovery("workspace-1")).toEqual({
      entryType: "POST",
      channel: "instagram",
      objective: "Drive engagement",
      offer: "Free shipping",
      callToAction: "Shop now",
      result: null,
      savedAt: "2026-08-02T10:00:00.000Z",
    });
  });

  it("clears saved recovery payload", () => {
    saveAIStudioRecovery(
      {
        entryType: "AD",
        channel: "facebook",
        objective: "Generate sales",
        offer: "BOGO",
        callToAction: "Buy now",
        result: null,
        savedAt: "2026-08-02T10:00:00.000Z",
      },
      "workspace-2",
    );

    clearAIStudioRecovery("workspace-2");
    expect(loadAIStudioRecovery("workspace-2")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { trackEvent } from "@/lib/analytics";

describe("trackEvent", () => {
  it("returns accepted metadata", () => {
    const result = trackEvent("mission_control_viewed", { source: "test" });

    expect(result.accepted).toBe(true);
    expect(result.event).toBe("mission_control_viewed");
    expect(typeof result.timestamp).toBe("string");
  });
});

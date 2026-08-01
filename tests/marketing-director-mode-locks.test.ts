import { describe, expect, it } from "vitest";
import { resolveOperatingMode } from "@/features/marketing-director/mode-locks";

describe("marketing director mode locks", () => {
  it("keeps advisor available", () => {
    expect(resolveOperatingMode("advisor", false)).toBe("advisor");
    expect(resolveOperatingMode("advisor", true)).toBe("advisor");
  });

  it("locks copilot and autopilot without entitlement", () => {
    expect(resolveOperatingMode("copilot", false)).toBe("advisor");
    expect(resolveOperatingMode("autopilot", false)).toBe("advisor");
  });

  it("allows copilot and autopilot when entitlement is enabled", () => {
    expect(resolveOperatingMode("copilot", true)).toBe("copilot");
    expect(resolveOperatingMode("autopilot", true)).toBe("autopilot");
  });
});

import { describe, expect, it } from "vitest";
import { usageRightsStatus } from "@/features/media/media-url-resolver";

describe("media library workflows", () => {
  it("marks usage rights as expired when end date has passed", () => {
    const status = usageRightsStatus(
      "2026-07-01",
      "2026-07-31",
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(status).toBe("EXPIRED");
  });

  it("marks usage rights as expiring when within seven days", () => {
    const status = usageRightsStatus(
      "2026-07-01",
      "2026-08-03",
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(status).toBe("EXPIRING");
  });

  it("keeps usage rights active for long horizons", () => {
    const status = usageRightsStatus(
      "2026-07-01",
      "2026-12-31",
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(status).toBe("ACTIVE");
  });
});

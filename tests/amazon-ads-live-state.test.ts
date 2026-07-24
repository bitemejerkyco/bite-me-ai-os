import { describe, expect, it } from "vitest";
import { AmazonAdsOAuthStateStore } from "@/features/marketing/providers/amazon-ads/live/state-store";

describe("Amazon Ads OAuth state store", () => {
  it("creates random single-use state bound to actor", () => {
    const store = new AmazonAdsOAuthStateStore();
    const actor = { workspaceId: "ws_live_1", userId: "user_1" };
    const created = store.create({
      actor,
      connectionId: "conn_1",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 60_000,
    });

    expect(created.state).toBeTruthy();
    expect(created.workspaceId).toBe(actor.workspaceId);
    expect(created.userId).toBe(actor.userId);
    expect(created.consumedAt).toBeNull();

    const consumed = store.consume({
      state: created.state,
      actor,
      now: new Date("2026-07-23T12:00:20.000Z"),
    });
    expect(consumed.consumedAt).toBe("2026-07-23T12:00:20.000Z");
  });

  it("rejects missing, reused, expired, and mismatched state", () => {
    const store = new AmazonAdsOAuthStateStore();
    const actor = { workspaceId: "ws_live_2", userId: "user_2" };
    const created = store.create({
      actor,
      connectionId: "conn_2",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 1000,
    });

    expect(() =>
      store.consume({
        state: "does-not-exist",
        actor,
      }),
    ).toThrow("OAUTH_STATE_MISSING");

    expect(() =>
      store.consume({
        state: created.state,
        actor: { workspaceId: "ws_other", userId: "user_2" },
        now: new Date("2026-07-23T12:00:00.500Z"),
      }),
    ).toThrow("OAUTH_STATE_MISMATCH");

    expect(() =>
      store.consume({
        state: created.state,
        actor,
        now: new Date("2026-07-23T12:00:01.500Z"),
      }),
    ).toThrow("OAUTH_STATE_EXPIRED");

    const reusable = store.create({
      actor,
      connectionId: "conn_3",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 60_000,
    });
    store.consume({
      state: reusable.state,
      actor,
      now: new Date("2026-07-23T12:00:05.000Z"),
    });
    expect(() =>
      store.consume({
        state: reusable.state,
        actor,
        now: new Date("2026-07-23T12:00:10.000Z"),
      }),
    ).toThrow("OAUTH_STATE_REUSED");
  });
});

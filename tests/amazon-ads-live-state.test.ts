import { describe, expect, it } from "vitest";
import {
  createAmazonAdsOAuthStateStoreForTests,
  createAmazonAdsOAuthStateStoreForRuntime,
} from "@/features/marketing/providers/amazon-ads/live/state-store";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Amazon Ads OAuth state store", () => {
  it("creates random single-use state bound to actor", async () => {
    const store = createAmazonAdsOAuthStateStoreForTests();
    const actor = { workspaceId: "ws_live_1", userId: "user_1" };
    const created = await store.create({
      actor,
      connectionId: "conn_1",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 60_000,
    });

    expect(created.state).toBeTruthy();
    expect(created.workspaceId).toBe(actor.workspaceId);
    expect(created.userId).toBe(actor.userId);
    expect(created.consumedAt).toBeNull();

    const consumed = await store.consume({
      state: created.state,
      actor,
      now: new Date("2026-07-23T12:00:20.000Z"),
    });
    expect(consumed.consumedAt).toBe("2026-07-23T12:00:20.000Z");
  });

  it("rejects missing, reused, expired, and mismatched state", async () => {
    const store = createAmazonAdsOAuthStateStoreForTests();
    const actor = { workspaceId: "ws_live_2", userId: "user_2" };
    const created = await store.create({
      actor,
      connectionId: "conn_2",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 1000,
    });

    await expect(
      store.consume({
        state: "does-not-exist",
        actor,
      }),
    ).rejects.toThrow("OAUTH_STATE_MISSING");

    await expect(
      store.consume({
        state: created.state,
        actor: { workspaceId: "ws_other", userId: "user_2" },
        now: new Date("2026-07-23T12:00:00.500Z"),
      }),
    ).rejects.toThrow("OAUTH_STATE_MISMATCH");

    await expect(
      store.consume({
        state: created.state,
        actor: { workspaceId: "ws_live_2", userId: "user_other" },
        now: new Date("2026-07-23T12:00:00.500Z"),
      }),
    ).rejects.toThrow("OAUTH_STATE_MISMATCH");

    await expect(
      store.consume({
        state: created.state,
        actor,
        now: new Date("2026-07-23T12:00:01.500Z"),
      }),
    ).rejects.toThrow("OAUTH_STATE_EXPIRED");

    const reusable = await store.create({
      actor,
      connectionId: "conn_3",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 60_000,
    });
    await store.consume({
      state: reusable.state,
      actor,
      now: new Date("2026-07-23T12:00:05.000Z"),
    });
    await expect(
      store.consume({
        state: reusable.state,
        actor,
        now: new Date("2026-07-23T12:00:10.000Z"),
      }),
    ).rejects.toThrow("OAUTH_STATE_REUSED");
  });

  it("rejects concurrent replay attempts and supports persistent runtime storage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amazon-ads-state-"));
    const store = createAmazonAdsOAuthStateStoreForRuntime(join(dir, "oauth-state.json"));
    const actor = { workspaceId: "ws_live_concurrent", userId: "user_concurrent" };
    const created = await store.create({
      actor,
      connectionId: "conn_concurrent",
      now: new Date("2026-07-23T12:00:00.000Z"),
      ttlMs: 60_000,
    });

    const one = store.consume({ state: created.state, actor, now: new Date("2026-07-23T12:00:01.000Z") });
    const two = store.consume({ state: created.state, actor, now: new Date("2026-07-23T12:00:01.000Z") });
    const settled = await Promise.allSettled([one, two]);
    const fulfilled = settled.filter((row) => row.status === "fulfilled");
    const rejected = settled.filter((row) => row.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toContain("OAUTH_STATE_REUSED");

    await rm(dir, { recursive: true, force: true });
  });
});

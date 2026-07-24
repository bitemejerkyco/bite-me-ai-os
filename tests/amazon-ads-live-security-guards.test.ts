import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  assertCsrfToken,
  assertTrustedPostRequest,
  getAuthenticatedActorResolver,
  resolveAuthenticatedSession,
} from "@/app/api/integrations/amazon-ads/_lib";

function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  const previousNodeEnv = process.env.NODE_ENV;
  if (values.NODE_ENV !== undefined) {
    process.env.NODE_ENV = values.NODE_ENV;
  }
  try {
    return run();
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("Amazon Ads live auth and request security guards", () => {
  it("fails closed in production when no authenticated session cookie exists", () => {
    withEnv(
      {
        NODE_ENV: "production",
      },
      () => {
        const request = new NextRequest("https://example.com/api/integrations/amazon-ads/status");
        expect(() => resolveAuthenticatedSession(request)).toThrow("AUTH_SETUP_REQUIRED");
      },
    );
  });

  it("uses the expected resolver mode by environment", () => {
    withEnv({ NODE_ENV: "production" }, () => {
      expect(getAuthenticatedActorResolver().mode).toBe("unconfigured");
      expect(getAuthenticatedActorResolver().productionReady).toBe(false);
    });
    withEnv({ NODE_ENV: "development" }, () => {
      expect(getAuthenticatedActorResolver().mode).toBe("development-session");
      expect(getAuthenticatedActorResolver().productionReady).toBe(false);
    });
    withEnv({ NODE_ENV: "test" }, () => {
      expect(getAuthenticatedActorResolver().mode).toBe("test");
      expect(getAuthenticatedActorResolver().productionReady).toBe(false);
    });
  });

  it("allows test actor injection only in test mode", () => {
    const request = new NextRequest("https://example.com/api/integrations/amazon-ads/status", {
      headers: {
        "x-biteme-test-actor": JSON.stringify({ workspaceId: "ws_test", userId: "user_test" }),
        "x-biteme-test-csrf": "csrf_test_value_1234567890",
      },
    });
    withEnv(
      {
        NODE_ENV: "test",
        BITEME_AUTH_SESSION_SIGNING_KEY: "test-session-signing-key",
      },
      () => {
        const session = resolveAuthenticatedSession(request);
        expect(session.actor.workspaceId).toBe("ws_test");
        expect(session.actor.userId).toBe("user_test");
      },
    );
  });

  it("returns signed dev session fallback only outside production", () => {
    withEnv(
      {
        NODE_ENV: "development",
        BITEME_AUTH_SESSION_SIGNING_KEY: "test-session-signing-key",
        AMAZON_ADS_DEV_WORKSPACE_ID: "ws_dev",
        AMAZON_ADS_DEV_USER_ID: "user_dev",
      },
      () => {
        const request = new NextRequest("http://localhost:3000/api/integrations/amazon-ads/status");
        const session = resolveAuthenticatedSession(request);
        expect(session.actor.workspaceId).toBe("ws_dev");
        expect(session.actor.userId).toBe("user_dev");
        expect(session.setCookieValue).toBeTruthy();
      },
    );
  });

  it("rejects development resolver when actor variables are not configured", () => {
    withEnv(
      {
        NODE_ENV: "development",
        BITEME_AUTH_SESSION_SIGNING_KEY: "test-session-signing-key",
        AMAZON_ADS_DEV_WORKSPACE_ID: undefined,
        AMAZON_ADS_DEV_USER_ID: undefined,
      },
      () => {
        const request = new NextRequest("http://localhost:3000/api/integrations/amazon-ads/status");
        expect(() => resolveAuthenticatedSession(request)).toThrow("AUTH_SETUP_REQUIRED");
      },
    );
  });

  it("validates POST origin, host, and content type", () => {
    const request = new NextRequest("https://example.com/api/integrations/amazon-ads/select-profile", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        host: "example.com",
        "content-type": "application/json",
        "x-csrf-token": "csrf_valid_token_1234567890",
      },
      body: JSON.stringify({}),
    });
    expect(() => assertTrustedPostRequest(request)).not.toThrow();
  });

  it("rejects CSRF mismatch", () => {
    const request = new NextRequest("https://example.com/api/integrations/amazon-ads/disconnect", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        host: "example.com",
        "content-type": "application/json",
        "x-csrf-token": "csrf_wrong_token_1234567890",
      },
      body: JSON.stringify({}),
    });
    expect(() => assertCsrfToken(request, "csrf_expected_token_1234567890")).toThrow("CSRF_TOKEN_MISMATCH");
  });
});

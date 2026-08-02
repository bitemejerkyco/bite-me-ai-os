import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  NODE_ENV: process.env.NODE_ENV,
};

function mutableEnv(): Record<string, string | undefined> {
  return process.env as Record<string, string | undefined>;
}

function restoreEnv(): void {
  const env = mutableEnv();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
}

async function loadEnvModule() {
  vi.resetModules();
  return import("@/lib/env");
}

afterEach(() => {
  restoreEnv();
});

describe("environment validation", () => {
  it("uses the anon key fallback for public supabase config", async () => {
    const processEnv = mutableEnv();
    processEnv.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete processEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    delete processEnv.NEXT_PUBLIC_APP_URL;
    delete processEnv.VERCEL_URL;

    const envModule = await loadEnvModule();
    expect(envModule.getSupabasePublicConfig()).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "anon-key",
    });
    expect(envModule.getAppOrigin()).toBe("http://localhost:3000");
  });

  it("throws a safe error when the service role key is missing", async () => {
    const processEnv = mutableEnv();
    processEnv.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    processEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    delete processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete processEnv.SUPABASE_SERVICE_ROLE_KEY;

    const envModule = await loadEnvModule();
    expect(() => envModule.getServerEnv()).toThrow(/ENV_CONFIG_MISSING:server:SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("derives the app origin from Vercel in non-local environments", async () => {
    const processEnv = mutableEnv();
    processEnv.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    processEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    processEnv.VERCEL_URL = "postmotive-ai1.vercel.app";
    delete processEnv.NEXT_PUBLIC_APP_URL;

    const envModule = await loadEnvModule();
    expect(envModule.getAppOrigin()).toBe("https://postmotive-ai1.vercel.app");
  });

  it("fails safely when production has no app origin configured", async () => {
    const processEnv = mutableEnv();
    processEnv.NODE_ENV = "production";
    processEnv.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    processEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    delete processEnv.NEXT_PUBLIC_APP_URL;
    delete processEnv.VERCEL_URL;

    const envModule = await loadEnvModule();
    expect(() => envModule.getAppOrigin()).toThrow(/ENV_CONFIG_MISSING:public:NEXT_PUBLIC_APP_URL or VERCEL_URL/);
  });
});
import { describe, expect, it } from "vitest";
import { validateEnv } from "@/lib/env";

describe("validateEnv", () => {
  it("accepts empty optional values for setup mode", () => {
    const values = validateEnv({
      DATABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    });

    expect(values.DATABASE_URL).toBeUndefined();
    expect(values.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("throws for malformed URL values", () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: "not-a-url",
      })
    ).toThrow("Invalid environment configuration");
  });
});

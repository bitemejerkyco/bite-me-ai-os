import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL").optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL").optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional().or(z.literal("")),
  OPENAI_API_KEY: z.string().min(1).optional().or(z.literal("")),
  ANTHROPIC_API_KEY: z.string().min(1).optional().or(z.literal("")),
});

export function validateEnv(raw: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse({
    DATABASE_URL: raw.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: raw.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: raw.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: raw.ANTHROPIC_API_KEY,
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  return {
    DATABASE_URL: parsed.data.DATABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: parsed.data.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY || undefined,
    OPENAI_API_KEY: parsed.data.OPENAI_API_KEY || undefined,
    ANTHROPIC_API_KEY: parsed.data.ANTHROPIC_API_KEY || undefined,
  } as const;
}

let values: ReturnType<typeof validateEnv>;
try {
  values = validateEnv(process.env as Record<string, string | undefined>);
} catch (error) {
  if (process.env.NODE_ENV !== "production") {
    throw error;
  }
  values = {
    DATABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    OPENAI_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
  };
}

const supabasePublicKey = values.NEXT_PUBLIC_SUPABASE_ANON_KEY || values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const env = {
  DATABASE_URL: values.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: values.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: values.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: values.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: values.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: values.ANTHROPIC_API_KEY,
  SUPABASE_PUBLIC_KEY: supabasePublicKey,
} as const;

export const isDatabaseConfigured = Boolean(env.DATABASE_URL);
export const isSupabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_PUBLIC_KEY);
export const isSupabaseServiceConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().default(""),
});

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

const fallbackEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export const env = parsedEnv.success ? parsedEnv.data : fallbackEnv;

const urlSchema = z.string().url();
const isValidUrl = (value: string) => urlSchema.safeParse(value).success;

export const isDatabaseConfigured = env.DATABASE_URL.length > 0;
export const isSupabaseConfigured =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 0 && isValidUrl(env.NEXT_PUBLIC_SUPABASE_URL);

if (process.env.NODE_ENV !== "production" && env.NEXT_PUBLIC_SUPABASE_URL && !isSupabaseConfigured) {
  console.warn(
    "[bite-me-ai-os] Supabase environment variables are incomplete or invalid. Falling back to local demo mode.",
  );
}

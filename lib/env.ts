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

if (!parsedEnv.success && process.env.NODE_ENV !== "production") {
  console.warn("[bite-me-ai-os] Environment parsing failed. Falling back to raw environment values.");
}

export const env = parsedEnv.success ? parsedEnv.data : fallbackEnv;
export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} as const;
export const serverEnv = {
  DATABASE_URL: env.DATABASE_URL,
} as const;

const urlSchema = z.string().url();
const isValidUrl = (value: string) => urlSchema.safeParse(value).success;

export const isDatabaseConfigured = serverEnv.DATABASE_URL.length > 0;
export const isSupabaseConfigured =
  publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 0 &&
  isValidUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL);

if (process.env.NODE_ENV !== "production" && publicEnv.NEXT_PUBLIC_SUPABASE_URL && !isSupabaseConfigured) {
  console.warn(
    "[bite-me-ai-os] Supabase environment variables are incomplete or invalid. Falling back to local demo mode.",
  );
}

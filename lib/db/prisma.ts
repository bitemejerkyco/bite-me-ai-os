import { getPrismaClient } from "@/lib/prisma";
import { env, isDatabaseConfigured } from "@/lib/env";

export function getPrisma() {
  if (!isDatabaseConfigured || !env.DATABASE_URL) {
    throw new Error("Database is not configured. Set DATABASE_URL before using Prisma.");
  }
  return getPrismaClient();
}

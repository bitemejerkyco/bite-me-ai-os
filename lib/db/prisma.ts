import { PrismaClient } from "@/app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env, isDatabaseConfigured } from "@/lib/env";

declare global {
  var __postmotivePrismaClient__: PrismaClient | undefined;
  var __postmotivePgPool__: Pool | undefined;
}

export function getPrisma() {
  if (!isDatabaseConfigured || !env.DATABASE_URL) {
    throw new Error("Database is not configured. Set DATABASE_URL before using Prisma.");
  }

  if (!globalThis.__postmotivePgPool__) {
    globalThis.__postmotivePgPool__ = new Pool({ connectionString: env.DATABASE_URL });
  }

  if (!globalThis.__postmotivePrismaClient__) {
    const adapter = new PrismaPg(globalThis.__postmotivePgPool__);
    globalThis.__postmotivePrismaClient__ = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalThis.__postmotivePrismaClient__;
}

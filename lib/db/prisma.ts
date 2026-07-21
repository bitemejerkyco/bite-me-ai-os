import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env, isDatabaseConfigured } from "@/lib/env";

declare global {
  var prismaInstance: PrismaClient | null | undefined;
}

function createPrismaClient() {
  if (!isDatabaseConfigured) {
    return null;
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.prismaInstance ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaInstance = prisma;
}

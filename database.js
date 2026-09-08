import { PrismaClient } from "@prisma/client";

let prisma = null;

export class DatabaseUnavailableError extends Error {
  constructor(message = "DATABASE_URL is required to use API Builder, proxy pools, and profile manager.") {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.code = "DATABASE_UNAVAILABLE";
  }
}

export function databaseConfigured() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

export function getPrisma() {
  if (!databaseConfigured()) {
    throw new DatabaseUnavailableError();
  }

  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.PRISMA_LOG_QUERIES === "true" ? ["warn", "error", "query"] : ["warn", "error"]
    });
  }
  return prisma;
}

export async function getDatabaseStatus() {
  if (!databaseConfigured()) {
    return { configured: false, connected: false, error: "DATABASE_URL is not set" };
  }

  try {
    // A simple connection check is not enough: the API Builder also needs its
    // Prisma migration to be present before it can safely accept requests.
    await getPrisma().api.findFirst({ select: { id: true } });
    return { configured: true, connected: true, error: null };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err?.message || "PostgreSQL connection failed"
    };
  }
}

export async function disconnectDatabase() {
  if (!prisma) return;
  await prisma.$disconnect().catch(() => {});
  prisma = null;
}

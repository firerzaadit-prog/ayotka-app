import { PrismaClient } from "@prisma/client";

// Hindari membuat banyak koneksi PrismaClient tiap hot-reload di dev
// (pola standar Next.js App Router).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

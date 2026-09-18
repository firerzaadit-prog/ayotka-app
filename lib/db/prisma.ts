import { PrismaClient } from "@prisma/client";

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  // Jika menggunakan pooler Supabase (port 6543) tanpa pgbouncer=true,
  // Prisma akan memakai prepared statements yang tidak didukung PgBouncer/Supavisor
  // dalam mode transaksi dan memicu error Postgres 26000: "prepared statement does not exist".
  if (url.includes(":6543") && !url.includes("pgbouncer=true")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}pgbouncer=true`;
  }
  return url;
}

const dbUrl = getDatabaseUrl();
const configKey = dbUrl ?? "default";

// Hindari membuat banyak koneksi PrismaClient tiap hot-reload di dev
// (pola standar Next.js App Router).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConfigKey: string | undefined;
};

if (globalForPrisma.prisma && globalForPrisma.prismaConfigKey !== configKey) {
  globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    dbUrl
      ? {
          datasources: {
            db: { url: dbUrl },
          },
        }
      : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConfigKey = configKey;
}


import { PrismaClient } from "@prisma/client";

/**
 * connection_limit=1 di serverless (Vercel) - rekomendasi resmi Prisma untuk
 * konek lewat PgBouncer/Supavisor mode transaksi: tiap invocation function
 * bisa jadi instance baru, dan tanpa batas ini Prisma defaultnya membuka
 * banyak koneksi SEKALIGUS per instance (default Prisma: num_cpus*2+1) -
 * kalau ribuan instance serverless aktif bersamaan (mis. Try Out Nasional),
 * itu bisa menghabiskan jatah koneksi PgBouncer/Supavisor dalam hitungan
 * detik walau ukuran compute Supabase-nya besar. Dengan connection_limit=1,
 * tiap instance cuma pegang 1 koneksi selagi ada transaksi berjalan -
 * PgBouncer sendiri yang memultipleks lintas banyak instance. Bisa dinaikkan
 * lewat DATABASE_CONNECTION_LIMIT kalau load test (lihat scripts/load-test)
 * membuktikan perlu, tapi jangan naikkan tanpa data nyata dari situ.
 */
const DEFAULT_SERVERLESS_CONNECTION_LIMIT = process.env.DATABASE_CONNECTION_LIMIT || "1";

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (!url.includes(":6543")) return url;

  let result = url;
  // Jika menggunakan pooler Supabase (port 6543) tanpa pgbouncer=true,
  // Prisma akan memakai prepared statements yang tidak didukung PgBouncer/Supavisor
  // dalam mode transaksi dan memicu error Postgres 26000: "prepared statement does not exist".
  if (!result.includes("pgbouncer=true")) {
    const separator = result.includes("?") ? "&" : "?";
    result = `${result}${separator}pgbouncer=true`;
  }
  if (!result.includes("connection_limit=")) {
    result = `${result}&connection_limit=${DEFAULT_SERVERLESS_CONNECTION_LIMIT}`;
  }
  return result;
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


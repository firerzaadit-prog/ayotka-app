import { prisma } from "@/lib/db/prisma";

/**
 * Status maintenance dibaca lewat Prisma (tabel app_settings, baris "global"), BUKAN lewat REST Supabase seperti dulu:
 * proxy jalan di runtime Node.js, jadi boleh memakai Prisma langsung, dan dengan begitu pemeriksaan ini tidak
 * bergantung pada layanan API Supabase (yang bisa dibatasi/mati terpisah dari database-nya).
 *
 * Hasilnya disimpan sebentar di memori supaya tidak menambah satu query di setiap request: toggle maintenance berlaku
 * paling lambat CACHE_MS setelah disimpan.
 */
export const MAINTENANCE_CACHE_MS = 10_000;

export type PengaturanMaintenance = { at: number; mode: boolean; secret: string | null };

let cache: PengaturanMaintenance | null = null;

export async function bacaPengaturanMaintenance(sekarang: number = Date.now()): Promise<PengaturanMaintenance | null> {
  if (cache && sekarang - cache.at < MAINTENANCE_CACHE_MS) return cache;
  try {
    const baris = await prisma.appSetting.findUnique({
      where: { id: "global" },
      select: { maintenanceMode: true, maintenanceBypassSecret: true },
    });
    cache = { at: sekarang, mode: Boolean(baris?.maintenanceMode), secret: baris?.maintenanceBypassSecret || null };
    return cache;
  } catch {
    // Query gagal sesaat: pakai nilai terakhir yang diketahui (null kalau belum pernah berhasil).
    return cache;
  }
}

/** Hanya untuk tes: kosongkan cache antar kasus uji. */
export function resetCachePengaturanMaintenance() {
  cache = null;
}

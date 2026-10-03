import type { PermintaanPerpanjangan, Prisma, PrismaClient } from "@prisma/client";

/**
 * Permintaan perpanjangan langganan dari admin sekolah (halaman Periode Baru). Pembayaran dikonfirmasi di luar
 * sistem, jadi permintaan ini hanya penanda "sekolah ingin lanjut": admin pusat yang membuat periode barunya
 * (permintaan lalu ditandai disetujui dan ditautkan ke periode itu) atau menolaknya dengan alasan. Satu sekolah
 * hanya boleh punya satu permintaan yang menunggu.
 *
 * Tanpa `server-only` dan dependensi database disuntikkan (boleh klien transaksi), seperti lib/billing/periode-sekolah.ts.
 */
type DbPermintaan = Pick<PrismaClient, "permintaanPerpanjangan"> | Prisma.TransactionClient;

export class PermintaanTidakValidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermintaanTidakValidError";
  }
}

export type InputPermintaan = {
  schoolId: string;
  diajukanOlehId: string | null;
  kuotaDiminta: number;
  /** Awal hari WIB. */
  mulai: Date;
  /** Akhir hari WIB. */
  berakhir: Date;
  catatan?: string | null;
};

export async function ajukanPermintaan(db: DbPermintaan, input: InputPermintaan): Promise<PermintaanPerpanjangan> {
  if (input.berakhir.getTime() < input.mulai.getTime()) {
    throw new PermintaanTidakValidError("Tanggal berakhir tidak boleh sebelum tanggal mulai.");
  }
  const menunggu = await db.permintaanPerpanjangan.findFirst({
    where: { schoolId: input.schoolId, status: "menunggu" },
    select: { id: true },
  });
  if (menunggu) {
    throw new PermintaanTidakValidError(
      "Sudah ada permintaan perpanjangan yang menunggu diproses admin pusat. Tunggu sampai diproses sebelum mengajukan lagi.",
    );
  }
  return db.permintaanPerpanjangan.create({
    data: {
      schoolId: input.schoolId,
      diajukanOlehId: input.diajukanOlehId,
      kuotaDiminta: input.kuotaDiminta,
      mulaiDiminta: input.mulai,
      berakhirDiminta: input.berakhir,
      catatan: input.catatan?.trim() ? input.catatan.trim() : null,
    },
  });
}

export function ambilPermintaanMenunggu(db: DbPermintaan, schoolId: string) {
  return db.permintaanPerpanjangan.findFirst({ where: { schoolId, status: "menunggu" }, orderBy: { createdAt: "desc" } });
}

/** Permintaan terakhir yang sudah diproses (disetujui/ditolak), untuk menampilkan alasan penolakan ke admin sekolah. */
export function ambilPermintaanTerakhirDiproses(db: DbPermintaan, schoolId: string) {
  return db.permintaanPerpanjangan.findFirst({
    where: { schoolId, status: { not: "menunggu" } },
    orderBy: { ditanganiAt: "desc" },
  });
}

/** Tandai disetujui dan tautkan ke periode yang baru dibuat. Dipanggil di transaksi yang sama dengan pembuatan periode. */
export async function setujuiPermintaan(
  db: DbPermintaan,
  input: { permintaanId: string; schoolId: string; periodeId: string; adminId: string },
  now: Date = new Date(),
): Promise<PermintaanPerpanjangan> {
  const p = await db.permintaanPerpanjangan.findUnique({ where: { id: input.permintaanId } });
  if (!p || p.schoolId !== input.schoolId) throw new PermintaanTidakValidError("Permintaan perpanjangan tidak ditemukan untuk sekolah ini.");
  if (p.status !== "menunggu") throw new PermintaanTidakValidError("Permintaan perpanjangan ini sudah diproses.");
  return db.permintaanPerpanjangan.update({
    where: { id: p.id },
    data: { status: "disetujui", periodeId: input.periodeId, ditanganiOlehId: input.adminId, ditanganiAt: now },
  });
}

export async function tolakPermintaan(
  db: DbPermintaan,
  input: { permintaanId: string; adminId: string; catatanAdmin?: string | null },
  now: Date = new Date(),
): Promise<PermintaanPerpanjangan> {
  const p = await db.permintaanPerpanjangan.findUnique({ where: { id: input.permintaanId } });
  if (!p) throw new PermintaanTidakValidError("Permintaan perpanjangan tidak ditemukan.");
  if (p.status !== "menunggu") throw new PermintaanTidakValidError("Permintaan perpanjangan ini sudah diproses.");
  return db.permintaanPerpanjangan.update({
    where: { id: p.id },
    data: {
      status: "ditolak",
      ditanganiOlehId: input.adminId,
      ditanganiAt: now,
      catatanAdmin: input.catatanAdmin?.trim() ? input.catatanAdmin.trim() : null,
    },
  });
}

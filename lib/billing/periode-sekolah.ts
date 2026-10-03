import type { Prisma, PrismaClient, PeriodeLangganan } from "@prisma/client";
import { formatWIBDate } from "../utils/datetime";

/**
 * Periode langganan (kursi) sekolah. Satu-satunya tempat aturan waktu periode dan operasi buat/ubah/cabut
 * periode; kursi siswa dihitung per periode (lib/billing/entitlements.ts). Perpanjangan = periode BARU,
 * bukan menimpa tanggal lama - dulu menimpa School.validUntil tidak ikut memperpanjang kursi siswa dan kursi
 * lama yang sudah kedaluwarsa tetap dihitung terpakai, sehingga siswa lama kena "kuota penuh".
 *
 * Tanpa `server-only` dan dependensi database disuntikkan (`db` boleh PrismaClient atau klien transaksi), supaya
 * bisa dipakai di dalam transaksi, skrip, dan tes. Impor memakai jalur relatif demi skrip tsx.
 */

export const TENGGANG_DEFAULT_HARI = 14;
export const TENGGANG_MAKS_HARI = 90;
const HARI_MS = 24 * 60 * 60 * 1000;

/** `dicabut` = dibatalkan admin pusat (salah input); tidak pernah dihitung sebagai periode. */
export type StatusPeriode = "akan_datang" | "aktif" | "tenggang" | "berakhir" | "dicabut";

export type PeriodeWaktu = Pick<PeriodeLangganan, "mulai" | "berakhir" | "masaTenggangHari" | "dicabutAt">;

/** Batas terakhir siswa masih boleh mulai ujian: akhir periode + masa tenggang. */
export function akhirEfektif(p: Pick<PeriodeLangganan, "berakhir" | "masaTenggangHari">): Date {
  return new Date(p.berakhir.getTime() + p.masaTenggangHari * HARI_MS);
}

/**
 * Status periode pada waktu `now`. Batas: `aktif` sampai tepat `berakhir` (akhir hari WIB), `tenggang` sampai
 * tepat `akhirEfektif`, setelah itu `berakhir`.
 */
export function statusPeriode(p: PeriodeWaktu, now: Date = new Date()): StatusPeriode {
  if (p.dicabutAt) return "dicabut";
  if (now < p.mulai) return "akan_datang";
  if (now <= p.berakhir) return "aktif";
  if (now <= akhirEfektif(p)) return "tenggang";
  return "berakhir";
}

/** Periode yang sedang memberi akses (aktif atau tenggang). Bila dua periode tumpang tindih (perpanjangan saat tenggang), yang aktif/terbaru menang. */
export function pilihPeriodeBerjalan<T extends PeriodeWaktu>(periode: T[], now: Date = new Date()): T | null {
  const berjalan = periode
    .map((p) => ({ p, status: statusPeriode(p, now) }))
    .filter((x) => x.status === "aktif" || x.status === "tenggang");
  if (berjalan.length === 0) return null;
  berjalan.sort((a, b) => {
    if (a.status !== b.status) return a.status === "aktif" ? -1 : 1;
    return b.p.mulai.getTime() - a.p.mulai.getTime();
  });
  return berjalan[0]!.p;
}

/** Periode terdekat yang belum mulai. */
export function pilihPeriodeAkanDatang<T extends PeriodeWaktu>(periode: T[], now: Date = new Date()): T | null {
  const calon = periode.filter((p) => statusPeriode(p, now) === "akan_datang");
  calon.sort((a, b) => a.mulai.getTime() - b.mulai.getTime());
  return calon[0] ?? null;
}

/** Periode yang paling akhir berakhir (untuk pesan "langganan berakhir pada ..."). */
export function pilihPeriodeTerakhirBerakhir<T extends PeriodeWaktu>(periode: T[], now: Date = new Date()): T | null {
  const calon = periode.filter((p) => statusPeriode(p, now) === "berakhir");
  calon.sort((a, b) => b.berakhir.getTime() - a.berakhir.getTime());
  return calon[0] ?? null;
}

/** Periode yang ditampilkan sebagai "status langganan sekolah": berjalan, kalau tidak ada yang terdekat berikutnya, kalau tidak yang terakhir berakhir. */
export function pilihPeriodeRujukan<T extends PeriodeWaktu>(periode: T[], now: Date = new Date()): T | null {
  return pilihPeriodeBerjalan(periode, now) ?? pilihPeriodeAkanDatang(periode, now) ?? pilihPeriodeTerakhirBerakhir(periode, now);
}

/** Tanggal kalender "yyyy-MM-dd" ditambah `hari` hari (murni kalender, tanpa zona waktu). */
export function geserTanggal(tanggal: string, hari: number): string {
  const [tahun, bulan, tgl] = tanggal.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(tahun, bulan - 1, tgl + hari)).toISOString().slice(0, 10);
}

/**
 * Tanggal berakhir periode berdurasi `bulan` bulan yang mulai pada `mulai` ("yyyy-MM-dd"): sehari sebelum tanggal
 * yang sama `bulan` bulan kemudian (mulai 1 Juli + 6 bulan = berakhir 31 Desember). Bila bulan tujuan lebih pendek
 * (mulai 31 Agustus + 6 bulan) dipakai akhir bulan tujuan, bukan melompat ke bulan berikutnya.
 */
export function tanggalAkhirPeriode(mulai: string, bulan: number): string {
  const [tahun, bln, tgl] = mulai.split("-").map(Number) as [number, number, number];
  const hariDiBulanTujuan = new Date(Date.UTC(tahun, bln - 1 + bulan + 1, 0)).getUTCDate();
  const tujuan = new Date(Date.UTC(tahun, bln - 1 + bulan, Math.min(tgl, hariDiBulanTujuan)));
  return geserTanggal(tujuan.toISOString().slice(0, 10), -1);
}

/** Alasan penolakan dalam bahasa admin, atau null kalau rentang sah. Periode yang dicabut tidak dihitung; `baru.id` dikecualikan saat mengubah. */
export function validasiRentangPeriode(
  periode: Pick<PeriodeLangganan, "id" | "mulai" | "berakhir" | "dicabutAt">[],
  baru: { id?: string; mulai: Date; berakhir: Date },
): string | null {
  if (baru.berakhir.getTime() < baru.mulai.getTime()) {
    return "Tanggal berakhir tidak boleh sebelum tanggal mulai.";
  }
  const bentrok = periode.find(
    (p) => !p.dicabutAt && p.id !== baru.id && baru.mulai.getTime() <= p.berakhir.getTime() && baru.berakhir.getTime() >= p.mulai.getTime(),
  );
  if (bentrok) {
    return `Tanggal bertabrakan dengan periode lain (${formatWIBDate(bentrok.mulai)} sampai ${formatWIBDate(bentrok.berakhir)}). Periode satu sekolah tidak boleh tumpang tindih.`;
  }
  return null;
}

export class PeriodeTidakValidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodeTidakValidError";
  }
}

type DbPeriode = Pick<PrismaClient, "periodeLangganan" | "school" | "entitlement"> | Prisma.TransactionClient;

/** Periode sekolah urut mulai; yang dicabut disembunyikan kecuali diminta (riwayat admin pusat). */
export function ambilPeriodeSekolah(
  db: DbPeriode,
  schoolId: string,
  opsi: { termasukDicabut?: boolean } = {},
): Promise<PeriodeLangganan[]> {
  return db.periodeLangganan.findMany({
    where: { schoolId, ...(opsi.termasukDicabut ? {} : { dicabutAt: null }) },
    orderBy: { mulai: "asc" },
  });
}

/** Kursi terpakai dalam satu periode: siswa (belum dihapus) yang punya kursi sekolah aktif pada periode itu. Unik per siswa per periode. */
export function hitungKursiPeriode(db: DbPeriode, periodeId: string): Promise<number> {
  return db.entitlement.count({
    where: { periodeId, source: "school_seat", revokedAt: null, student: { deletedAt: null } },
  });
}

/**
 * Salin periode rujukan ke School.seatQuota/validUntil (kolom lama yang masih dibaca beberapa tampilan).
 * Hanya informasi: KEPUTUSAN akses dan kuota selalu dibaca dari periode, bukan dari kolom ini, karena kolom
 * ini tidak berubah sendiri saat waktu berjalan (mis. periode berikutnya mulai berlaku).
 */
export async function sinkronkanCachePeriode(db: DbPeriode, schoolId: string, now: Date = new Date()): Promise<void> {
  const rujukan = pilihPeriodeRujukan(await ambilPeriodeSekolah(db, schoolId), now);
  await db.school.update({
    where: { id: schoolId },
    data: { seatQuota: rujukan?.seatQuota ?? null, validUntil: rujukan?.berakhir ?? null },
  });
}

export type InputPeriode = {
  schoolId: string;
  nama?: string | null;
  mulai: Date;
  berakhir: Date;
  masaTenggangHari?: number;
  seatQuota: number;
  catatan?: string | null;
  dibuatOlehId?: string | null;
};

/** Buat periode baru (aktivasi pertama maupun perpanjangan). Menolak rentang yang tumpang tindih. Panggil di dalam transaksi bila ada tulisan lain yang menyertai. */
export async function buatPeriode(db: DbPeriode, input: InputPeriode, now: Date = new Date()): Promise<PeriodeLangganan> {
  const masalah = validasiRentangPeriode(await ambilPeriodeSekolah(db, input.schoolId), input);
  if (masalah) throw new PeriodeTidakValidError(masalah);

  const periode = await db.periodeLangganan.create({
    data: {
      schoolId: input.schoolId,
      nama: input.nama?.trim() ? input.nama.trim() : null,
      mulai: input.mulai,
      berakhir: input.berakhir,
      masaTenggangHari: input.masaTenggangHari ?? TENGGANG_DEFAULT_HARI,
      seatQuota: input.seatQuota,
      catatan: input.catatan?.trim() ? input.catatan.trim() : null,
      dibuatOlehId: input.dibuatOlehId ?? null,
    },
  });
  await sinkronkanCachePeriode(db, input.schoolId, now);
  return periode;
}

export type PerubahanPeriode = {
  nama?: string | null;
  mulai?: Date;
  berakhir?: Date;
  masaTenggangHari?: number;
  seatQuota?: number;
  catatan?: string | null;
  /** true = batalkan periode: kursi siswa dari periode ini ikut dicabut. */
  dicabut?: boolean;
};

/**
 * Ubah atau cabut periode. Mengubah tanggal/tenggang ikut memajukan/memundurkan batas kursi siswa yang sudah
 * dibuat dari periode ini (supaya perpanjangan dalam periode yang sama langsung berlaku untuk siswa lama);
 * mencabut periode mencabut kursinya.
 */
export async function ubahPeriode(
  db: DbPeriode,
  periodeId: string,
  perubahan: PerubahanPeriode,
  now: Date = new Date(),
): Promise<PeriodeLangganan> {
  const lama = await db.periodeLangganan.findUnique({ where: { id: periodeId } });
  if (!lama) throw new PeriodeTidakValidError("Periode tidak ditemukan.");
  if (lama.dicabutAt) throw new PeriodeTidakValidError("Periode ini sudah dicabut dan tidak bisa diubah.");

  if (perubahan.dicabut) {
    const dicabut = await db.periodeLangganan.update({ where: { id: periodeId }, data: { dicabutAt: now } });
    await db.entitlement.updateMany({ where: { periodeId, revokedAt: null }, data: { revokedAt: now } });
    await sinkronkanCachePeriode(db, lama.schoolId, now);
    return dicabut;
  }

  const mulai = perubahan.mulai ?? lama.mulai;
  const berakhir = perubahan.berakhir ?? lama.berakhir;
  const masalah = validasiRentangPeriode(await ambilPeriodeSekolah(db, lama.schoolId), { id: periodeId, mulai, berakhir });
  if (masalah) throw new PeriodeTidakValidError(masalah);

  const baru = await db.periodeLangganan.update({
    where: { id: periodeId },
    data: {
      ...(perubahan.nama !== undefined ? { nama: perubahan.nama?.trim() ? perubahan.nama.trim() : null } : {}),
      ...(perubahan.catatan !== undefined ? { catatan: perubahan.catatan?.trim() ? perubahan.catatan.trim() : null } : {}),
      ...(perubahan.seatQuota !== undefined ? { seatQuota: perubahan.seatQuota } : {}),
      ...(perubahan.masaTenggangHari !== undefined ? { masaTenggangHari: perubahan.masaTenggangHari } : {}),
      mulai,
      berakhir,
    },
  });

  // Batas kursi siswa mengikuti periode; hanya kursi yang masih berlaku (belum dicabut) yang disesuaikan.
  await db.entitlement.updateMany({
    where: { periodeId, source: "school_seat", revokedAt: null },
    data: { endsAt: akhirEfektif(baru) },
  });
  await sinkronkanCachePeriode(db, lama.schoolId, now);
  return baru;
}

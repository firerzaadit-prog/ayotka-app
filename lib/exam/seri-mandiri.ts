import "server-only";
import { Prisma, type Jenjang } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  adalahJawabanTerisi,
  hanyaPercobaanKosong,
  percobaanSelesaiPertama,
  putuskanStatusSeri,
  selesaiPertama,
  wajibUrutanSeri,
  type PercobaanSeri,
  type StatusSeriMandiri,
} from "@/lib/exam/seri-jadwal";

export type { StatusSeriMandiri };

/**
 * Seri Try Out Mandiri (permintaan user 30 Sep 2026; aturan buka diganti 4 Okt
 * 2026). Paket dengan Package.urutanSeri diisi membentuk satu seri per mata
 * pelajaran (subjectId sama, kategori "mandiri" saja - Nasional tidak ikut).
 * Paket urutan ke-N terbuka untuk SEORANG siswa pada pukul 06.00 WIB pertama
 * setelah ia menyelesaikan paket urutan ke-(N-1) yang terlihat olehnya, jadi
 * paling banyak satu paket baru per hari per mapel dan siswa yang tidak
 * mengerjakan tidak mendapat paket baru. Aturan lengkap, termasuk definisi
 * "selesai" dan jaminan paket yang sudah dimasuki tidak terkunci lagi, ada di
 * lib/exam/seri-jadwal.ts. Paket dengan urutanSeri kosong (null) TIDAK ikut
 * aturan ini sama sekali - tetap bebas dikerjakan kapan saja.
 */

const STATUS_SELESAI = ["selesai", "kedaluwarsa"] as const;

/**
 * Attempt PERTAMA (berdasar mulaiAt) yang selesai/kedaluwarsa untuk siswa+
 * paket ini, lewat jalur self-select (assignmentId null - Ujian Terjadwal
 * tidak ikut aturan seri maupun gerbang rapor "attempt ke-1"). Dipakai oleh
 * gerbang unduh rapor PDF - lihat lib/exam/hasil.ts.
 */
export async function firstFinishedAttempt(studentId: string, packageId: string) {
  return prisma.attempt.findFirst({
    where: { studentId, packageId, assignmentId: null, status: { in: [...STATUS_SELESAI] } },
    orderBy: { mulaiAt: "asc" },
    select: { id: true, selesaiAt: true, mulaiAt: true },
  });
}

/**
 * Jumlah soal yang benar-benar terjawab pada tiap percobaan (lihat adalahJawabanTerisi) - satu query untuk semua
 * percobaan sekaligus. Hanya baris yang jawabannya tidak kosong di database yang dibaca; objek kosong `{}` (soal
 * ragu-ragu tanpa jawaban) dibuang di sini.
 */
async function hitungJawabanTerisi(attemptIds: string[]): Promise<Map<string, number>> {
  const hasil = new Map<string, number>();
  if (attemptIds.length === 0) return hasil;
  const rows = await prisma.attemptAnswer.findMany({
    where: { attemptId: { in: attemptIds }, jawabanJson: { not: Prisma.DbNull } },
    select: { attemptId: true, jawabanJson: true },
  });
  for (const r of rows) {
    if (adalahJawabanTerisi(r.jawabanJson)) hasil.set(r.attemptId, (hasil.get(r.attemptId) ?? 0) + 1);
  }
  return hasil;
}

/**
 * Semua percobaan self-select (assignmentId null) siswa ini pada paket-paket tersebut, dikelompokkan per
 * paket, lengkap dengan jumlah soal yang terjawab untuk yang sudah selesai - dua query (percobaan, lalu jawaban).
 * Ujian Terjadwal tidak ikut aturan seri, jadi percobaannya tidak dihitung.
 */
async function percobaanPerPaket(studentId: string, packageIds: string[]): Promise<Map<string, PercobaanSeri[]>> {
  const hasil = new Map<string, PercobaanSeri[]>();
  if (packageIds.length === 0) return hasil;
  const rows = await prisma.attempt.findMany({
    where: { studentId, assignmentId: null, packageId: { in: packageIds } },
    select: { id: true, packageId: true, status: true, mulaiAt: true, selesaiAt: true, sisaDetik: true },
  });
  const terjawab = await hitungJawabanTerisi(
    rows.filter((r) => r.status === "selesai" || r.status === "kedaluwarsa").map((r) => r.id),
  );
  for (const r of rows) {
    const list = hasil.get(r.packageId) ?? [];
    list.push({
      id: r.id,
      status: r.status,
      mulaiAt: r.mulaiAt,
      selesaiAt: r.selesaiAt,
      sisaDetik: r.sisaDetik,
      jumlahTerjawab: terjawab.get(r.id) ?? 0,
    });
    hasil.set(r.packageId, list);
  }
  return hasil;
}

/**
 * Percobaan yang PERTAMA kali dihitung sebagai "sudah mengerjakan" paket ini oleh siswa (selesai/kedaluwarsa dan
 * minimal satu soal terjawab) + waktu selesainya; null kalau belum ada. Dipakai halaman hasil untuk memberi tahu
 * kapan paket berikutnya terbuka - aturan yang sama dengan gerbang seri.
 */
export async function percobaanBerjawabPertama(
  studentId: string,
  packageId: string,
): Promise<{ id: string; selesai: Date; percobaan: PercobaanSeri } | null> {
  const percobaan = (await percobaanPerPaket(studentId, [packageId])).get(packageId) ?? [];
  const pertama = percobaanSelesaiPertama(percobaan);
  return pertama ? { id: pertama.percobaan.id!, selesai: pertama.selesai, percobaan: pertama.percobaan } : null;
}

type KandidatSebelumnya = { id: string; nama: string; urutanSeri: number | null };

/** Paket urutan TEPAT sebelumnya (urutan tertinggi di bawah target) dari yang terlihat siswa. */
function cariSebelumnya(urutanTarget: number, kandidat: KandidatSebelumnya[]): KandidatSebelumnya | null {
  return (
    kandidat
      .filter((p) => p.urutanSeri != null && p.urutanSeri < urutanTarget)
      .sort((a, b) => b.urutanSeri! - a.urutanSeri!)[0] ?? null
  );
}

function statusUntuk(
  target: { id: string; bukaMulai?: Date | string | null },
  sebelumnya: KandidatSebelumnya | null,
  percobaan: Map<string, PercobaanSeri[]>,
  sekarang: Date,
): StatusSeriMandiri {
  const percobaanSebelumnya = sebelumnya ? (percobaan.get(sebelumnya.id) ?? []) : [];
  return putuskanStatusSeri({
    sekarang,
    sebelumnya,
    sebelumnyaSelesaiPada: selesaiPertama(percobaanSebelumnya),
    sebelumnyaHanyaKosong: hanyaPercobaanKosong(percobaanSebelumnya),
    sudahPernahMasuk: (percobaan.get(target.id)?.length ?? 0) > 0,
    bukaMulai: target.bukaMulai,
  });
}

/**
 * Status buka SATU paket berseri untuk siswa tertentu (dipakai gerbang mulai
 * ujian di POST /api/siswa/attempts). `kandidatSebelumnya` adalah paket lain di
 * seri yang sama yang TERLIHAT siswa ini (mapel & kategori mandiri sama) -
 * paket yang tidak terlihat (mis. khusus sekolah lain) tidak boleh jadi
 * prasyarat, kalau tidak siswa terkunci selamanya. Paling banyak satu query.
 */
export async function statusSeriMandiri(
  studentId: string,
  target: { id: string; subjectId: string; urutanSeri: number | null; bukaMulai?: Date | string | null },
  kandidatSebelumnya: KandidatSebelumnya[],
): Promise<StatusSeriMandiri> {
  if (target.urutanSeri == null) return { terkunci: false };

  const sebelumnya = cariSebelumnya(target.urutanSeri, kandidatSebelumnya);
  if (!sebelumnya) return { terkunci: false };

  const percobaan = await percobaanPerPaket(studentId, [target.id, sebelumnya.id]);
  return statusUntuk(target, sebelumnya, percobaan, new Date());
}

/**
 * Lingkup sebuah seri: satu mata pelajaran pada satu jenjang. Tiap jenjang punya urutannya sendiri - Matematika SD
 * urutan 1 dan Matematika SMP urutan 1 boleh sama, karena siswa hanya melihat paket jenjangnya sendiri.
 */
export type LingkupSeri = { subjectId: string; jenjang: Jenjang };

/**
 * Urutan seri harus unik per (mata pelajaran, jenjang, kategori "mandiri") - dua paket
 * dengan urutanSeri sama di lingkup yang sama membuat prasyarat
 * ambigu (mana yang lebih dulu?). Dicek di app/api/packages/route.ts
 * (POST) & [id]/route.ts (PATCH) sebelum disimpan. excludePackageId dipakai
 * saat edit supaya paket tidak dianggap bentrok dengan urutannya sendiri.
 */
export async function urutanSeriBentrok(
  lingkup: LingkupSeri,
  urutanSeri: number,
  excludePackageId?: string,
): Promise<boolean> {
  const bentrok = await prisma.package.findFirst({
    where: {
      subjectId: lingkup.subjectId,
      jenjang: lingkup.jenjang,
      kategori: "mandiri",
      urutanSeri,
      status: { not: "archived" },
      ...(excludePackageId ? { id: { not: excludePackageId } } : {}),
    },
    select: { id: true },
  });
  return bentrok != null;
}

/**
 * Urutan seri yang sudah dipakai paket Mandiri (belum diarsipkan) pada mapel dan jenjang ini, terkecil dulu - kriteria
 * sama persis dengan urutanSeriBentrok, lintas pemilik (nomor pusat dan sekolah berbagi satu ruang per mapel dan
 * jenjang). Dipakai form paket untuk mencegah nomor ganda dan menyarankan nomor kosong berikutnya. excludePackageId =
 * paket yang sedang diedit.
 */
export async function urutanSeriTerpakai(lingkup: LingkupSeri, excludePackageId?: string): Promise<number[]> {
  const rows = await prisma.package.findMany({
    where: {
      subjectId: lingkup.subjectId,
      jenjang: lingkup.jenjang,
      kategori: "mandiri",
      urutanSeri: { not: null },
      status: { not: "archived" },
      ...(excludePackageId ? { id: { not: excludePackageId } } : {}),
    },
    select: { urutanSeri: true },
  });
  return [...new Set(rows.map((r) => r.urutanSeri as number))].sort((a, b) => a - b);
}

/**
 * Galat Prisma P2002 = pelanggaran indeks unik. Indeks packages_urutan_seri_unik (migrasi 20261005100000) menolak nomor
 * urutan kembar pada satu mapel & jenjang walau dua permintaan serentak sama-sama lolos periksaUrutanSeriPaket.
 */
export function adalahPelanggaranUnik(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Jumlah siswa BERBEDA yang sudah menyelesaikan (selesai/kedaluwarsa) tiap paket lewat jalur self-select - untuk
 * panel "posisi urutan seri" di halaman admin. Satu query agregat (bukan membaca baris percobaan). Hanya informasi
 * tambahan: kalau gagal, mengembalikan null dan halaman admin tetap tampil tanpa angka siswa.
 */
export async function hitungSiswaSelesaiPerPaket(packageIds: string[]): Promise<Record<string, number> | null> {
  if (packageIds.length === 0) return {};
  try {
    const rows = await prisma.$queryRaw<{ package_id: string; siswa: bigint | number }[]>(Prisma.sql`
      SELECT package_id, COUNT(DISTINCT student_id) AS siswa
      FROM attempts
      WHERE assignment_id IS NULL
        AND status IN ('selesai', 'kedaluwarsa')
        AND package_id = ANY(${packageIds}::uuid[])
      GROUP BY package_id`);
    return Object.fromEntries(rows.map((r) => [r.package_id, Number(r.siswa)]));
  } catch (error) {
    console.error("Gagal menghitung siswa yang menyelesaikan paket", error);
    return null;
  }
}

/**
 * Menyimpan sesuatu yang membawa nomor urutan seri dan mengulang dengan nomor baru kalau indeks unik menolaknya (impor
 * lain mengambil nomor yang sama pada saat bersamaan). `simpan` harus atomik (satu transaksi) supaya aman diulang.
 * Tanpa `berseri` (mis. Try Out Nasional) nomor tidak dipakai dan tidak ada yang diulang.
 */
export async function simpanDenganUrutanSeri<T>(input: {
  berseri: boolean;
  ambilNomor: () => Promise<number>;
  simpan: (urutanSeri: number | null) => Promise<T>;
  maksPercobaan?: number;
}): Promise<T> {
  const maks = input.maksPercobaan ?? 3;
  let urutan: number | null = input.berseri ? await input.ambilNomor() : null;
  for (let percobaan = 1; ; percobaan++) {
    try {
      return await input.simpan(urutan);
    } catch (error) {
      if (urutan == null || !adalahPelanggaranUnik(error) || percobaan >= maks) throw error;
      urutan = await input.ambilNomor();
    }
  }
}

/** Isi respons 409 untuk pelanggaran indeks unik (nomor urutan baru saja dipakai paket lain). */
export const GALAT_URUTAN_BERSAMAAN = {
  error: "Urutan seri itu baru saja dipakai paket lain di mata pelajaran dan jenjang ini. Muat ulang halaman lalu pilih angka lain.",
  code: "URUTAN_SERI_BENTROK",
} as const;

export type HasilPeriksaUrutan = { ok: true } | { ok: false; status: 400 | 409; code: string; error: string };

/**
 * Gerbang server untuk urutan seri sebuah paket (dipakai buat, ubah, dan terbitkan paket): Try Out Mandiri milik
 * pusat WAJIB punya urutan (wajibUrutanSeri), dan urutan tidak boleh sama dengan paket lain di mapel yang sama.
 * `urutanSeri` adalah nilai AKHIR paket (nilai baru, atau nilai tersimpan kalau tidak diubah). Paket Nasional tidak
 * berseri, jadi selalu lolos.
 */
export async function periksaUrutanSeriPaket(input: {
  subjectId: string;
  jenjang: Jenjang;
  kategori?: string | null;
  ownerType: string;
  urutanSeri: number | null;
  excludePackageId?: string;
}): Promise<HasilPeriksaUrutan> {
  if (input.kategori === "nasional") return { ok: true };

  if (input.urutanSeri == null) {
    if (wajibUrutanSeri({ kategori: input.kategori, ownerType: input.ownerType })) {
      return {
        ok: false,
        status: 400,
        code: "URUTAN_SERI_WAJIB",
        error: "Urutan seri wajib diisi untuk Try Out Mandiri. Isi dengan angka yang belum dipakai paket lain di mata pelajaran dan jenjang ini.",
      };
    }
    return { ok: true };
  }

  if (await urutanSeriBentrok({ subjectId: input.subjectId, jenjang: input.jenjang }, input.urutanSeri, input.excludePackageId)) {
    return {
      ok: false,
      status: 409,
      code: "URUTAN_SERI_BENTROK",
      error: `Urutan ${input.urutanSeri} sudah dipakai paket lain di mata pelajaran dan jenjang ini. Pakai angka lain.`,
    };
  }
  return { ok: true };
}

type PaketSeri = {
  id: string;
  nama: string;
  subjectId: string;
  kategori: string;
  urutanSeri: number | null;
  bukaMulai?: Date | string | null;
};

/**
 * Anotasi status buka untuk daftar paket self-select siswa (dipakai GET
 * /api/siswa/ujian untuk menampilkan paket yang belum waktunya/gilirannya
 * sebagai terkunci, bukan disembunyikan). Prasyarat urutan dicari dari paket
 * yang terlihat siswa ini. Satu query untuk berapa pun jumlah paketnya (dan tanpa
 * query kalau tidak ada paket berseri yang punya pendahulu).
 */
export async function annotateSeriMandiri<T extends PaketSeri>(
  studentId: string,
  packages: T[],
): Promise<(T & { statusSeri: StatusSeriMandiri })[]> {
  const berseri = (p: PaketSeri) => p.kategori === "mandiri" && p.urutanSeri != null;
  const seriTerlihat = packages.filter(berseri);

  const bySubject = new Map<string, PaketSeri[]>();
  for (const p of seriTerlihat) {
    const list = bySubject.get(p.subjectId) ?? [];
    list.push(p);
    bySubject.set(p.subjectId, list);
  }
  const sebelumnyaById = new Map<string, KandidatSebelumnya | null>();
  for (const p of seriTerlihat) {
    sebelumnyaById.set(p.id, cariSebelumnya(p.urutanSeri!, bySubject.get(p.subjectId) ?? []));
  }

  // Hanya paket yang punya pendahulu yang bisa terkunci - percobaan pada paket itu sendiri dan pendahulunya
  // yang perlu dibaca (yang pertama dalam seri tidak pernah terkunci).
  const idDibaca = new Set<string>();
  for (const p of seriTerlihat) {
    const sebelumnya = sebelumnyaById.get(p.id);
    if (sebelumnya) {
      idDibaca.add(p.id);
      idDibaca.add(sebelumnya.id);
    }
  }
  const percobaan = await percobaanPerPaket(studentId, [...idDibaca]);

  const sekarang = new Date();
  return packages.map((p) => {
    if (!berseri(p)) return { ...p, statusSeri: { terkunci: false } as StatusSeriMandiri };
    return { ...p, statusSeri: statusUntuk(p, sebelumnyaById.get(p.id) ?? null, percobaan, sekarang) };
  });
}

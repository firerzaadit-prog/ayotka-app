import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HARI_SIMPAN_RIWAYAT, MAKS_GILIRAN_DIMUAT } from "@/lib/tutor/konstanta";
import { ringkasanTutor, type RingkasanTutor } from "@/lib/tutor/penggunaan";

const HARI_MS = 24 * 60 * 60 * 1000;

/**
 * Isi percakapan Tanya Tutor AI hanya disimpan HARI_SIMPAN_RIWAYAT (7) hari sejak tiap pesan dikirim. Dua lapis jaminan:
 *  1. Tidak pernah ditampilkan lagi lewat aplikasi begitu lewat batas ini (semua pembacaan memakai batasSimpan);
 *  2. Barisnya dihapus fisik: oleh cron server lima menit yang sudah ada (app/api/cron/proses-antrean-ai) dan, sebagai
 *     cadangan, oleh bersihkanBilaPerlu yang ikut berjalan saat fitur Tutor dipakai.
 * Foto tidak pernah disimpan (hanya penanda adaFoto).
 */
export function batasSimpan(sekarang: Date = new Date()): Date {
  return new Date(sekarang.getTime() - HARI_SIMPAN_RIWAYAT * HARI_MS);
}

export type GiliranRiwayat = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Pesan siswa ini disertai foto yang tidak disimpan. */
  adaFoto: boolean;
  /** Kapan pesan dikirim (ISO). */
  waktu: string;
};

/** Isi satu baris yang sudah dicadangkan (reservasi) dengan pesan dan balasannya, setelah tutor menjawab. */
export async function simpanPercakapan(id: string, isi: { pesan: string; balasan: string; adaFoto: boolean }): Promise<void> {
  await prisma.tutorAiPesan.update({ where: { id }, data: { pesan: isi.pesan, balasan: isi.balasan, adaFoto: isi.adaFoto } });
}

/** Percakapan siswa untuk SATU soal pada SATU percobaan (hanya yang belum lewat 7 hari dan sudah berbalasan), urut dari yang tertua. */
export async function muatRiwayat(
  params: { attemptId: string; studentId: string; questionId: string },
  sekarang: Date = new Date(),
): Promise<GiliranRiwayat[]> {
  const baris = await prisma.tutorAiPesan.findMany({
    where: {
      attemptId: params.attemptId,
      studentId: params.studentId,
      questionId: params.questionId,
      createdAt: { gte: batasSimpan(sekarang) },
      pesan: { not: null },
      balasan: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: MAKS_GILIRAN_DIMUAT,
    select: { id: true, pesan: true, balasan: true, adaFoto: true, createdAt: true },
  });
  return baris.flatMap((b) => [
    { id: `${b.id}:u`, role: "user" as const, content: b.pesan!, adaFoto: b.adaFoto, waktu: b.createdAt.toISOString() },
    { id: `${b.id}:a`, role: "assistant" as const, content: b.balasan!, adaFoto: false, waktu: b.createdAt.toISOString() },
  ]);
}

/** Id soal yang punya percakapan tersimpan pada percobaan ini (untuk label tombol "Lanjutkan chat"). */
export async function soalDenganRiwayat(attemptId: string, studentId: string, sekarang: Date = new Date()): Promise<string[]> {
  const baris = await prisma.tutorAiPesan.groupBy({
    by: ["questionId"],
    where: { attemptId, studentId, createdAt: { gte: batasSimpan(sekarang) }, pesan: { not: null }, balasan: { not: null } },
  });
  return baris.map((b) => b.questionId);
}

export type InfoTutorHalaman = RingkasanTutor & { soalBerriwayat: string[]; hariSimpan: number };

/** Semua yang dibutuhkan halaman hasil siswa tentang Tutor: aktif atau tidak, sisa pesan, soal yang punya riwayat. */
export async function infoTutorHalaman(
  attempt: { id: string; studentId: string },
  sekarang: Date = new Date(),
): Promise<InfoTutorHalaman> {
  const [ringkasan, soalBerriwayat] = await Promise.all([
    ringkasanTutor(attempt, sekarang),
    soalDenganRiwayat(attempt.id, attempt.studentId, sekarang),
  ]);
  return { ...ringkasan, soalBerriwayat, hariSimpan: HARI_SIMPAN_RIWAYAT };
}

/**
 * Siswa menghapus percakapannya untuk SATU soal pada percobaannya sendiri. Yang dikosongkan hanya ISI (pesan, balasan,
 * penanda foto); BARISNYA sengaja dibiarkan karena baris itu juga dasar hitungan batas pesan harian (penggunaan.ts):
 * kalau barisnya ikut dihapus, siswa bisa mengembalikan jatahnya dengan menghapus percakapan. Mengembalikan jumlah baris
 * yang isinya dikosongkan (baris yang sudah kosong atau sedang menunggu balasan tidak dihitung).
 */
export async function hapusPercakapan(params: { attemptId: string; studentId: string; questionId: string }): Promise<number> {
  const hasil = await prisma.tutorAiPesan.updateMany({
    where: {
      attemptId: params.attemptId,
      studentId: params.studentId,
      questionId: params.questionId,
      OR: [{ pesan: { not: null } }, { balasan: { not: null } }, { adaFoto: true }],
    },
    data: { pesan: null, balasan: null, adaFoto: false },
  });
  return hasil.count;
}

/** Hapus SEMUA baris (semua siswa) yang sudah lewat 7 hari. Mengembalikan jumlah yang dihapus. */
export async function bersihkanRiwayatKedaluwarsa(sekarang: Date = new Date()): Promise<number> {
  const hasil = await prisma.tutorAiPesan.deleteMany({ where: { createdAt: { lt: batasSimpan(sekarang) } } });
  return hasil.count;
}

let terakhirBersih = 0;

/**
 * Cadangan pembersihan: dipanggil di rute Tutor, paling sering sekali per jam per proses, tanpa menunggu hasilnya dan
 * tanpa pernah mengganggu permintaan yang sedang dilayani. Penjamin utamanya tetap cron server.
 */
export function bersihkanBilaPerlu(sekarang: Date = new Date(), jedaMs: number = 60 * 60 * 1000): void {
  if (sekarang.getTime() - terakhirBersih < jedaMs) return;
  terakhirBersih = sekarang.getTime();
  void bersihkanRiwayatKedaluwarsa(sekarang).catch((err) => console.error("[tutor] gagal membersihkan riwayat kedaluwarsa:", err));
}

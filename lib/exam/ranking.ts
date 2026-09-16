import "server-only";
import { prisma } from "@/lib/db/prisma";

export type RankingRow = { peringkat: number; nama: string; skor: number; andaSendiri: boolean };
export type RankingBoard = { peringkatSaya: number; totalPeserta: number; papan: RankingRow[] };

const TOP_N = 20;

/**
 * Cakupan ranking satu "Try Out" (permintaan user, Bagian 8/10): kalau
 * paketnya salah satu VARIASI dari TryOutGroup, cakupannya SEMUA paket
 * variasi dalam grup itu - siswa dirangking bareng meski dapat variasi
 * soal yang berbeda-beda karena diacak (lihat app/api/siswa/attempts/route.ts).
 * Kalau bukan bagian grup, cakupannya paket itu sendiri saja, supaya
 * "setiap ada try out ada ranking" tetap berlaku untuk try out tunggal.
 */
async function getRankingScopePackageIds(packageId: string): Promise<string[]> {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { tryOutGroupId: true },
  });
  if (!pkg?.tryOutGroupId) return [packageId];

  const siblings = await prisma.package.findMany({
    where: { tryOutGroupId: pkg.tryOutGroupId },
    select: { id: true },
  });
  return siblings.map((s) => s.id);
}

/**
 * Peringkat siswa di antara SEMUA peserta try out ini - skor TERBAIK per
 * siswa kalau sempat mencoba berulang (sama seperti konvensi ranking
 * analitik admin, lihat lib/analytics/sekolah.ts). Nama ditampilkan APA
 * ADANYA (keputusan user) - beda dari watermark rapor yang menyamarkan
 * identitas, papan ranking ini memang dimaksudkan terlihat sesama peserta.
 */
export async function buildRanking(packageId: string, studentId: string): Promise<RankingBoard | null> {
  const packageIds = await getRankingScopePackageIds(packageId);

  const attempts = await prisma.attempt.findMany({
    where: { packageId: { in: packageIds }, skorAkhir: { not: null } },
    select: { studentId: true, skorAkhir: true, student: { select: { nama: true } } },
  });

  const bestByStudent = new Map<string, { nama: string; skor: number }>();
  for (const a of attempts) {
    const skor = a.skorAkhir ?? 0;
    const existing = bestByStudent.get(a.studentId);
    if (!existing || skor > existing.skor) {
      bestByStudent.set(a.studentId, { nama: a.student.nama, skor });
    }
  }

  const sorted = Array.from(bestByStudent.entries())
    .map(([sid, v]) => ({ studentId: sid, ...v }))
    .sort((a, b) => b.skor - a.skor);

  const myIndex = sorted.findIndex((r) => r.studentId === studentId);
  if (myIndex < 0) return null;

  const papan: RankingRow[] = sorted.slice(0, TOP_N).map((r, i) => ({
    peringkat: i + 1,
    nama: r.nama,
    skor: r.skor,
    andaSendiri: r.studentId === studentId,
  }));

  // Kalau posisi saya di luar TOP_N, tetap sisipkan baris saya sendiri di
  // akhir supaya siswa selalu bisa lihat posisinya sendiri walau tidak masuk papan atas.
  if (myIndex >= TOP_N) {
    const me = sorted[myIndex]!;
    papan.push({ peringkat: myIndex + 1, nama: me.nama, skor: me.skor, andaSendiri: true });
  }

  return { peringkatSaya: myIndex + 1, totalPeserta: sorted.length, papan };
}

export type LatestRanking = { attemptId: string; tryOutNama: string; ranking: RankingBoard };

/**
 * Bagian 8/10 (permintaan user): widget ranking di dashboard siswa - selalu
 * try out TERAKHIR yang dia ikuti (bukan seluruh riwayat, itu masih lewat
 * halaman hasil masing-masing attempt). Dipoll berkala oleh client supaya
 * papan ranking terasa realtime tanpa perlu refresh manual - lihat
 * components/dashboard/ranking-widget.tsx.
 */
export async function getLatestRankingForStudent(studentId: string): Promise<LatestRanking | null> {
  const attempt = await prisma.attempt.findFirst({
    where: { studentId, skorAkhir: { not: null }, package: { jenisPaket: "tryout" } },
    orderBy: { mulaiAt: "desc" },
    select: {
      id: true,
      packageId: true,
      package: { select: { nama: true, tryOutGroup: { select: { nama: true } } } },
    },
  });
  if (!attempt) return null;

  const ranking = await buildRanking(attempt.packageId, studentId);
  if (!ranking) return null;

  return {
    attemptId: attempt.id,
    tryOutNama: attempt.package.tryOutGroup?.nama ?? attempt.package.nama,
    ranking,
  };
}

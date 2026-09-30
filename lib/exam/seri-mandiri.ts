import "server-only";
import { prisma } from "@/lib/db/prisma";
import { besokJam6WIB } from "@/lib/utils/datetime";

/**
 * Urutan berjalan harian Try Out Mandiri (permintaan user, 30 Sep 2026):
 * paket dengan Package.urutanSeri diisi membentuk satu seri per mata
 * pelajaran (subjectId sama, kategori "mandiri" saja - Nasional tidak ikut).
 * Paket urutan ke-N baru boleh dikerjakan siswa setelah:
 * 1. Paket urutan ke-(N-1) di seri yang sama sudah PERNAH diselesaikan siswa
 *    ini (minimal satu attempt berstatus selesai/kedaluwarsa, skor berapa
 *    pun - tidak ada syarat nilai minimal), DAN
 * 2. Sudah lewat jam 06:00 WIB di hari SETELAH percobaan PERTAMA yang
 *    menyelesaikan paket ke-(N-1) itu. Dihitung dari percobaan pertama,
 *    bukan percobaan terakhir - mengulang paket ke-(N-1) berkali-kali
 *    setelahnya tidak menunda buka paket ke-N.
 * Paket dengan urutanSeri kosong (null) TIDAK ikut aturan ini sama sekali -
 * tetap bebas dikerjakan kapan saja, persis seperti sebelum fitur ini ada.
 */

export type StatusSeriMandiri =
  | { terkunci: false }
  | { terkunci: true; alasan: "belum_giliran"; namaPaketSebelumnya: string }
  | { terkunci: true; alasan: "menunggu_besok"; bukaPada: Date };

/**
 * Attempt PERTAMA (berdasar mulaiAt) yang selesai/kedaluwarsa untuk siswa+
 * paket ini, lewat jalur self-select (assignmentId null - Ujian Terjadwal
 * tidak ikut aturan seri maupun gerbang rapor "attempt ke-1"). Dipakai juga
 * oleh gerbang unduh rapor PDF - lihat lib/exam/hasil.ts.
 */
export async function firstFinishedAttempt(studentId: string, packageId: string) {
  return prisma.attempt.findFirst({
    where: { studentId, packageId, assignmentId: null, status: { in: ["selesai", "kedaluwarsa"] } },
    orderBy: { mulaiAt: "asc" },
    select: { id: true, selesaiAt: true, mulaiAt: true },
  });
}

/**
 * Status kunci SATU paket berseri untuk siswa tertentu. `kandidatSebelumnya`
 * adalah paket lain di seri yang sama (subjectId & kategori mandiri sama,
 * urutanSeri terisi) - cukup {id, nama, urutanSeri}, dipakai mencari paket
 * urutan tepat sebelum `target`.
 */
export async function statusSeriMandiri(
  studentId: string,
  target: { id: string; urutanSeri: number | null },
  kandidatSebelumnya: { id: string; nama: string; urutanSeri: number | null }[],
): Promise<StatusSeriMandiri> {
  if (target.urutanSeri == null) return { terkunci: false };

  const sebelumnya = kandidatSebelumnya
    .filter((p) => p.urutanSeri != null && p.urutanSeri < target.urutanSeri!)
    .sort((a, b) => b.urutanSeri! - a.urutanSeri!)[0];
  if (!sebelumnya) return { terkunci: false }; // paket pertama di seri - tidak ada yang harus diselesaikan dulu

  const selesai = await firstFinishedAttempt(studentId, sebelumnya.id);
  if (!selesai) {
    return { terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: sebelumnya.nama };
  }
  const bukaPada = besokJam6WIB(selesai.selesaiAt ?? selesai.mulaiAt);
  if (new Date() < bukaPada) {
    return { terkunci: true, alasan: "menunggu_besok", bukaPada };
  }
  return { terkunci: false };
}

/**
 * Urutan seri harus unik per (subjectId, kategori "mandiri") - dua paket
 * dengan urutanSeri sama di mata pelajaran yang sama membuat sistem tidak
 * bisa menentukan yang mana "paket sebelumnya" secara pasti (statusSeriMandiri
 * jadi bergantung urutan hasil query, bukan niat admin). Dicek di
 * app/api/packages/route.ts (POST) & [id]/route.ts (PATCH) sebelum disimpan.
 * excludePackageId dipakai saat edit supaya paket tidak dianggap bentrok
 * dengan urutannya sendiri.
 */
export async function urutanSeriBentrok(
  subjectId: string,
  urutanSeri: number,
  excludePackageId?: string,
): Promise<boolean> {
  const bentrok = await prisma.package.findFirst({
    where: {
      subjectId,
      kategori: "mandiri",
      urutanSeri,
      status: { not: "archived" },
      ...(excludePackageId ? { id: { not: excludePackageId } } : {}),
    },
    select: { id: true },
  });
  return bentrok != null;
}

type PaketSeri = { id: string; nama: string; subjectId: string; kategori: string; urutanSeri: number | null };

/**
 * Anotasi status kunci untuk daftar paket self-select (dipakai GET
 * /api/siswa/ujian untuk menampilkan paket yang belum gilirannya sebagai
 * terkunci, bukan disembunyikan). Mengelompokkan kandidat "paket
 * sebelumnya" per subjectId dulu supaya tidak query berulang untuk hal yang
 * sama. Sengaja sequential (bukan Promise.all) - jumlah paket per siswa
 * kecil, dan koneksi Prisma dibatasi 1 per instance di lingkungan ini.
 */
export async function annotateSeriMandiri<T extends PaketSeri>(
  studentId: string,
  packages: T[],
): Promise<(T & { statusSeri: StatusSeriMandiri })[]> {
  const bySubject = new Map<string, PaketSeri[]>();
  for (const p of packages) {
    if (p.kategori !== "mandiri") continue;
    const list = bySubject.get(p.subjectId) ?? [];
    list.push(p);
    bySubject.set(p.subjectId, list);
  }
  const hasil: (T & { statusSeri: StatusSeriMandiri })[] = [];
  for (const p of packages) {
    if (p.kategori !== "mandiri" || p.urutanSeri == null) {
      hasil.push({ ...p, statusSeri: { terkunci: false } });
      continue;
    }
    const status = await statusSeriMandiri(studentId, p, bySubject.get(p.subjectId) ?? []);
    hasil.push({ ...p, statusSeri: status });
  }
  return hasil;
}

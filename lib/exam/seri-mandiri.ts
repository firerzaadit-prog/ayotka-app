import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hitungJadwalBukaSeri, putuskanStatusSeri, type StatusSeriMandiri } from "@/lib/exam/seri-jadwal";

export type { StatusSeriMandiri };

/**
 * Seri Try Out Mandiri (permintaan user 30 Sep 2026, disempurnakan 1 Okt 2026).
 * Paket dengan Package.urutanSeri diisi membentuk satu seri per mata pelajaran
 * (subjectId sama, kategori "mandiri" saja - Nasional tidak ikut). Paket urutan
 * ke-N bisa dikerjakan siswa kalau DUA syarat terpenuhi:
 * 1. JADWAL (global, sama untuk semua siswa): urutan 1 terbuka begitu dipublish,
 *    urutan 2 pukul 06.00 WIB sehari setelahnya, dst. - lib/exam/seri-jadwal.ts.
 * 2. URUTAN (per siswa): siswa sudah menyelesaikan paket urutan ke-(N-1) yang
 *    terlihat olehnya (minimal satu attempt selesai/kedaluwarsa, skor berapa
 *    pun, tanpa syarat nilai). Berlaku langsung begitu selesai - tidak menunggu
 *    besok. Contoh: siswa absen hari 2-4, hari 5 mengerjakan B; paket C-E sudah
 *    terbuka menurut jadwal, tapi D baru bisa setelah C selesai, E setelah D.
 * Paket dengan urutanSeri kosong (null) TIDAK ikut aturan ini sama sekali -
 * tetap bebas dikerjakan kapan saja.
 */

const STATUS_SELESAI = ["selesai", "kedaluwarsa"] as const;

/**
 * Attempt PERTAMA (berdasar mulaiAt) yang selesai/kedaluwarsa untuk siswa+
 * paket ini, lewat jalur self-select (assignmentId null - Ujian Terjadwal
 * tidak ikut aturan seri maupun gerbang rapor "attempt ke-1"). Dipakai juga
 * oleh gerbang unduh rapor PDF - lihat lib/exam/hasil.ts.
 */
export async function firstFinishedAttempt(studentId: string, packageId: string) {
  return prisma.attempt.findFirst({
    where: { studentId, packageId, assignmentId: null, status: { in: [...STATUS_SELESAI] } },
    orderBy: { mulaiAt: "asc" },
    select: { id: true, selesaiAt: true, mulaiAt: true },
  });
}

/** Seluruh paket Mandiri published berseri pada mapel-mapel ini - bahan hitung jadwal (satu query). */
async function jadwalSeriUntuk(subjectIds: string[]): Promise<Map<string, Date>> {
  if (subjectIds.length === 0) return new Map();
  const rantai = await prisma.package.findMany({
    where: {
      subjectId: { in: subjectIds },
      kategori: "mandiri",
      status: "published",
      urutanSeri: { not: null },
    },
    select: { id: true, subjectId: true, urutanSeri: true, publishedAt: true, bukaMulai: true },
  });
  return hitungJadwalBukaSeri(rantai);
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

/**
 * Status buka SATU paket berseri untuk siswa tertentu (dipakai gerbang mulai
 * ujian di POST /api/siswa/attempts). `kandidatSebelumnya` adalah paket lain di
 * seri yang sama yang TERLIHAT siswa ini (mapel & kategori mandiri sama) -
 * paket yang tidak terlihat (mis. khusus sekolah lain) tidak boleh jadi
 * prasyarat, kalau tidak siswa terkunci selamanya.
 */
export async function statusSeriMandiri(
  studentId: string,
  target: { id: string; subjectId: string; urutanSeri: number | null },
  kandidatSebelumnya: KandidatSebelumnya[],
): Promise<StatusSeriMandiri> {
  if (target.urutanSeri == null) return { terkunci: false };

  const jadwal = await jadwalSeriUntuk([target.subjectId]);
  const sebelumnya = cariSebelumnya(target.urutanSeri, kandidatSebelumnya);
  const sebelumnyaSelesai = sebelumnya ? (await firstFinishedAttempt(studentId, sebelumnya.id)) != null : true;
  return putuskanStatusSeri({
    bukaPada: jadwal.get(target.id),
    sekarang: new Date(),
    sebelumnya,
    sebelumnyaSelesai,
  });
}

/**
 * Urutan seri harus unik per (subjectId, kategori "mandiri") - dua paket
 * dengan urutanSeri sama di mata pelajaran yang sama membuat jadwal buka &
 * prasyarat ambigu (mana yang lebih dulu?). Dicek di app/api/packages/route.ts
 * (POST) & [id]/route.ts (PATCH) sebelum disimpan. excludePackageId dipakai
 * saat edit supaya paket tidak dianggap bentrok dengan urutannya sendiri.
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
 * Anotasi status buka untuk daftar paket self-select siswa (dipakai GET
 * /api/siswa/ujian untuk menampilkan paket yang belum waktunya/gilirannya
 * sebagai terkunci, bukan disembunyikan). Jadwal dihitung dari SEMUA paket seri
 * published pada mapel yang tampil (timeline admin yang sama untuk semua
 * siswa); prasyarat urutan dicari dari paket yang terlihat siswa ini. Total dua
 * query terlepas dari jumlah paket: satu untuk jadwal, satu untuk paket
 * prasyarat yang sudah diselesaikan siswa.
 */
export async function annotateSeriMandiri<T extends PaketSeri>(
  studentId: string,
  packages: T[],
): Promise<(T & { statusSeri: StatusSeriMandiri })[]> {
  const berseri = (p: PaketSeri) => p.kategori === "mandiri" && p.urutanSeri != null;
  const seriTerlihat = packages.filter(berseri);

  const subjectIds = [...new Set(seriTerlihat.map((p) => p.subjectId))];
  const jadwal = await jadwalSeriUntuk(subjectIds);

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

  const idPrasyarat = [...new Set([...sebelumnyaById.values()].filter((s) => s != null).map((s) => s!.id))];
  const selesai = new Set<string>();
  if (idPrasyarat.length > 0) {
    const rows = await prisma.attempt.findMany({
      where: { studentId, assignmentId: null, status: { in: [...STATUS_SELESAI] }, packageId: { in: idPrasyarat } },
      select: { packageId: true },
      distinct: ["packageId"],
    });
    for (const r of rows) selesai.add(r.packageId);
  }

  const now = new Date();
  return packages.map((p) => {
    if (!berseri(p)) return { ...p, statusSeri: { terkunci: false } as StatusSeriMandiri };
    const sebelumnya = sebelumnyaById.get(p.id) ?? null;
    return {
      ...p,
      statusSeri: putuskanStatusSeri({
        bukaPada: jadwal.get(p.id),
        sekarang: now,
        sebelumnya,
        sebelumnyaSelesai: sebelumnya ? selesai.has(sebelumnya.id) : true,
      }),
    };
  });
}

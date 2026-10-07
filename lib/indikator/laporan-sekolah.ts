import "server-only";
import type { PrismaClient } from "@prisma/client";
import { filterMulai, type RentangWaktu } from "@/lib/analytics/sekolah";
import {
  hitungLaporanSekolah,
  type InfoIndikator,
  type JawabanSiswa,
  type LaporanIndikatorSekolah,
  type SiswaMeta,
} from "./daya-serap";

/**
 * Laporan daya serap per indikator untuk SATU sekolah dan SATU mata pelajaran, dari percobaan PERTAMA tiap siswa pada
 * tiap paket (konsisten dengan aturan rapor: nilai yang diulang tidak mengubah potret kemampuan awal). Hanya siswa Jalur A
 * milik sekolah yang belum dihapus; alumni tetap terhitung (data angkatan lalu tetap terlihat).
 */

/** Pilih percobaan paling awal (menurut waktu mulai, lalu id) untuk tiap pasangan siswa + paket. Murni. */
export function pilihPercobaanPertama<T extends { id: string; studentId: string; packageId: string; mulaiAt: Date }>(percobaan: T[]): T[] {
  const urut = [...percobaan].sort((a, b) => a.mulaiAt.getTime() - b.mulaiAt.getTime() || a.id.localeCompare(b.id));
  const terpilih = new Map<string, T>();
  for (const p of urut) {
    const kunci = `${p.studentId}|${p.packageId}`;
    if (!terpilih.has(kunci)) terpilih.set(kunci, p);
  }
  return [...terpilih.values()];
}

const UKURAN_KEPING = 1000;
function keping<T>(daftar: T[], ukuran = UKURAN_KEPING): T[][] {
  const hasil: T[][] = [];
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran));
  return hasil;
}

export interface MapelLaporan {
  subjectId: string;
  nama: string;
  jenjang: string;
  jumlahPercobaan: number;
}

const statusSelesai = ["selesai", "kedaluwarsa"] as const;

/** Mata pelajaran yang sudah punya percobaan selesai di sekolah ini (pada rentang yang dipilih), untuk pilihan di halaman laporan. */
export async function daftarMapelLaporan(db: PrismaClient, schoolId: string, rentang?: RentangWaktu | null): Promise<MapelLaporan[]> {
  const baris = await db.attempt.findMany({
    where: {
      status: { in: [...statusSelesai] },
      student: { schoolId, jalur: "A", deletedAt: null },
      ...filterMulai(rentang),
    },
    select: {
      id: true,
      studentId: true,
      packageId: true,
      mulaiAt: true,
      package: { select: { subjectId: true, subject: { select: { nama: true, jenjang: true } } } },
    },
  });
  const pertama = pilihPercobaanPertama(baris);
  const peta = new Map<string, MapelLaporan>();
  for (const p of pertama) {
    const s = p.package;
    const e = peta.get(s.subjectId) ?? { subjectId: s.subjectId, nama: s.subject.nama, jenjang: s.subject.jenjang, jumlahPercobaan: 0 };
    e.jumlahPercobaan++;
    peta.set(s.subjectId, e);
  }
  return [...peta.values()].sort((a, b) => a.jenjang.localeCompare(b.jenjang) || a.nama.localeCompare(b.nama));
}

export interface DataLaporanSekolah {
  sekolah: { id: string; nama: string };
  mapel: { subjectId: string; nama: string; jenjang: string };
  /** Siswa berbeda yang mengerjakan mapel ini (termasuk yang soalnya tidak berindikator resmi). */
  jumlahSiswaMengerjakan: number;
  /** Percobaan pertama yang dihitung. */
  jumlahPercobaan: number;
  jumlahPaket: number;
  /** Null bila tak ada soal berindikator resmi pada percobaan-percobaan itu. */
  laporan: LaporanIndikatorSekolah | null;
}

/** Bangun laporan satu sekolah + satu mapel. null bila sekolah tidak ada. */
export async function bangunLaporanIndikatorSekolah(
  db: PrismaClient,
  schoolId: string,
  subjectId: string,
  rentang?: RentangWaktu | null,
): Promise<DataLaporanSekolah | null> {
  const [sekolah, subject] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId }, select: { id: true, nama: true } }),
    db.subject.findUnique({ where: { id: subjectId }, select: { id: true, nama: true, jenjang: true } }),
  ]);
  if (!sekolah || !subject) return null;

  const percobaan = await db.attempt.findMany({
    where: {
      status: { in: [...statusSelesai] },
      student: { schoolId, jalur: "A", deletedAt: null },
      package: { subjectId },
      ...filterMulai(rentang),
    },
    select: { id: true, studentId: true, packageId: true, mulaiAt: true, student: { select: { nama: true, nisn: true } } },
  });
  const pertama = pilihPercobaanPertama(percobaan);

  const dasar: Omit<DataLaporanSekolah, "laporan"> = {
    sekolah: { id: sekolah.id, nama: sekolah.nama },
    mapel: { subjectId: subject.id, nama: subject.nama, jenjang: subject.jenjang },
    jumlahSiswaMengerjakan: new Set(pertama.map((p) => p.studentId)).size,
    jumlahPercobaan: pertama.length,
    jumlahPaket: new Set(pertama.map((p) => p.packageId)).size,
  };
  if (pertama.length === 0) return { ...dasar, laporan: null };

  // jawaban semua percobaan terpilih (dalam keping supaya daftar IN tidak membengkak)
  const penanda = new Map(pertama.map((p) => [p.id, p]));
  const jawaban: Array<{ attemptId: string; questionId: string; skor: number | null; skorMaks: number }> = [];
  for (const k of keping(pertama.map((p) => p.id))) {
    jawaban.push(
      ...(await db.attemptAnswer.findMany({
        where: { attemptId: { in: k } },
        select: { attemptId: true, questionId: true, skor: true, skorMaks: true },
      })),
    );
  }

  // soal -> indikator resmi (hanya soal yang tertaut)
  const idSoal = [...new Set(jawaban.map((j) => j.questionId))];
  const soalIndikator = new Map<string, string>();
  for (const k of keping(idSoal)) {
    const baris = await db.question.findMany({ where: { id: { in: k }, indikatorId: { not: null } }, select: { id: true, indikatorId: true } });
    for (const b of baris) if (b.indikatorId) soalIndikator.set(b.id, b.indikatorId);
  }
  const idIndikator = [...new Set(soalIndikator.values())];
  const infoIndikator = new Map<string, InfoIndikator>();
  for (const k of keping(idIndikator)) {
    const baris = await db.indikatorResmi.findMany({
      where: { id: { in: k } },
      select: { id: true, jenjang: true, namaMapel: true, elemen: true, subelemen: true, kompetensi: true, indikator: true, urutan: true, nilaiNasional: true },
    });
    for (const b of baris) infoIndikator.set(b.id, b);
  }

  const baris: JawabanSiswa[] = jawaban.map((j) => {
    const idInd = soalIndikator.get(j.questionId);
    return {
      studentId: penanda.get(j.attemptId)!.studentId,
      indikator: idInd ? (infoIndikator.get(idInd) ?? null) : null,
      skor: j.skor,
      skorMaks: j.skorMaks,
    };
  });
  const meta: SiswaMeta[] = [...new Map(pertama.map((p) => [p.studentId, { studentId: p.studentId, nama: p.student.nama, nisn: p.student.nisn }])).values()];

  return { ...dasar, laporan: hitungLaporanSekolah(baris, meta) };
}


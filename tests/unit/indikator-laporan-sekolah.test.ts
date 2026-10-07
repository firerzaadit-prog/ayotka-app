import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));

import { bangunLaporanIndikatorSekolah, daftarMapelLaporan, pilihPercobaanPertama } from "@/lib/indikator/laporan-sekolah";

const t = (jam: number) => new Date(`2026-10-05T${String(jam).padStart(2, "0")}:00:00Z`);

describe("pilihPercobaanPertama", () => {
  it("memilih percobaan paling awal untuk tiap pasangan siswa + paket", () => {
    const r = pilihPercobaanPertama([
      { id: "a2", studentId: "s1", packageId: "p1", mulaiAt: t(10) },
      { id: "a1", studentId: "s1", packageId: "p1", mulaiAt: t(8) },
      { id: "a3", studentId: "s1", packageId: "p2", mulaiAt: t(9) },
      { id: "a4", studentId: "s2", packageId: "p1", mulaiAt: t(11) },
    ]);
    expect(r.map((x) => x.id).sort()).toEqual(["a1", "a3", "a4"]);
  });

  it("waktu mulai sama: urutan id yang menentukan (deterministik, tidak tergantung urutan masukan)", () => {
    const a = pilihPercobaanPertama([
      { id: "b", studentId: "s1", packageId: "p1", mulaiAt: t(8) },
      { id: "a", studentId: "s1", packageId: "p1", mulaiAt: t(8) },
    ]);
    const b = pilihPercobaanPertama([
      { id: "a", studentId: "s1", packageId: "p1", mulaiAt: t(8) },
      { id: "b", studentId: "s1", packageId: "p1", mulaiAt: t(8) },
    ]);
    expect(a[0]!.id).toBe("a");
    expect(b[0]!.id).toBe("a");
  });

  it("tidak mengubah larik masukan; kosong -> kosong", () => {
    const m = [
      { id: "2", studentId: "s", packageId: "p", mulaiAt: t(9) },
      { id: "1", studentId: "s", packageId: "p", mulaiAt: t(8) },
    ];
    pilihPercobaanPertama(m);
    expect(m.map((x) => x.id)).toEqual(["2", "1"]);
    expect(pilihPercobaanPertama([])).toEqual([]);
  });
});

const IND = (n: number, o: Record<string, unknown> = {}) => ({
  id: `ind-${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: "Bilangan",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan X",
  indikator: `Indikator ${n} (${n})`,
  urutan: n,
  nilaiNasional: 50,
  ...o,
});

interface Skenario {
  sekolah?: { id: string; nama: string } | null;
  subject?: { id: string; nama: string; jenjang: string } | null;
  percobaan: Array<{ id: string; studentId: string; packageId: string; mulaiAt: Date; student: { nama: string; nisn: string | null } }>;
  jawaban: Array<{ attemptId: string; questionId: string; skor: number | null; skorMaks: number }>;
  soalIndikator: Record<string, string>;
  indikator: ReturnType<typeof IND>[];
}
function buatDb(s: Skenario) {
  const attemptFind = vi.fn(async () => s.percobaan);
  const db = {
    school: { findUnique: vi.fn(async () => (s.sekolah === undefined ? { id: "sek-1", nama: "SMPN 1 Contoh" } : s.sekolah)) },
    subject: { findUnique: vi.fn(async () => (s.subject === undefined ? { id: "subj-1", nama: "Matematika", jenjang: "SMP" } : s.subject)) },
    attempt: { findMany: attemptFind },
    attemptAnswer: {
      findMany: vi.fn(async ({ where }: { where: { attemptId: { in: string[] } } }) => s.jawaban.filter((j) => where.attemptId.in.includes(j.attemptId))),
    },
    question: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => s.soalIndikator[id]).map((id) => ({ id, indikatorId: s.soalIndikator[id] })),
      ),
    },
    indikatorResmi: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => s.indikator.filter((i) => where.id.in.includes(i.id))),
    },
  };
  return { db: db as unknown as PrismaClient, mentah: db, attemptFind };
}
const siswa = (id: string) => ({ nama: `Siswa ${id}`, nisn: `N-${id}` });

describe("bangunLaporanIndikatorSekolah", () => {
  it("sekolah atau mapel tidak ada -> null", async () => {
    expect(await bangunLaporanIndikatorSekolah(buatDb({ sekolah: null, percobaan: [], jawaban: [], soalIndikator: {}, indikator: [] }).db, "x", "y")).toBeNull();
    expect(await bangunLaporanIndikatorSekolah(buatDb({ subject: null, percobaan: [], jawaban: [], soalIndikator: {}, indikator: [] }).db, "x", "y")).toBeNull();
  });

  it("tidak ada percobaan selesai: ringkasan nol dan laporan null (tanpa membaca jawaban)", async () => {
    const { db, mentah } = buatDb({ percobaan: [], jawaban: [], soalIndikator: {}, indikator: [] });
    const r = await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1");
    expect(r).toMatchObject({ jumlahSiswaMengerjakan: 0, jumlahPercobaan: 0, jumlahPaket: 0, laporan: null });
    expect(r!.sekolah.nama).toBe("SMPN 1 Contoh");
    expect(mentah.attemptAnswer.findMany).not.toHaveBeenCalled();
  });

  it("hanya siswa Jalur A milik sekolah yang belum dihapus dan percobaan selesai/kedaluwarsa pada mapel itu (filter ke database)", async () => {
    const { db, attemptFind } = buatDb({ percobaan: [], jawaban: [], soalIndikator: {}, indikator: [] });
    await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1");
    const where = (attemptFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where).toMatchObject({
      status: { in: ["selesai", "kedaluwarsa"] },
      student: { schoolId: "sek-1", jalur: "A", deletedAt: null },
      package: { subjectId: "subj-1" },
    });
  });

  it("rentang waktu (periode) diteruskan sebagai filter waktu mulai", async () => {
    const { db, attemptFind } = buatDb({ percobaan: [], jawaban: [], soalIndikator: {}, indikator: [] });
    const dari = new Date("2026-07-01T00:00:00Z");
    const sampai = new Date("2026-12-31T00:00:00Z");
    await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1", { dari, sampai });
    const where = (attemptFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where.mulaiAt).toEqual({ gte: dari, lte: sampai });
  });

  it("menghitung dari PERCOBAAN PERTAMA saja: pengulangan tidak ikut", async () => {
    const percobaan = [
      { id: "a1", studentId: "s1", packageId: "p1", mulaiAt: t(8), student: siswa("1") }, // pertama: salah
      { id: "a2", studentId: "s1", packageId: "p1", mulaiAt: t(12), student: siswa("1") }, // ulangan: benar (diabaikan)
    ];
    const jawaban = [
      { attemptId: "a1", questionId: "q1", skor: 0, skorMaks: 1 },
      { attemptId: "a2", questionId: "q1", skor: 1, skorMaks: 1 },
    ];
    const { db } = buatDb({ percobaan, jawaban, soalIndikator: { q1: "ind-1" }, indikator: [IND(1)] });
    const r = (await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1"))!;
    expect(r).toMatchObject({ jumlahSiswaMengerjakan: 1, jumlahPercobaan: 1, jumlahPaket: 1 });
    expect(r.laporan!.kelompok[0]!.baris[0]).toMatchObject({ jmlSoal: 1, dayaSerap: 0 });
  });

  it("menggabungkan banyak siswa dan paket; soal tanpa indikator tidak masuk hitungan indikator tetapi masuk cakupan", async () => {
    const percobaan = [
      { id: "a1", studentId: "s1", packageId: "p1", mulaiAt: t(8), student: siswa("1") },
      { id: "a2", studentId: "s2", packageId: "p1", mulaiAt: t(9), student: siswa("2") },
      { id: "a3", studentId: "s1", packageId: "p2", mulaiAt: t(10), student: siswa("1") },
    ];
    const jawaban = [
      { attemptId: "a1", questionId: "q1", skor: 1, skorMaks: 1 },
      { attemptId: "a1", questionId: "q2", skor: 0, skorMaks: 1 }, // tanpa indikator
      { attemptId: "a2", questionId: "q1", skor: 0, skorMaks: 1 },
      { attemptId: "a2", questionId: "q2", skor: 1, skorMaks: 1 },
      { attemptId: "a3", questionId: "q3", skor: null, skorMaks: 1 },
    ];
    const { db } = buatDb({ percobaan, jawaban, soalIndikator: { q1: "ind-1", q3: "ind-1" }, indikator: [IND(1)] });
    const r = (await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1"))!;
    expect(r).toMatchObject({ jumlahSiswaMengerjakan: 2, jumlahPercobaan: 3, jumlahPaket: 2 });
    expect(r.laporan).toMatchObject({ jumlahJawaban: 5, jawabanBerindikator: 3, jumlahSiswa: 2 });
    expect(r.laporan!.kelompok[0]!.baris[0]).toMatchObject({ jmlSoal: 3, skor: 1, skorMaks: 3, jmlSiswa: 2 });
  });

  it("tidak ada soal berindikator resmi sama sekali: laporan null, tetapi ringkasan siswa tetap ada", async () => {
    const { db } = buatDb({
      percobaan: [{ id: "a1", studentId: "s1", packageId: "p1", mulaiAt: t(8), student: siswa("1") }],
      jawaban: [{ attemptId: "a1", questionId: "q1", skor: 1, skorMaks: 1 }],
      soalIndikator: {},
      indikator: [],
    });
    const r = (await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1"))!;
    expect(r.laporan).toBeNull();
    expect(r).toMatchObject({ jumlahSiswaMengerjakan: 1, jumlahPercobaan: 1 });
  });

  it("identitas siswa (nama, NISN) ikut ke daftar siswa perlu perhatian", async () => {
    const jawaban = Array.from({ length: 6 }, (_, i) => ({ attemptId: "a1", questionId: `q${i}`, skor: 0, skorMaks: 1 }));
    const { db } = buatDb({
      percobaan: [{ id: "a1", studentId: "s1", packageId: "p1", mulaiAt: t(8), student: siswa("1") }],
      jawaban,
      soalIndikator: Object.fromEntries(jawaban.map((j) => [j.questionId, "ind-1"])),
      indikator: [IND(1)],
    });
    const r = (await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1"))!;
    expect(r.laporan!.siswaPerhatian[0]).toMatchObject({ studentId: "s1", nama: "Siswa 1", nisn: "N-1" });
  });

  it("jawaban dibaca dalam keping (<=1000 percobaan per kueri) sehingga sekolah besar tidak membuat daftar IN raksasa", async () => {
    const percobaan = Array.from({ length: 2300 }, (_, i) => ({ id: `a${i}`, studentId: `s${i}`, packageId: "p1", mulaiAt: t(8), student: siswa(String(i)) }));
    const { db, mentah } = buatDb({ percobaan, jawaban: [], soalIndikator: {}, indikator: [] });
    await bangunLaporanIndikatorSekolah(db, "sek-1", "subj-1");
    const ukuran = mentah.attemptAnswer.findMany.mock.calls.map((c) => (c[0] as { where: { attemptId: { in: string[] } } }).where.attemptId.in.length);
    expect(ukuran).toEqual([1000, 1000, 300]);
  });
});

describe("daftarMapelLaporan", () => {
  it("mengelompokkan percobaan pertama per mapel, terurut jenjang lalu nama", async () => {
    const baris = [
      { id: "a1", studentId: "s1", packageId: "p1", mulaiAt: t(8), package: { subjectId: "m1", subject: { nama: "Matematika", jenjang: "SMP" } } },
      { id: "a2", studentId: "s1", packageId: "p1", mulaiAt: t(9), package: { subjectId: "m1", subject: { nama: "Matematika", jenjang: "SMP" } } }, // ulangan: tidak dihitung
      { id: "a3", studentId: "s2", packageId: "p1", mulaiAt: t(9), package: { subjectId: "m1", subject: { nama: "Matematika", jenjang: "SMP" } } },
      { id: "a4", studentId: "s1", packageId: "p9", mulaiAt: t(9), package: { subjectId: "m2", subject: { nama: "Bahasa Indonesia", jenjang: "SD" } } },
    ];
    const db = { attempt: { findMany: vi.fn(async () => baris) } } as unknown as PrismaClient;
    expect(await daftarMapelLaporan(db, "sek-1")).toEqual([
      { subjectId: "m2", nama: "Bahasa Indonesia", jenjang: "SD", jumlahPercobaan: 1 },
      { subjectId: "m1", nama: "Matematika", jenjang: "SMP", jumlahPercobaan: 2 },
    ]);
  });

  it("tanpa percobaan: daftar kosong", async () => {
    const db = { attempt: { findMany: vi.fn(async () => []) } } as unknown as PrismaClient;
    expect(await daftarMapelLaporan(db, "sek-1")).toEqual([]);
  });
});

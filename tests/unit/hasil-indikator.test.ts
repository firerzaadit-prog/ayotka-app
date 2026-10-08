import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  packageFind: vi.fn(),
  answersFind: vi.fn(),
  competencyFind: vi.fn(),
  studentFind: vi.fn(),
  wasFreeTrial: vi.fn(),
  buildRanking: vi.fn(),
  firstFinished: vi.fn(),
  berjawabPertama: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    package: { findUniqueOrThrow: m.packageFind },
    attemptAnswer: { findMany: m.answersFind },
    competencyScore: { findMany: m.competencyFind },
    student: { findUniqueOrThrow: m.studentFind },
  },
}));
vi.mock("@/lib/billing/entitlements", () => ({ wasAttemptFreeTrial: m.wasFreeTrial }));
vi.mock("@/lib/exam/ranking", () => ({ buildRanking: m.buildRanking }));
vi.mock("@/lib/exam/seri-mandiri", () => ({
  firstFinishedAttempt: m.firstFinished,
  percobaanBerjawabPertama: m.berjawabPertama,
}));

import { buildHasil } from "@/lib/exam/hasil";
import type { Attempt } from "@prisma/client";

const attempt = { id: "att-1", studentId: "s1", packageId: "p1", assignmentId: null, status: "selesai", mulaiAt: new Date(), selesaiAt: new Date(), skorAkhir: 50, skorMentah: 5, analisisAiDiminta: false } as Attempt;

const indikator = (n: number, o: Record<string, unknown> = {}) => ({
  id: `ind-${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: "Bilangan",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan X",
  subkompetensi: null,
  indikator: `Indikator ${n} (${n})`,
  teksKunci: `indikator ${n} (${n})`,
  urutan: n,
  nilaiNasional: 40,
  kdMapel: "MATP",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...o,
});
const jawab = (id: string, skor: number | null, ind: ReturnType<typeof indikator> | null, skorMaks = 1) => ({
  questionId: id,
  jawabanJson: null,
  skor,
  skorMaks,
  question: { id, format: "pg", teks: `Soal ${id}`, media: null, pembahasan: null, options: [], statements: [], categories: [], indikatorResmi: ind },
});

beforeEach(() => {
  vi.resetAllMocks();
  m.packageFind.mockResolvedValue({ nama: "Paket 1", kategori: "nasional", urutanSeri: null, acakOpsi: false });
  m.answersFind.mockResolvedValue([]);
  m.competencyFind.mockResolvedValue([]);
  m.studentFind.mockResolvedValue({ nama: "Siswa", nisn: null });
  m.wasFreeTrial.mockResolvedValue(false);
  m.buildRanking.mockResolvedValue(null);
});

describe("buildHasil.indikator - daya serap per indikator resmi", () => {
  it("meminta indikator resmi ikut dimuat bersama setiap soal", async () => {
    await buildHasil(attempt);
    expect(m.answersFind).toHaveBeenCalledWith(
      expect.objectContaining({ include: { question: { include: expect.objectContaining({ indikatorResmi: true }) } } }),
    );
  });

  it("tidak ada soal berindikator resmi -> indikator null (bagian rapor tidak tampil)", async () => {
    m.answersFind.mockResolvedValue([jawab("q1", 1, null), jawab("q2", 0, null)]);
    expect((await buildHasil(attempt)).indikator).toBeNull();
  });

  it("tanpa jawaban sama sekali -> null", async () => {
    expect((await buildHasil(attempt)).indikator).toBeNull();
  });

  it("menghitung daya serap per indikator dari skor dan skor maksimum tiap soal, dengan pembanding nasional", async () => {
    m.answersFind.mockResolvedValue([
      jawab("q1", 1, indikator(1)),
      jawab("q2", 1, indikator(1)),
      jawab("q3", 0, indikator(1)),
      jawab("q4", 0, indikator(2)),
      jawab("q5", 1, null), // soal di luar indikator resmi: tidak ikut hitungan indikator
    ]);
    const hasil = await buildHasil(attempt);
    const r = hasil.indikator!;
    expect(r).toMatchObject({ mapel: "Matematika", jenjang: "SMP", jumlahTingkat: 4, soalTercakup: 4, soalTotal: 5 });
    const baris = r.kelompok.flatMap((k) => k.baris);
    expect(baris.find((b) => b.indikatorId === "ind-1")).toMatchObject({ jmlSoal: 3, dayaSerap: (2 / 3) * 100, nasional: 40 });
    expect(baris.find((b) => b.indikatorId === "ind-2")).toMatchObject({ jmlSoal: 1, dayaSerap: 0 });
    // dua indikator, keduanya belum 100%: keduanya "terlemah" (terendah dulu) dan terkuat kosong (tidak boleh muncul di dua daftar)
    expect(r.terlemah.map((b) => b.indikatorId)).toEqual(["ind-2", "ind-1"]);
    expect(r.terkuat).toEqual([]);
  });

  it("skor null (belum dinilai) dihitung 0, dan skor sebagian ikut dihitung", async () => {
    m.answersFind.mockResolvedValue([jawab("q1", null, indikator(1)), jawab("q2", 1, indikator(1), 2)]);
    const [baris] = (await buildHasil(attempt)).indikator!.kelompok[0]!.baris;
    expect(baris).toMatchObject({ jmlSoal: 2, skor: 1, skorMaks: 3 });
  });

  it("bidang lain di hasil tidak berubah (perSoal, elemenScores) - penambahan murni aditif", async () => {
    m.answersFind.mockResolvedValue([jawab("q1", 1, indikator(1))]);
    const hasil = await buildHasil(attempt);
    expect(hasil.perSoal).toHaveLength(1);
    expect(hasil.perSoal[0]).toMatchObject({ questionId: "q1", skor: 1, skorMaks: 1 });
    expect(hasil.elemenScores).toEqual([]);
    expect(hasil.attempt.id).toBe("att-1");
  });
});

describe("buildHasil - nama elemen mengikuti Kerangka Asesmen (SD: 'Data', bukan 'Data dan Ketidakpastian')", () => {
  const skor = (elemenId: string, nama: string, urutan: number, subject: { nama: string; jenjang: string }) => ({
    jmlBenar: 2,
    jmlSoal: 4,
    persentase: 50,
    kompetensi: { deskripsi: `Kompetensi ${nama}`, elemen: { id: elemenId, nama, urutan, subject } },
  });

  it("indikator resmi SD Matematika: kelompok Elemen tampil 'Data', data master tidak berubah", async () => {
    const ind = indikator(1, { jenjang: "SD", elemen: "Data dan Ketidakpastian", subelemen: "Penyajian dan Penggunaan Data" });
    m.answersFind.mockResolvedValue([jawab("q1", 1, ind), jawab("q2", 0, ind)]);
    const hasil = await buildHasil(attempt);
    expect(hasil.indikator!.kelompok.map((k) => k.nama)).toEqual(["Data"]);
    expect(hasil.indikator!.kelompok[0]!.baris[0]).toMatchObject({ level1: "Data", level2: "Penyajian dan Penggunaan Data" });
    expect(ind.elemen).toBe("Data dan Ketidakpastian");
  });

  it("indikator resmi SMP Matematika tetap 'Data dan Peluang'", async () => {
    const ind = indikator(1, { jenjang: "SMP", elemen: "Data dan Peluang", subelemen: "Data" });
    m.answersFind.mockResolvedValue([jawab("q1", 1, ind)]);
    expect((await buildHasil(attempt)).indikator!.kelompok.map((k) => k.nama)).toEqual(["Data dan Peluang"]);
  });

  it("peta kompetensi per elemen: SD Matematika 'Data', SMP tetap 'Data dan Peluang', elemen lain tak berubah", async () => {
    m.competencyFind.mockResolvedValue([
      skor("e1", "Bilangan", 1, { nama: "Matematika", jenjang: "SD" }),
      skor("e2", "Data dan Ketidakpastian", 3, { nama: "Matematika", jenjang: "SD" }),
    ]);
    expect((await buildHasil(attempt)).elemenScores.map((e) => e.elemenNama)).toEqual(["Bilangan", "Data"]);

    m.competencyFind.mockResolvedValue([skor("e3", "Data dan Peluang", 4, { nama: "Matematika", jenjang: "SMP" })]);
    expect((await buildHasil(attempt)).elemenScores.map((e) => e.elemenNama)).toEqual(["Data dan Peluang"]);
  });

  it("elemen dengan nama 'Data dan Ketidakpastian' pada mapel lain / jenjang lain tidak ikut diubah", async () => {
    m.competencyFind.mockResolvedValue([
      skor("e1", "Data dan Ketidakpastian", 1, { nama: "Bahasa Indonesia", jenjang: "SD" }),
      skor("e2", "Data dan Ketidakpastian", 2, { nama: "Matematika", jenjang: "SMP" }),
    ]);
    expect((await buildHasil(attempt)).elemenScores.map((e) => e.elemenNama)).toEqual(["Data dan Ketidakpastian", "Data dan Ketidakpastian"]);
  });

  it("query peta kompetensi memuat mapel + jenjang elemen (dasar pemetaan label)", async () => {
    await buildHasil(attempt);
    expect(m.competencyFind).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          kompetensi: {
            select: {
              deskripsi: true,
              elemen: { select: expect.objectContaining({ subject: { select: { nama: true, jenjang: true } } }) },
            },
          },
        },
      }),
    );
  });
});

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

// Sengaja TIDAK ada `assignment` di prisma palsu ini: buildHasil tidak boleh membaca jendela waktu penugasan sama
// sekali (dulu pembahasan digerbang assignment.selesai). Kalau kode kembali membacanya, tes ini langsung galat.
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

const PG = {
  id: "q-pg",
  format: "pg",
  teks: "Hasil dari 2 + 2 adalah ...",
  media: null,
  pembahasan: "Karena 2 + 2 = 4.",
  options: [
    { id: "o1", urutan: 1, teks: "3", media: null, isCorrect: false },
    { id: "o2", urutan: 2, teks: "4", media: null, isCorrect: true },
  ],
  statements: [],
  categories: [],
  indikatorResmi: null,
};
const KATEGORI = {
  id: "q-kat",
  format: "pg_kategori",
  teks: "Tentukan benar atau salah.",
  media: null,
  pembahasan: "Pernyataan pertama benar, kedua salah.",
  options: [],
  categories: [
    { id: "c-benar", label: "Benar", urutan: 1 },
    { id: "c-salah", label: "Salah", urutan: 2 },
  ],
  statements: [
    { id: "s1", urutan: 1, teks: "2 + 2 = 4", media: null, correctCategoryId: "c-benar" },
    { id: "s2", urutan: 2, teks: "2 + 2 = 5", media: null, correctCategoryId: "c-salah" },
  ],
  indikatorResmi: null,
};
const jawaban = (question: typeof PG | typeof KATEGORI) => ({
  questionId: question.id,
  jawabanJson: {},
  skor: 0,
  skorMaks: 1,
  question,
});

const attempt = (extra: Partial<Attempt> = {}) =>
  ({
    id: "att-1",
    studentId: "siswa-1",
    packageId: "paket-1",
    assignmentId: null,
    status: "selesai",
    mulaiAt: new Date("2026-10-08T01:05:00Z"),
    selesaiAt: new Date("2026-10-08T01:35:00Z"),
    sisaDetik: 0,
    skorMentah: 0,
    skorAkhir: 0,
    analisisAiDiminta: false,
    ...extra,
  }) as Attempt;

beforeEach(() => {
  vi.resetAllMocks();
  m.packageFind.mockResolvedValue({ nama: "Paket", kategori: "mandiri", urutanSeri: null, acakOpsi: true });
  m.answersFind.mockResolvedValue([jawaban(PG), jawaban(KATEGORI)]);
  m.competencyFind.mockResolvedValue([]);
  m.studentFind.mockResolvedValue({ nama: "Siswa", nisn: "9990000001" });
  m.wasFreeTrial.mockResolvedValue(false);
  m.buildRanking.mockResolvedValue(null);
  m.firstFinished.mockResolvedValue(null);
  m.berjawabPertama.mockResolvedValue(null);
});

const KOMBINASI = [
  { nama: "Try Out Mandiri biasa", kategori: "mandiri", assignmentId: null, status: "selesai", gratis: false },
  { nama: "Try Out Mandiri, waktu habis", kategori: "mandiri", assignmentId: null, status: "kedaluwarsa", gratis: false },
  { nama: "Try Out Nasional", kategori: "nasional", assignmentId: null, status: "selesai", gratis: false },
  { nama: "Try Out Bersama sekolah (jendela penugasan MASIH terbuka)", kategori: "mandiri", assignmentId: "penugasan-1", status: "selesai", gratis: false },
  { nama: "Try Out Bersama sekolah, waktu habis", kategori: "mandiri", assignmentId: "penugasan-1", status: "kedaluwarsa", gratis: false },
  { nama: "siswa paket gratis", kategori: "mandiri", assignmentId: null, status: "selesai", gratis: true },
] as const;

describe("pembahasan LANGSUNG terbuka untuk semua siswa begitu percobaan selesai (keputusan 25 Sep dan 8 Okt 2026)", () => {
  it.each(KOMBINASI)("$nama: kunci, pembahasan, dan rincian pernyataan ikut dikirim", async (k) => {
    m.packageFind.mockResolvedValue({ nama: "Paket", kategori: k.kategori, urutanSeri: null, acakOpsi: true });
    m.wasFreeTrial.mockResolvedValue(k.gratis);
    const hasil = await buildHasil(attempt({ status: k.status, assignmentId: k.assignmentId }));

    expect(hasil.canShowPembahasan).toBe(true);
    const pg = hasil.perSoal.find((s) => s.questionId === "q-pg")!;
    expect(pg.pembahasan).toBe("Karena 2 + 2 = 4.");
    expect(pg.options).toHaveLength(2);
    expect(pg.options.filter((o) => o.isCorrect).map((o) => o.teks)).toEqual(["4"]);

    const kat = hasil.perSoal.find((s) => s.questionId === "q-kat")!;
    expect(kat.pembahasan).toBe("Pernyataan pertama benar, kedua salah.");
    expect(kat.categories.map((c) => c.label)).toEqual(["Benar", "Salah"]);
    expect(kat.statements.map((s) => [s.teks, s.correctLabel])).toEqual(
      expect.arrayContaining([
        ["2 + 2 = 4", "Benar"],
        ["2 + 2 = 5", "Salah"],
      ]),
    );
  });

  it("tidak pernah membaca jendela waktu penugasan (prisma palsu tidak punya `assignment`)", async () => {
    await expect(buildHasil(attempt({ assignmentId: "penugasan-1" }))).resolves.toMatchObject({ canShowPembahasan: true });
  });

  it("label opsi mengikuti urutan acak yang sama dengan saat ujian (A, B, ...), kunci tetap menunjuk opsi yang benar", async () => {
    const hasil = await buildHasil(attempt());
    const pg = hasil.perSoal.find((s) => s.questionId === "q-pg")!;
    expect(pg.options.map((o) => o.label).sort()).toEqual(["A", "B"]);
    expect(pg.options.find((o) => o.isCorrect)?.teks).toBe("4");
  });
});

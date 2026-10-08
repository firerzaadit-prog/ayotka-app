import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  attempts: vi.fn(),
  sekolah: vi.fn(),
  siswa: vi.fn(),
  paket: vi.fn(),
  skor: vi.fn(),
  jawaban: vi.fn(),
  upsert: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findMany: m.attempts },
    school: { findMany: m.sekolah },
    student: { findUniqueOrThrow: m.siswa },
    package: { findUniqueOrThrow: m.paket },
    competencyScore: { findMany: m.skor },
    attemptAnswer: { findMany: m.jawaban },
    aiAnalysis: { upsert: m.upsert },
  },
}));
vi.mock("@/lib/ai/gemini", () => ({ generateAnalisis: m.generate, MODEL_NAME: "model-uji" }));

import { buildAnalitikSekolah } from "@/lib/analytics/sekolah";
import { buildAnalitikGlobal } from "@/lib/analytics/global";
import { runAnalisisAi } from "@/lib/ai/analyze";
import type { Attempt } from "@prisma/client";

const SD = { nama: "Matematika", jenjang: "SD" };
const SMP = { nama: "Matematika", jenjang: "SMP" };
const kompetensi = (id: string, elemen: string, subject: { nama: string; jenjang: string }) => ({
  jmlBenar: 1,
  jmlSoal: 2,
  kompetensi: { id, deskripsi: `Kompetensi ${id}`, subElemen: "Sub", elemen: { nama: elemen, subject } },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("analitik sekolah - nama elemen sesuai Kerangka Asesmen", () => {
  it("elemen SD Matematika 'Data dan Ketidakpastian' tampil 'Data' (gabungan dan per mapel); SMP tak berubah", async () => {
    m.attempts.mockResolvedValue([
      {
        id: "a1",
        skorAkhir: 70,
        student: { id: "s1", nama: "Siswa", nisn: null },
        package: { subjectId: "m1", subject: { nama: "Matematika" } },
        competencyScores: [kompetensi("k1", "Data dan Ketidakpastian", SD), kompetensi("k2", "Bilangan", SD), kompetensi("k3", "Data dan Peluang", SMP)],
      },
    ]);
    const hasil = await buildAnalitikSekolah("sch-1", {});
    const elemen = (daftar: { deskripsi: string; elemen: string }[]) => Object.fromEntries(daftar.map((k) => [k.deskripsi, k.elemen]));
    expect(elemen(hasil.kompetensi)).toEqual({ "Kompetensi k1": "Data", "Kompetensi k2": "Bilangan", "Kompetensi k3": "Data dan Peluang" });
    expect(elemen(hasil.perMapel[0]!.kompetensi)).toEqual({ "Kompetensi k1": "Data", "Kompetensi k2": "Bilangan", "Kompetensi k3": "Data dan Peluang" });
  });

  it("query memuat mapel + jenjang elemen (dasar pemetaan)", async () => {
    m.attempts.mockResolvedValue([]);
    await buildAnalitikSekolah("sch-1", {});
    const select = m.attempts.mock.calls[0]![0].select.competencyScores.select.kompetensi.select;
    expect(select.elemen).toEqual({ select: { nama: true, subject: { select: { nama: true, jenjang: true } } } });
  });
});

describe("analitik global - nama elemen sesuai Kerangka Asesmen", () => {
  it("elemen SD Matematika tampil 'Data'; nama di tabel Elemen tidak disentuh", async () => {
    m.sekolah.mockResolvedValue([{ id: "sch-1", nama: "SD Uji", jenjang: "SD" }]);
    const elemenSumber = { nama: "Data dan Ketidakpastian", subject: SD };
    m.attempts.mockResolvedValue([
      {
        skorAkhir: 60,
        selesaiAt: new Date("2026-10-01T03:00:00Z"),
        mulaiAt: new Date("2026-10-01T02:00:00Z"),
        student: { id: "s1", schoolId: "sch-1" },
        competencyScores: [{ jmlBenar: 1, jmlSoal: 2, kompetensi: { id: "k1", deskripsi: "Kompetensi k1", elemen: elemenSumber } }],
      },
    ]);
    const hasil = await buildAnalitikGlobal({});
    expect(hasil.kompetensi.map((k) => k.elemen)).toEqual(["Data"]);
    expect(elemenSumber.nama).toBe("Data dan Ketidakpastian");
  });

  it("query memuat mapel + jenjang elemen (dasar pemetaan)", async () => {
    m.sekolah.mockResolvedValue([{ id: "sch-1", nama: "SD Uji", jenjang: "SD" }]);
    m.attempts.mockResolvedValue([]);
    await buildAnalitikGlobal({});
    const select = m.attempts.mock.calls[0]![0].select.competencyScores.select.kompetensi.select;
    expect(select.elemen).toEqual({ select: { nama: true, subject: { select: { nama: true, jenjang: true } } } });
  });
});

describe("Learning Analytics - prompt AI memakai nama elemen Kerangka Asesmen", () => {
  const attempt = { id: "att-1", studentId: "s1", packageId: "p1", skorAkhir: 50 } as Attempt;
  const soal = (elemen: string) => ({
    skor: 0,
    skorMaks: 1,
    jawabanJson: null,
    question: {
      teks: "Soal diagram batang",
      format: "pg",
      levelBloom: "L1",
      pembahasan: null,
      kompetensi: { deskripsi: "Menyajikan data", subElemen: "Penyajian dan Penggunaan Data", elemen: { nama: elemen } },
      options: [],
      statements: [],
      categories: [],
    },
  });

  beforeEach(() => {
    m.siswa.mockResolvedValue({ nama: "Siswa", userId: "u1" });
    m.generate.mockResolvedValue({ ringkasan: "ok" });
    m.upsert.mockResolvedValue({});
  });

  it("SD Matematika: 'Data dan Ketidakpastian' ditulis 'Data' di prompt (kompetensi dan tiap soal)", async () => {
    m.paket.mockResolvedValue({ nama: "Paket SD", jenjang: "SD", subject: { nama: "Matematika" } });
    m.skor.mockResolvedValue([
      { jmlBenar: 0, jmlSoal: 1, persentase: 0, kompetensi: { deskripsi: "Menyajikan data", subElemen: "Penyajian dan Penggunaan Data", elemen: { nama: "Data dan Ketidakpastian" } } },
    ]);
    m.jawaban.mockResolvedValue([soal("Data dan Ketidakpastian")]);
    await runAnalisisAi(attempt);
    const prompt: string = m.generate.mock.calls[0]![0];
    expect(prompt).toContain("[Materi: Data > Penyajian dan Penggunaan Data]");
    expect(prompt).toContain("[Data > Penyajian dan Penggunaan Data]");
    expect(prompt).not.toContain("Ketidakpastian");
  });

  it("SMP Matematika: nama elemen tak berubah", async () => {
    m.paket.mockResolvedValue({ nama: "Paket SMP", jenjang: "SMP", subject: { nama: "Matematika" } });
    m.skor.mockResolvedValue([
      { jmlBenar: 0, jmlSoal: 1, persentase: 0, kompetensi: { deskripsi: "Menafsirkan data", subElemen: "Data", elemen: { nama: "Data dan Peluang" } } },
    ]);
    m.jawaban.mockResolvedValue([soal("Data dan Peluang")]);
    await runAnalisisAi(attempt);
    expect(m.generate.mock.calls[0]![0]).toContain("[Materi: Data dan Peluang > Data]");
  });
});

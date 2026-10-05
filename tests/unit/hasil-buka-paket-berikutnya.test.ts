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

// Waktu dalam WIB. 2026-10-06 = Selasa, 2026-10-07 = Rabu.
const wib = (s: string) => new Date(`${s}+07:00`);

const attempt = (extra: Partial<Attempt> = {}) =>
  ({
    id: "att-1",
    studentId: "siswa-1",
    packageId: "paket-1",
    assignmentId: null,
    status: "selesai",
    mulaiAt: wib("2026-10-06T08:30:00"),
    selesaiAt: wib("2026-10-06T09:00:00"),
    sisaDetik: 5400,
    skorMentah: 8,
    skorAkhir: 80,
    analisisAiDiminta: false,
    ...extra,
  }) as Attempt;

beforeEach(() => {
  vi.resetAllMocks();
  m.packageFind.mockResolvedValue({ nama: "Paket 2", kategori: "mandiri", urutanSeri: 2, acakOpsi: true });
  m.answersFind.mockResolvedValue([]);
  m.competencyFind.mockResolvedValue([]);
  m.studentFind.mockResolvedValue({ nama: "Siswa", nisn: null });
  m.wasFreeTrial.mockResolvedValue(false);
  m.firstFinished.mockResolvedValue({ id: "att-1", selesaiAt: wib("2026-10-06T09:00:00"), mulaiAt: wib("2026-10-06T08:30:00") });
  // percobaan yang pertama kali dihitung "sudah mengerjakan" (selesai + minimal satu soal terjawab): bawaannya attempt ini
  m.berjawabPertama.mockResolvedValue(berjawab("att-1", wib("2026-10-06T08:30:00"), wib("2026-10-06T09:00:00")));
});

const berjawab = (id: string, mulaiAt: Date, selesaiAt: Date, status: "selesai" | "kedaluwarsa" = "selesai") => ({
  id,
  selesai: selesaiAt,
  percobaan: { id, status, mulaiAt, selesaiAt, sisaDetik: 5400, jumlahTerjawab: 12 },
});

describe("buildHasil.bukaPaketBerikutnya - keterangan kapan paket berikutnya di seri terbuka", () => {
  it("penyelesaian PERTAMA paket berseri: Rabu 06.00 WIB kalau selesai Selasa", async () => {
    const hasil = await buildHasil(attempt());
    expect(hasil.bukaPaketBerikutnya).toEqual(wib("2026-10-07T06:00:00"));
  });

  it("selesai dini hari Rabu 02.00 -> terbuka Rabu 06.00 hari itu juga", async () => {
    const hasil = await buildHasil(attempt({ mulaiAt: wib("2026-10-07T01:30:00"), selesaiAt: wib("2026-10-07T02:00:00") }));
    expect(hasil.bukaPaketBerikutnya).toEqual(wib("2026-10-07T06:00:00"));
  });

  it("percobaan kedaluwarsa yang baru ditutup belakangan dihitung dari batas waktunya", async () => {
    // mulai Selasa 08.30, batas 10.00; ditutup baru Kamis 20.00 -> tetap Rabu 06.00 (dari batas waktu)
    const a = attempt({ status: "kedaluwarsa", selesaiAt: wib("2026-10-08T20:00:00") });
    m.berjawabPertama.mockResolvedValue({
      ...berjawab("att-1", a.mulaiAt, a.selesaiAt!, "kedaluwarsa"),
      selesai: wib("2026-10-06T10:00:00"), // batas waktu (mulai 08.30 + 90 menit)
    });
    const hasil = await buildHasil(a);
    expect(hasil.bukaPaketBerikutnya).toEqual(wib("2026-10-07T06:00:00"));
  });

  it("pengerjaan ulang (percobaan berjawab pertamanya adalah yang lain) tidak mendapat keterangan", async () => {
    m.firstFinished.mockResolvedValue({ id: "att-lain" });
    m.berjawabPertama.mockResolvedValue(berjawab("att-lain", wib("2026-10-05T08:30:00"), wib("2026-10-05T09:00:00")));
    const hasil = await buildHasil(attempt());
    expect(hasil.bisaUnduhRapor).toBe(false);
    expect(hasil.bukaPaketBerikutnya).toBeNull();
    expect(hasil.paketBerseriBelumTerjawab).toBe(false);
  });

  it("percobaan ini kosong TETAPI sudah ada percobaan berjawab sebelumnya: tidak ada keterangan apa pun", async () => {
    m.berjawabPertama.mockResolvedValue(berjawab("att-lama", wib("2026-10-04T08:30:00"), wib("2026-10-04T09:00:00")));
    const hasil = await buildHasil(attempt());
    expect(hasil.bukaPaketBerikutnya).toBeNull();
    expect(hasil.paketBerseriBelumTerjawab).toBe(false);
  });

  it("dikumpulkan KOSONG dan belum ada percobaan berjawab sama sekali: tidak ada jadwal, siswa diberi tahu harus menjawab", async () => {
    m.berjawabPertama.mockResolvedValue(null);
    const hasil = await buildHasil(attempt());
    expect(hasil.bukaPaketBerikutnya).toBeNull();
    expect(hasil.paketBerseriBelumTerjawab).toBe(true);
  });

  it("percobaan KEDUA yang berjawab (setelah yang pertama kosong) mendapat jadwal dari waktunya sendiri", async () => {
    const kedua = attempt({ id: "att-2", mulaiAt: wib("2026-10-08T09:30:00"), selesaiAt: wib("2026-10-08T10:00:00") });
    m.berjawabPertama.mockResolvedValue(berjawab("att-2", wib("2026-10-08T09:30:00"), wib("2026-10-08T10:00:00")));
    const hasil = await buildHasil(kedua);
    expect(hasil.bukaPaketBerikutnya).toEqual(wib("2026-10-09T06:00:00"));
    expect(hasil.paketBerseriBelumTerjawab).toBe(false);
  });

  it("paket yang tidak berseri tidak mendapat keterangan dan tidak memicu query percobaan", async () => {
    m.packageFind.mockResolvedValue({ nama: "Latihan", kategori: "mandiri", urutanSeri: null, acakOpsi: true });
    const hasil = await buildHasil(attempt());
    expect(hasil.bukaPaketBerikutnya).toBeNull();
    expect(hasil.paketBerseriBelumTerjawab).toBe(false);
    expect(m.berjawabPertama).not.toHaveBeenCalled();
  });

  it("Ujian Terjadwal (assignmentId terisi) tidak ikut aturan seri", async () => {
    const hasil = await buildHasil(attempt({ assignmentId: "asg-1" }));
    expect(hasil.bukaPaketBerikutnya).toBeNull();
    expect(hasil.paketBerseriBelumTerjawab).toBe(false);
    expect(m.firstFinished).not.toHaveBeenCalled();
    expect(m.berjawabPertama).not.toHaveBeenCalled();
  });

  it("Try Out Nasional tidak mendapat keterangan", async () => {
    m.packageFind.mockResolvedValue({ nama: "Nasional", kategori: "nasional", urutanSeri: null, acakOpsi: true });
    expect((await buildHasil(attempt())).bukaPaketBerikutnya).toBeNull();
  });

  it("percobaan yang belum selesai tidak mendapat keterangan", async () => {
    const hasil = await buildHasil(attempt({ status: "berjalan", selesaiAt: null }));
    expect(hasil.bukaPaketBerikutnya).toBeNull();
    expect(hasil.paketBerseriBelumTerjawab).toBe(false);
  });
});

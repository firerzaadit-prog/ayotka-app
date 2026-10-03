import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  attempts: vi.fn(),
  periode: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findMany: m.attempts },
    periodeLangganan: { findFirst: m.periode },
  },
}));

import { buildAnalitikSekolah, buildDaftarSiswaKesiapanSekolah, buildKesiapanSekolah } from "@/lib/analytics/sekolah";
import { bacaRentangPeriode } from "@/lib/analytics/rentang";
import { akhirEfektif, rentangPeriode, segeraBerakhir, sisaHariWIB } from "@/lib/billing/periode-sekolah";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const DARI = startOfDayWIB("2026-01-01");
const SAMPAI = new Date(akhirHariWIB("2026-06-30").getTime() + 14 * 24 * 60 * 60 * 1000);
const whereTerakhir = () => m.attempts.mock.calls.at(-1)![0].where as Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  m.attempts.mockResolvedValue([]);
});

describe("filter periode pada analitik sekolah", () => {
  it("tanpa rentang: tidak ada penyaringan waktu", async () => {
    await buildAnalitikSekolah("sch-1", {});
    expect(whereTerakhir()).not.toHaveProperty("mulaiAt");
    await buildKesiapanSekolah("sch-1");
    expect(whereTerakhir()).not.toHaveProperty("mulaiAt");
    await buildKesiapanSekolah("sch-1", null);
    expect(whereTerakhir()).not.toHaveProperty("mulaiAt");
  });

  it("dengan rentang: percobaan disaring menurut waktu mulai ujian (gte dari, lte sampai)", async () => {
    await buildAnalitikSekolah("sch-1", { dari: DARI, sampai: SAMPAI });
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
    await buildKesiapanSekolah("sch-1", { dari: DARI, sampai: SAMPAI });
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
    await buildDaftarSiswaKesiapanSekolah("sch-1", { subjectNama: "Matematika", dari: DARI, sampai: SAMPAI });
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
  });

  it("rentang separuh terbuka hanya memasang batas yang ada", async () => {
    await buildAnalitikSekolah("sch-1", { dari: DARI });
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI });
    await buildAnalitikSekolah("sch-1", { sampai: SAMPAI });
    expect(whereTerakhir().mulaiAt).toEqual({ lte: SAMPAI });
  });

  it("subjectId tetap berlaku bersama rentang", async () => {
    await buildAnalitikSekolah("sch-1", { subjectId: "mapel-1", dari: DARI, sampai: SAMPAI });
    expect(whereTerakhir()).toMatchObject({ package: { subjectId: "mapel-1" }, mulaiAt: { gte: DARI, lte: SAMPAI } });
  });

  it("REGRESI: alumni tetap terhitung - filter siswa hanya mengecualikan yang DIHAPUS dan siswa mandiri (bukan yang lulus)", async () => {
    await buildAnalitikSekolah("sch-1", { dari: DARI, sampai: SAMPAI });
    expect(whereTerakhir().student).toEqual({ schoolId: "sch-1", jalur: "A", deletedAt: null });
    await buildKesiapanSekolah("sch-1");
    expect(whereTerakhir().student).toEqual({ schoolId: "sch-1", jalur: "A", deletedAt: null });
    await buildDaftarSiswaKesiapanSekolah("sch-1", { subjectNama: "Matematika" });
    expect(whereTerakhir().student).toEqual({ schoolId: "sch-1", jalur: "A", deletedAt: null });
  });

  it("hasil analitik dihitung dari percobaan yang lolos penyaringan", async () => {
    m.attempts.mockResolvedValue([
      {
        id: "a1",
        skorAkhir: 80,
        student: { id: "s1", nama: "Alumni A", nisn: null },
        package: { subjectId: "m1", subject: { nama: "Matematika" } },
        competencyScores: [],
      },
    ]);
    const hasil = await buildAnalitikSekolah("sch-1", { dari: DARI, sampai: SAMPAI });
    expect(hasil.jumlahAttempt).toBe(1);
    expect(hasil.ranking[0]).toMatchObject({ nama: "Alumni A", rataRata: 80 });
  });
});

describe("bacaRentangPeriode", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";
  const url = (qs = "") => new URL(`http://localhost/api/admin-sekolah/analitik${qs}`);

  it("tanpa periodeId: semua waktu (rentang null), tidak membaca database", async () => {
    expect(await bacaRentangPeriode(url(), "sch-1")).toEqual({ rentang: null });
    expect(m.periode).not.toHaveBeenCalled();
  });

  it("periodeId bukan UUID: 400 tanpa menyentuh database", async () => {
    const hasil = await bacaRentangPeriode(url("?periodeId=bukan-uuid"), "sch-1");
    expect("galat" in hasil && hasil.galat.status).toBe(400);
    expect(m.periode).not.toHaveBeenCalled();
  });

  it("periode tidak ada, sudah dicabut, atau milik sekolah lain: 404 (pencarian dibatasi sekolah dan belum dicabut)", async () => {
    m.periode.mockResolvedValue(null);
    const hasil = await bacaRentangPeriode(url(`?periodeId=${UUID}`), "sch-1");
    expect("galat" in hasil && hasil.galat.status).toBe(404);
    expect(m.periode).toHaveBeenCalledWith({ where: { id: UUID, schoolId: "sch-1", dicabutAt: null } });
  });

  it("periode sah: rentang dari awal periode sampai akhir masa tenggang", async () => {
    const periode = { mulai: DARI, berakhir: akhirHariWIB("2026-06-30"), masaTenggangHari: 14 };
    m.periode.mockResolvedValue(periode);
    const hasil = await bacaRentangPeriode(url(`?periodeId=${UUID}`), "sch-1");
    expect(hasil).toEqual({ rentang: { dari: DARI, sampai: SAMPAI } });
  });
});

describe("sisaHariWIB dan segeraBerakhir (penanda H-7)", () => {
  const berakhir = akhirHariWIB("2026-03-08");
  const periode = (lain: Partial<Parameters<typeof segeraBerakhir>[0]> = {}) => ({
    mulai: startOfDayWIB("2026-01-01"),
    berakhir,
    masaTenggangHari: 14,
    dicabutAt: null,
    ...lain,
  });
  const wib = (tanggal: string, jam: string) => new Date(startOfDayWIB(tanggal).getTime() + Number(jam.split(":")[0]) * 3600_000 + Number(jam.split(":")[1]) * 60_000);

  it("menghitung selisih tanggal kalender WIB: H-7, hari terakhir (0), dan sudah lewat (negatif)", () => {
    expect(sisaHariWIB(berakhir, wib("2026-03-01", "12:00"))).toBe(7);
    expect(sisaHariWIB(berakhir, wib("2026-03-08", "12:00"))).toBe(0);
    expect(sisaHariWIB(berakhir, wib("2026-03-09", "00:00"))).toBe(-1);
  });

  it("tidak meleset sehari di sekitar tengah malam WIB (23.59 masih hari yang sama, 00.00 hari berikutnya)", () => {
    expect(sisaHariWIB(berakhir, wib("2026-03-07", "23:59"))).toBe(1);
    expect(sisaHariWIB(berakhir, wib("2026-03-08", "00:00"))).toBe(0);
    expect(sisaHariWIB(berakhir, wib("2026-03-08", "23:59"))).toBe(0);
    expect(sisaHariWIB(berakhir, wib("2026-03-09", "00:00"))).toBe(-1);
  });

  it("segeraBerakhir mulai tepat H-7: H-8 belum, H-7 sampai hari terakhir ya", () => {
    expect(segeraBerakhir(periode(), wib("2026-02-28", "12:00"))).toBe(false); // H-8
    expect(segeraBerakhir(periode(), wib("2026-03-01", "00:00"))).toBe(true); // H-7
    expect(segeraBerakhir(periode(), wib("2026-03-07", "12:00"))).toBe(true); // H-1
    expect(segeraBerakhir(periode(), wib("2026-03-08", "20:00"))).toBe(true); // hari terakhir, masih aktif
  });

  it("masa tenggang, belum mulai, dan yang dicabut bukan 'segera berakhir'", () => {
    expect(segeraBerakhir(periode(), wib("2026-03-09", "00:00"))).toBe(false); // tenggang
    expect(segeraBerakhir(periode({ mulai: startOfDayWIB("2026-03-05") }), wib("2026-03-01", "12:00"))).toBe(false); // akan datang
    expect(segeraBerakhir(periode({ dicabutAt: new Date() }), wib("2026-03-05", "12:00"))).toBe(false);
  });

  it("rentangPeriode: dari awal periode sampai akhir efektif (termasuk tenggang)", () => {
    const p = periode();
    expect(rentangPeriode(p)).toEqual({ dari: p.mulai, sampai: akhirEfektif(p) });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { packageModel, attempt } = vi.hoisted(() => ({
  packageModel: { findFirst: vi.fn(), findMany: vi.fn() },
  attempt: { findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { package: packageModel, attempt } }));

import { besokJam6WIB } from "@/lib/utils/datetime";
import { statusSeriMandiri, annotateSeriMandiri, urutanSeriBentrok } from "@/lib/exam/seri-mandiri";

describe("besokJam6WIB", () => {
  it("hari yang sama jam berapa pun -> besok jam 06:00 WIB (23:00 UTC = 06:00 WIB hari berikutnya)", () => {
    // 2026-09-30 10:00 WIB (03:00 UTC) -> besok 2026-10-01 06:00 WIB (2026-09-30 23:00 UTC)
    const hasil = besokJam6WIB(new Date("2026-09-30T03:00:00.000Z"));
    expect(hasil.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("tanggal kalender WIB dipakai, bukan tanggal UTC mentah - jam 20:00 UTC 30 Sep sudah masuk 1 Okt di WIB (03:00)", () => {
    // 2026-09-30T20:00:00Z = 2026-10-01 03:00 WIB -> besok (2 Okt) jam 06:00 WIB = 2026-10-01T23:00:00Z
    const hasil = besokJam6WIB(new Date("2026-09-30T20:00:00.000Z"));
    expect(hasil.toISOString()).toBe("2026-10-01T23:00:00.000Z");
  });
});

// Lima paket seri MTK dipublish bersamaan Jumat 2 Okt 2026 14:00 WIB (07:00Z).
// Jadwal buka: A langsung; B 3 Okt 06.00 WIB; C 4 Okt; D 5 Okt; E 6 Okt (semua 06.00 WIB).
const TERBIT = "2026-10-02T07:00:00.000Z";
const NAMA = ["A", "B", "C", "D", "E"];
const PAKET = NAMA.map((n, i) => ({
  id: `p-${n.toLowerCase()}`,
  nama: `Paket ${n}`,
  subjectId: "mtk",
  kategori: "mandiri" as const,
  urutanSeri: i + 1,
}));
const BARIS_JADWAL = PAKET.map((p) => ({
  id: p.id,
  subjectId: p.subjectId,
  urutanSeri: p.urutanSeri,
  publishedAt: TERBIT,
  bukaMulai: null,
}));
const byNama = (n: string) => PAKET.find((p) => p.nama === `Paket ${n}`)!;

describe("annotateSeriMandiri - jadwal global + wajib selesaikan urutan sebelumnya", () => {
  beforeEach(() => {
    packageModel.findMany.mockReset();
    attempt.findMany.mockReset();
    packageModel.findMany.mockResolvedValue(BARIS_JADWAL);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const selesai = (...ids: string[]) => attempt.findMany.mockResolvedValue(ids.map((packageId) => ({ packageId })));

  it("skenario absen: hari ke-5 semua paket sudah terbuka menurut jadwal, siswa baru menyelesaikan A -> hanya B yang bisa", async () => {
    vi.setSystemTime(new Date("2026-10-06T03:00:00.000Z")); // 6 Okt 10.00 WIB: jadwal A-E semua sudah lewat
    selesai("p-a");
    const hasil = await annotateSeriMandiri("siswa1", PAKET);
    const st = Object.fromEntries(hasil.map((p) => [p.nama, p.statusSeri]));

    expect(st["Paket A"]).toEqual({ terkunci: false });
    expect(st["Paket B"]).toEqual({ terkunci: false }); // A sudah selesai
    expect(st["Paket C"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket B" });
    expect(st["Paket D"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket C" });
    expect(st["Paket E"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket D" });
  });

  it("begitu B selesai, C (jadwal sudah lewat) langsung terbuka tanpa menunggu besok; D tetap menunggu C", async () => {
    vi.setSystemTime(new Date("2026-10-06T03:00:00.000Z"));
    selesai("p-a", "p-b");
    const hasil = await annotateSeriMandiri("siswa1", PAKET);
    const st = Object.fromEntries(hasil.map((p) => [p.nama, p.statusSeri]));

    expect(st["Paket C"]).toEqual({ terkunci: false });
    expect(st["Paket D"]).toMatchObject({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket C" });
  });

  it("siswa yang selesai semua paket sebelumnya tetap menunggu jadwal paket berikutnya (belum 06.00 WIB)", async () => {
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z")); // 3 Okt 07.00 WIB: B sudah buka, C baru 4 Okt 06.00
    selesai("p-a", "p-b");
    const hasil = await annotateSeriMandiri("siswa1", PAKET);
    const st = Object.fromEntries(hasil.map((p) => [p.nama, p.statusSeri]));

    expect(st["Paket B"]).toEqual({ terkunci: false });
    expect(st["Paket C"]).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", prasyarat: null });
    if (st["Paket C"]!.terkunci && st["Paket C"]!.alasan === "menunggu_jadwal") {
      expect(st["Paket C"]!.bukaPada.toISOString()).toBe("2026-10-03T23:00:00.000Z");
    }
  });

  it("belum waktunya DAN urutan sebelumnya belum selesai -> menunggu_jadwal + prasyarat disebut", async () => {
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z")); // B sudah buka; C belum; siswa belum selesaikan B
    selesai("p-a");
    const hasil = await annotateSeriMandiri("siswa1", PAKET);
    const c = hasil.find((p) => p.nama === "Paket C")!.statusSeri;
    expect(c).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", prasyarat: "Paket B" });
  });

  it("paket pertama tidak punya prasyarat; Nasional & paket tanpa urutan tidak ikut aturan seri", async () => {
    vi.setSystemTime(new Date("2026-10-02T08:00:00.000Z"));
    selesai();
    const hasil = await annotateSeriMandiri("siswa1", [
      byNama("A"),
      { id: "n", nama: "Nasional", subjectId: "mtk", kategori: "nasional" as const, urutanSeri: 2 },
      { id: "bebas", nama: "Bebas", subjectId: "mtk", kategori: "mandiri" as const, urutanSeri: null },
    ]);
    expect(hasil.map((p) => p.statusSeri)).toEqual([{ terkunci: false }, { terkunci: false }, { terkunci: false }]);
  });

  it("prasyarat dicari dari paket yang TERLIHAT siswa (paket seri yang tidak terlihat dilewati)", async () => {
    vi.setSystemTime(new Date("2026-10-06T03:00:00.000Z"));
    selesai("p-a");
    // Siswa tidak melihat Paket B (mis. khusus sekolah lain) -> prasyarat C adalah A, bukan B.
    const hasil = await annotateSeriMandiri("siswa1", [byNama("A"), byNama("C")]);
    const c = hasil.find((p) => p.nama === "Paket C")!.statusSeri;
    expect(c).toEqual({ terkunci: false });
  });

  it("hanya menghitung attempt jalur self-select yang selesai/kedaluwarsa, milik siswa ini", async () => {
    vi.setSystemTime(new Date("2026-10-06T03:00:00.000Z"));
    selesai();
    await annotateSeriMandiri("siswa-x", PAKET);
    expect(attempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "siswa-x",
          assignmentId: null,
          status: { in: ["selesai", "kedaluwarsa"] },
        }),
      }),
    );
  });

  it("tanpa paket berseri tidak ada query sama sekali", async () => {
    const hasil = await annotateSeriMandiri("siswa1", [
      { id: "bebas", nama: "Bebas", subjectId: "mtk", kategori: "mandiri" as const, urutanSeri: null },
    ]);
    expect(hasil[0]!.statusSeri).toEqual({ terkunci: false });
    expect(packageModel.findMany).not.toHaveBeenCalled();
    expect(attempt.findMany).not.toHaveBeenCalled();
  });
});

describe("statusSeriMandiri (gerbang mulai ujian)", () => {
  beforeEach(() => {
    packageModel.findMany.mockReset();
    attempt.findFirst.mockReset();
    packageModel.findMany.mockResolvedValue(BARIS_JADWAL);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T03:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const target = (n: string) => {
    const p = byNama(n);
    return { id: p.id, subjectId: p.subjectId, urutanSeri: p.urutanSeri };
  };

  it("urutanSeri null -> selalu terbuka, tidak query apa pun", async () => {
    expect(await statusSeriMandiri("s1", { id: "x", subjectId: "mtk", urutanSeri: null }, PAKET)).toEqual({ terkunci: false });
    expect(packageModel.findMany).not.toHaveBeenCalled();
    expect(attempt.findFirst).not.toHaveBeenCalled();
  });

  it("paket pertama -> terbuka tanpa cek attempt", async () => {
    expect(await statusSeriMandiri("s1", target("A"), PAKET)).toEqual({ terkunci: false });
    expect(attempt.findFirst).not.toHaveBeenCalled();
  });

  it("jadwal sudah lewat tapi urutan sebelumnya belum diselesaikan -> belum_giliran", async () => {
    attempt.findFirst.mockResolvedValue(null);
    expect(await statusSeriMandiri("s1", target("C"), PAKET)).toEqual({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket B",
    });
    expect(attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "s1", packageId: "p-b", assignmentId: null, status: { in: ["selesai", "kedaluwarsa"] } },
      }),
    );
  });

  it("urutan sebelumnya sudah diselesaikan dan jadwal sudah lewat -> terbuka sekarang juga", async () => {
    attempt.findFirst.mockResolvedValue({ id: "att", selesaiAt: new Date(), mulaiAt: new Date() });
    expect(await statusSeriMandiri("s1", target("C"), PAKET)).toEqual({ terkunci: false });
  });

  it("jadwal belum tiba -> terkunci menunggu_jadwal walau urutan sebelumnya sudah selesai", async () => {
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z")); // B baru buka 2 Okt 23:00Z
    attempt.findFirst.mockResolvedValue({ id: "att", selesaiAt: new Date(), mulaiAt: new Date() });
    const hasil = await statusSeriMandiri("s1", target("B"), PAKET);
    expect(hasil).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", prasyarat: null });
  });

  it("mencari urutan TEPAT SEBELUMNYA (E butuh D, bukan A)", async () => {
    attempt.findFirst.mockResolvedValue(null);
    await statusSeriMandiri("s1", target("E"), PAKET);
    expect(attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ packageId: "p-d" }) }),
    );
  });
});

describe("urutanSeriBentrok", () => {
  beforeEach(() => {
    packageModel.findFirst.mockReset();
  });

  it("bentrok kalau ada paket lain di mapel & kategori sama dengan urutan yang sama", async () => {
    packageModel.findFirst.mockResolvedValue({ id: "pkt-lain" });
    expect(await urutanSeriBentrok("mtk", 2)).toBe(true);
    expect(packageModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ subjectId: "mtk", kategori: "mandiri", urutanSeri: 2 }) }),
    );
  });

  it("tidak bentrok kalau tidak ada yang pakai urutan itu", async () => {
    packageModel.findFirst.mockResolvedValue(null);
    expect(await urutanSeriBentrok("mtk", 2)).toBe(false);
  });

  it("mengecualikan paket itu sendiri saat diedit (excludePackageId)", async () => {
    packageModel.findFirst.mockResolvedValue(null);
    await urutanSeriBentrok("mtk", 2, "pkt-saya");
    expect(packageModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "pkt-saya" } }) }),
    );
  });
});

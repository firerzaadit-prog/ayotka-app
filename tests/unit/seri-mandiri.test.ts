import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { attempt, packageModel } = vi.hoisted(() => ({ attempt: { findFirst: vi.fn() }, packageModel: { findFirst: vi.fn() } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { attempt, package: packageModel } }));

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

const PAKET_A = { id: "pkt-a", nama: "Paket A", urutanSeri: 1 };
const PAKET_B = { id: "pkt-b", nama: "Paket B", urutanSeri: 2 };
const PAKET_C = { id: "pkt-c", nama: "Paket C", urutanSeri: 3 };
const SERI = [PAKET_A, PAKET_B, PAKET_C];

describe("statusSeriMandiri", () => {
  beforeEach(() => {
    attempt.findFirst.mockReset();
  });

  it("urutanSeri null -> selalu terbuka, tidak query apa pun", async () => {
    const hasil = await statusSeriMandiri("siswa1", { id: "pkt-x", urutanSeri: null }, SERI);
    expect(hasil).toEqual({ terkunci: false });
    expect(attempt.findFirst).not.toHaveBeenCalled();
  });

  it("paket pertama di seri (tidak ada urutan sebelumnya) -> selalu terbuka", async () => {
    const hasil = await statusSeriMandiri("siswa1", PAKET_A, SERI);
    expect(hasil).toEqual({ terkunci: false });
    expect(attempt.findFirst).not.toHaveBeenCalled();
  });

  it("paket sebelumnya belum pernah diselesaikan -> terkunci, alasan belum_giliran", async () => {
    attempt.findFirst.mockResolvedValue(null);
    const hasil = await statusSeriMandiri("siswa1", PAKET_B, SERI);
    expect(hasil).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket A" });
    expect(attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "siswa1", packageId: "pkt-a", assignmentId: null, status: { in: ["selesai", "kedaluwarsa"] } },
        orderBy: { mulaiAt: "asc" },
      }),
    );
  });

  it("paket sebelumnya sudah selesai tapi belum lewat jam 06:00 WIB besoknya -> terkunci, alasan menunggu_besok", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T10:00:00.000Z")); // masih di hari yang sama dengan selesaiAt
    attempt.findFirst.mockResolvedValue({ id: "att-1", selesaiAt: new Date("2026-09-30T03:00:00.000Z"), mulaiAt: new Date("2026-09-30T02:00:00.000Z") });

    const hasil = await statusSeriMandiri("siswa1", PAKET_B, SERI);
    expect(hasil.terkunci).toBe(true);
    if (hasil.terkunci && hasil.alasan === "menunggu_besok") {
      expect(hasil.bukaPada.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    } else {
      throw new Error("expected alasan menunggu_besok");
    }
    vi.useRealTimers();
  });

  it("paket sebelumnya sudah selesai dan sudah lewat jam 06:00 WIB besoknya -> terbuka", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T23:30:00.000Z")); // jauh setelah unlock
    attempt.findFirst.mockResolvedValue({ id: "att-1", selesaiAt: new Date("2026-09-30T03:00:00.000Z"), mulaiAt: new Date("2026-09-30T02:00:00.000Z") });

    const hasil = await statusSeriMandiri("siswa1", PAKET_B, SERI);
    expect(hasil).toEqual({ terkunci: false });
    vi.useRealTimers();
  });

  it("mencari urutan TEPAT SEBELUMNYA, bukan urutan pertama di seri (Paket C butuh Paket B, bukan Paket A)", async () => {
    attempt.findFirst.mockResolvedValue(null);
    await statusSeriMandiri("siswa1", PAKET_C, SERI);
    expect(attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ packageId: "pkt-b" }) }),
    );
  });
});

describe("annotateSeriMandiri", () => {
  beforeEach(() => {
    attempt.findFirst.mockReset();
  });

  it("paket kategori nasional tidak ikut aturan seri walau urutanSeri terisi", async () => {
    const hasil = await annotateSeriMandiri("siswa1", [
      { id: "pkt-n", nama: "Paket Nasional", subjectId: "mtk", kategori: "nasional", urutanSeri: 2 },
    ]);
    expect(hasil[0]!.statusSeri).toEqual({ terkunci: false });
    expect(attempt.findFirst).not.toHaveBeenCalled();
  });

  it("mengelompokkan kandidat per subjectId - paket subjek lain tidak saling mengunci", async () => {
    attempt.findFirst.mockResolvedValue(null);
    const hasil = await annotateSeriMandiri("siswa1", [
      { id: "mtk-a", nama: "MTK Paket A", subjectId: "mtk", kategori: "mandiri", urutanSeri: 1 },
      { id: "bindo-a", nama: "Bindo Paket A", subjectId: "bindo", kategori: "mandiri", urutanSeri: 1 },
      { id: "mtk-b", nama: "MTK Paket B", subjectId: "mtk", kategori: "mandiri", urutanSeri: 2 },
    ]);
    const byId = Object.fromEntries(hasil.map((p) => [p.id, p.statusSeri]));
    expect(byId["mtk-a"]).toEqual({ terkunci: false }); // paket pertama di seri MTK
    expect(byId["bindo-a"]).toEqual({ terkunci: false }); // paket pertama di seri Bindo (subjek beda, tidak terpengaruh MTK)
    expect(byId["mtk-b"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "MTK Paket A" });
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

import { describe, expect, it } from "vitest";
import {
  formatWIB,
  formatWIBDate,
  formatWIBHariTanggal,
  formatWIBHariTanggalJam,
  formatWIBJam,
  startOfDayWIB,
} from "@/lib/utils/datetime";

describe("formatWIB (Tiket 1.8: simpan UTC, tampilkan WIB)", () => {
  it("menggeser waktu UTC +7 jam untuk WIB", () => {
    // 2026-01-01T00:00:00Z UTC = 2026-01-01T07:00:00 WIB
    const utcMidnight = new Date("2026-01-01T00:00:00.000Z");
    expect(formatWIB(utcMidnight, "yyyy-MM-dd HH:mm")).toBe("2026-01-01 07:00 WIB");
  });

  it("bisa lintas hari saat digeser ke WIB", () => {
    // 2026-01-01T20:00:00Z UTC = 2026-01-02T03:00:00 WIB
    const lateUtc = new Date("2026-01-01T20:00:00.000Z");
    expect(formatWIB(lateUtc, "yyyy-MM-dd HH:mm")).toBe("2026-01-02 03:00 WIB");
  });

  it("formatWIBDate hanya menampilkan tanggal", () => {
    expect(formatWIBDate("2026-03-17T10:00:00.000Z")).toBe("17 Maret 2026 WIB");
  });
});

describe("formatWIBHariTanggal / formatWIBJam (hari + tanggal + bulan + tahun terbit paket)", () => {
  it("menampilkan nama hari, tanggal, bulan, dan tahun dalam bahasa Indonesia", () => {
    // 2026-10-01 adalah hari Kamis
    expect(formatWIBHariTanggal("2026-10-01T03:00:00.000Z")).toBe("Kamis, 1 Oktober 2026");
  });

  it("hari mengikuti tanggal WIB, bukan UTC (lintas tengah malam)", () => {
    // 2026-10-01T20:00Z = Jumat 2 Oktober 2026 03:00 WIB
    expect(formatWIBHariTanggal("2026-10-01T20:00:00.000Z")).toBe("Jumat, 2 Oktober 2026");
  });

  it("formatWIBJam memakai titik dan akhiran WIB", () => {
    expect(formatWIBJam("2026-10-01T23:00:00.000Z")).toBe("06.00 WIB");
  });

  it("formatWIBHariTanggalJam menggabungkan keduanya", () => {
    expect(formatWIBHariTanggalJam("2026-10-01T23:00:00.000Z")).toBe("Jumat, 2 Oktober 2026 pukul 06.00 WIB");
  });
});

describe("startOfDayWIB (Tiket 7.3: filter tanggal audit log dari input date HTML)", () => {
  it("00:00 WIB = 17:00 UTC hari sebelumnya (WIB = UTC+7)", () => {
    expect(startOfDayWIB("2026-03-17")).toEqual(new Date("2026-03-16T17:00:00.000Z"));
  });

  it("hasilnya bisa dipakai formatWIB balik jadi tanggal yang sama", () => {
    const start = startOfDayWIB("2026-08-01");
    expect(formatWIB(start, "yyyy-MM-dd HH:mm")).toBe("2026-08-01 00:00 WIB");
  });
});

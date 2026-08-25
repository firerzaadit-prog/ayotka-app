import { describe, expect, it } from "vitest";
import { formatWIB, formatWIBDate, startOfDayWIB } from "@/lib/utils/datetime";

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

describe("startOfDayWIB (Tiket 7.3: filter tanggal audit log dari input date HTML)", () => {
  it("00:00 WIB = 17:00 UTC hari sebelumnya (WIB = UTC+7)", () => {
    expect(startOfDayWIB("2026-03-17")).toEqual(new Date("2026-03-16T17:00:00.000Z"));
  });

  it("hasilnya bisa dipakai formatWIB balik jadi tanggal yang sama", () => {
    const start = startOfDayWIB("2026-08-01");
    expect(formatWIB(start, "yyyy-MM-dd HH:mm")).toBe("2026-08-01 00:00 WIB");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatWIB,
  formatWIBDate,
  formatWIBHariTanggal,
  formatWIBHariTanggalJam,
  formatWIBJam,
  jam6WIBBerikutnya,
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

describe("jam6WIBBerikutnya (buka paket seri Try Out Mandiri: 06.00 WIB pertama setelah selesai)", () => {
  // 06.00 WIB = 23.00 UTC hari sebelumnya.
  const hasil = (iso: string) => jam6WIBBerikutnya(new Date(iso)).toISOString();

  it("siang hari Selasa (10.00 WIB) -> Rabu 06.00 WIB", () => {
    expect(hasil("2026-10-06T03:00:00.000Z")).toBe("2026-10-06T23:00:00.000Z");
  });

  it("dini hari sebelum 06.00 WIB -> 06.00 hari yang sama", () => {
    expect(hasil("2026-10-06T17:00:00.000Z")).toBe("2026-10-06T23:00:00.000Z"); // 00.00 WIB Rabu
    expect(hasil("2026-10-06T22:59:59.999Z")).toBe("2026-10-06T23:00:00.000Z"); // 05.59.59,999 WIB Rabu
  });

  it("tepat 06.00:00.000 WIB sudah dianggap lewat -> 06.00 hari berikutnya", () => {
    expect(hasil("2026-10-06T23:00:00.000Z")).toBe("2026-10-07T23:00:00.000Z");
    expect(hasil("2026-10-06T23:00:00.001Z")).toBe("2026-10-07T23:00:00.000Z");
  });

  it("malam hari (23.59 WIB) -> 06.00 keesokan harinya", () => {
    expect(hasil("2026-10-07T16:59:59.999Z")).toBe("2026-10-07T23:00:00.000Z");
  });

  it("tanggal kalender WIB dipakai, bukan tanggal UTC: 20.00 UTC = 03.00 WIB hari berikutnya", () => {
    expect(hasil("2026-09-30T20:00:00.000Z")).toBe("2026-09-30T23:00:00.000Z"); // 1 Okt 03.00 WIB -> 1 Okt 06.00 WIB
  });

  it("melewati pergantian tahun", () => {
    expect(hasil("2026-12-31T16:00:00.000Z")).toBe("2026-12-31T23:00:00.000Z"); // 31 Des 23.00 WIB -> 1 Jan 06.00 WIB
  });
});

import { describe, expect, it } from "vitest";
import { LABEL_STATUS_PENUGASAN, statusPenugasan } from "@/lib/exam/status-penugasan";
import { formatHitungMundur } from "@/lib/utils/hitung-mundur";

const MULAI = new Date("2026-10-08T01:00:00.000Z");
const SELESAI = new Date("2026-10-08T03:00:00.000Z");
const p = (isActive = true) => ({ isActive, mulai: MULAI, selesai: SELESAI });

describe("statusPenugasan", () => {
  it("sebelum mulai = akan datang", () => {
    expect(statusPenugasan(p(), new Date("2026-10-08T00:59:59.999Z"))).toBe("akan_datang");
  });

  it("tepat saat mulai dan tepat saat selesai = berlangsung (kedua batas termasuk, sama dengan penyaring server)", () => {
    expect(statusPenugasan(p(), MULAI)).toBe("berlangsung");
    expect(statusPenugasan(p(), new Date("2026-10-08T02:00:00.000Z"))).toBe("berlangsung");
    expect(statusPenugasan(p(), SELESAI)).toBe("berlangsung");
  });

  it("sesudah selesai = selesai", () => {
    expect(statusPenugasan(p(), new Date("2026-10-08T03:00:00.001Z"))).toBe("selesai");
  });

  it("dinonaktifkan mengalahkan semua status waktu", () => {
    for (const t of ["2026-10-08T00:00:00Z", "2026-10-08T02:00:00Z", "2026-10-09T00:00:00Z"]) {
      expect(statusPenugasan(p(false), new Date(t))).toBe("nonaktif");
    }
  });

  it("menerima waktu berupa teks ISO (data dari API)", () => {
    expect(statusPenugasan({ isActive: true, mulai: MULAI.toISOString(), selesai: SELESAI.toISOString() }, new Date("2026-10-08T02:00:00Z"))).toBe("berlangsung");
  });

  it("setiap status punya label", () => {
    expect(LABEL_STATUS_PENUGASAN).toEqual({ nonaktif: "Nonaktif", akan_datang: "Akan datang", berlangsung: "Berlangsung", selesai: "Selesai" });
  });
});

describe("formatHitungMundur", () => {
  const menit = 60_000;
  const jam = 60 * menit;
  const hari = 24 * jam;

  it.each([
    [0, "sekarang"],
    [-5000, "sekarang"],
    [Number.NaN, "sekarang"],
    [Number.POSITIVE_INFINITY, "sekarang"],
    [1, "kurang dari 1 menit"],
    [59_999, "kurang dari 1 menit"],
    [menit, "1 menit"],
    [45 * menit + 59_000, "45 menit"],
    [59 * menit + 59_999, "59 menit"],
    [jam, "1 jam"],
    [jam + 5 * menit, "1 jam 5 menit"],
    [3 * jam + 30 * menit + 59_000, "3 jam 30 menit"],
    [23 * jam + 59 * menit, "23 jam 59 menit"],
    [hari, "1 hari"],
    [hari + jam, "1 hari 1 jam"],
    [2 * hari + 3 * jam + 40 * menit, "2 hari 3 jam"],
    [10 * hari, "10 hari"],
  ])("%s ms -> %s", (ms, teks) => {
    expect(formatHitungMundur(ms)).toBe(teks);
  });
});

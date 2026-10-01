import { describe, expect, it } from "vitest";
import { formatSisaWaktuPanjang, formatSisaWaktuRingkas, nadaWaktu } from "@/lib/exam/format-waktu";

describe("formatSisaWaktuPanjang", () => {
  it("jam + menit + detik", () => {
    expect(formatSisaWaktuPanjang(1 * 3600 + 49 * 60 + 51)).toBe("1 Jam 49 Menit 51 Detik");
  });

  it("tepat satu jam tetap menampilkan menit 0", () => {
    expect(formatSisaWaktuPanjang(3600)).toBe("1 Jam 0 Menit 0 Detik");
  });

  it("di bawah satu jam tanpa jam", () => {
    expect(formatSisaWaktuPanjang(49 * 60 + 51)).toBe("49 Menit 51 Detik");
  });

  it("di bawah semenit hanya detik; nol dan negatif jadi 0 Detik", () => {
    expect(formatSisaWaktuPanjang(42)).toBe("42 Detik");
    expect(formatSisaWaktuPanjang(0)).toBe("0 Detik");
    expect(formatSisaWaktuPanjang(-5)).toBe("0 Detik");
  });
});

describe("formatSisaWaktuRingkas", () => {
  it("memakai H:MM:SS kalau ada jam, M:SS kalau tidak", () => {
    expect(formatSisaWaktuRingkas(1 * 3600 + 5 * 60 + 9)).toBe("1:05:09");
    expect(formatSisaWaktuRingkas(5 * 60 + 9)).toBe("5:09");
    expect(formatSisaWaktuRingkas(0)).toBe("0:00");
  });
});

describe("nadaWaktu", () => {
  it("kritis <= 60 detik, waspada <= 300 detik, selain itu normal", () => {
    expect(nadaWaktu(60)).toBe("kritis");
    expect(nadaWaktu(61)).toBe("waspada");
    expect(nadaWaktu(300)).toBe("waspada");
    expect(nadaWaktu(301)).toBe("normal");
  });
});

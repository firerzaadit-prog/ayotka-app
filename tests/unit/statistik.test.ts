import { describe, expect, it } from "vitest";
import { hitungPersentil, hitungRerata, hitungStandarDeviasi } from "@/lib/analytics/statistik";

describe("hitungRerata", () => {
  it("rata-rata sederhana", () => {
    expect(hitungRerata([10, 20, 30])).toBeCloseTo(20);
  });

  it("array kosong tidak pernah bagi-nol (0, bukan NaN)", () => {
    expect(hitungRerata([])).toBe(0);
    expect(Number.isNaN(hitungRerata([]))).toBe(false);
  });
});

describe("hitungStandarDeviasi", () => {
  it("standar deviasi populasi utk data seragam adalah 0", () => {
    expect(hitungStandarDeviasi([50, 50, 50])).toBe(0);
  });

  it("standar deviasi populasi utk [2,4,4,4,5,5,7,9] adalah 2", () => {
    // Contoh baku dari definisi std dev populasi (Wikipedia).
    expect(hitungStandarDeviasi([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2);
  });

  it("array kosong tidak pernah bagi-nol", () => {
    expect(hitungStandarDeviasi([])).toBe(0);
  });
});

describe("hitungPersentil", () => {
  it("median (P50) dari jumlah data ganjil adalah nilai tengah", () => {
    expect(hitungPersentil([10, 20, 30, 40, 50], 50)).toBe(30);
  });

  it("median (P50) dari jumlah data genap adalah rata-rata dua nilai tengah", () => {
    expect(hitungPersentil([10, 20, 30, 40], 50)).toBeCloseTo(25);
  });

  it("P0 adalah nilai minimum, P100 adalah nilai maksimum", () => {
    const data = [5, 15, 25, 35, 45];
    expect(hitungPersentil(data, 0)).toBe(5);
    expect(hitungPersentil(data, 100)).toBe(45);
  });

  it("interpolasi linear utk persentil yang tidak jatuh tepat di satu titik data", () => {
    // idx = 0.1 * 9 = 0.9 -> interpolasi antara indeks 0 (10) dan 1 (20).
    expect(hitungPersentil([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 10)).toBeCloseTo(19);
  });

  it("satu elemen mengembalikan elemen itu sendiri utk persentil berapapun", () => {
    expect(hitungPersentil([42], 10)).toBe(42);
    expect(hitungPersentil([42], 90)).toBe(42);
  });

  it("array kosong tidak pernah bagi-nol", () => {
    expect(hitungPersentil([], 50)).toBe(0);
  });
});
